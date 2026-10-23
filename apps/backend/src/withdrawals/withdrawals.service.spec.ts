// apps/backend/src/withdrawals/withdrawals.service.spec.ts
// Phase 6 (v4.11) — paiement en agence : seuls les envois cash sont payables, pas de caisse d'une autre
// devise, retraits limités à la société de l'appelant. (create() a été supprimé en v4.12.)
// Audit point 4 (v4.14) — retrait rejeté / annulé : jamais payable, et la transaction est close + remboursée.
// Lot 2c (v4.13) — commissions arrondies et exactes, taux indisponible = 503, crédits verrouillés, statut manuel encadré.
import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PayoutMethod, TransactionStatus, TransactionType } from '@prisma/client';
import { WithdrawalsService } from './withdrawals.service';

function make(over: { tx?: any; wallets?: any[]; agent?: any; split?: any; convert?: jest.Mock; withdrawalBefore?: any; closeFromWithdrawal?: jest.Mock } = {}) {
  const prisma: any = {
    transaction: {
      findFirst: jest.fn().mockResolvedValue(over.tx === undefined ? null : over.tx),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(
        over.agent ?? { id: 'ag', agencyId: 'a1', agency: { id: 'a1', type: 'SUBSIDIARY', name: 'Agence' }, email: null, firstName: 'A', lastName: 'B' },
      ),
    },
    wallet: {
      findMany: jest.fn().mockResolvedValue(over.wallets ?? []),
      findUnique: jest.fn().mockResolvedValue({ id: 'w-agence', balance: 0 }),
    },
    agency: { findFirst: jest.fn().mockResolvedValue({ type: 'SUBSIDIARY' }) },
    commissionConfig: { findFirst: jest.fn().mockResolvedValue(over.split === undefined ? null : over.split) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    withdrawal: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue(over.withdrawalBefore === undefined ? { status: 'PENDING', transactionId: 't1' } : over.withdrawalBefore),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'w1' }),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'new' }),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(),
  };
  const credits: Array<{ walletId: string; amount: number; description: string; transactionId?: string }> = [];
  const wallets: any = {
    creditInTx: jest.fn(async (_tx: any, walletId: string, amount: number, description: string, transactionId?: string) => {
      credits.push({ walletId, amount, description, transactionId });
    }),
    getOrCreateWallet: jest.fn().mockResolvedValue({ id: 'w-societe' }),
  };
  const rates: any = { convert: over.convert ?? jest.fn(async (v: number) => v) };
  const noop: any = {
    notifyTransferSent: jest.fn().mockResolvedValue(undefined),
    notifyWithdrawalProcessed: jest.fn().mockResolvedValue(undefined),
    notifyLowBalance: jest.fn().mockResolvedValue(undefined),
    sendMoneyReceived: jest.fn().mockResolvedValue(undefined),
    sendWithdrawalProcessed: jest.fn().mockResolvedValue(undefined),
  };
  const transactions: any = { closeFromWithdrawal: over.closeFromWithdrawal ?? jest.fn().mockResolvedValue({ id: 't1', status: 'CANCELLED' }) };
  const service = new (WithdrawalsService as any)(prisma, wallets, rates, noop, noop, noop, noop, transactions) as WithdrawalsService;
  return { service, prisma, wallets, rates, credits, transactions };
}

describe('WithdrawalsService — code de retrait', () => {
  it('agentCheckCode ne cherche que des envois cash (TRANSFER / SCHEDULED, CASH_PICKUP) de la société', async () => {
    const { service, prisma } = make();
    await expect(service.agentCheckCode(5, ' 123456789 ')).rejects.toBeInstanceOf(NotFoundException);
    const where = prisma.transaction.findFirst.mock.calls[0][0].where;
    expect(where.clientId).toBe(5);
    expect(where.type).toEqual({ in: [TransactionType.TRANSFER, TransactionType.SCHEDULED] });
    expect(where.payoutMethod).toBe(PayoutMethod.CASH_PICKUP);
    expect(where.OR).toEqual(expect.arrayContaining([{ reference: '123456789' }, { providerRef: '123456789' }]));
  });

  it('agentProcessPayment applique le même filtre', async () => {
    const { service, prisma } = make();
    await expect(service.agentProcessPayment(5, 'ag', '123456789')).rejects.toBeInstanceOf(NotFoundException);
    const where = prisma.transaction.findFirst.mock.calls[0][0].where;
    expect(where.type).toEqual({ in: [TransactionType.TRANSFER, TransactionType.SCHEDULED] });
    expect(where.payoutMethod).toBe(PayoutMethod.CASH_PICKUP);
  });

  it('agentProcessPayment : pas de caisse dans la devise payée → erreur, jamais une caisse d\'une autre devise', async () => {
    const tx = {
      id: 't1', status: TransactionStatus.VALIDATED, currency: 'EUR', targetCurrency: 'GNF',
      amount: 100, receivedAmount: 1_000_000, fees: 1, sender: null, withdrawal: null, beneficiary: null,
    };
    const { service, prisma } = make({
      tx,
      wallets: [
        { id: 'w-xof', currency: 'XOF', isDefault: true, balance: 0 },
        { id: 'w-eur', currency: 'EUR', isDefault: false, balance: 0 },
      ],
    });
    await expect(service.agentProcessPayment(5, 'ag', '123456789')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('WithdrawalsService.agentProcessPayment — commissions (v4.13)', () => {
  const agentWallets = [{ id: 'w-agence', currency: 'XOF', balance: 0 }];
  const baseTx = (over: any = {}) => ({
    id: 't1', status: TransactionStatus.VALIDATED, currency: 'XOF', targetCurrency: null, payoutMethod: 'CASH_PICKUP',
    amount: 100_000, receivedAmount: null, fees: 1_001, agencyId: 'a-envoi', senderId: null,
    sender: { id: 's1', agencyId: 'a-envoi', firstName: 'S', lastName: 'T' }, withdrawal: null, beneficiary: null, ...over,
  });
  const run = (m: ReturnType<typeof make>) => {
    m.prisma.$transaction.mockImplementation(async (fn: any) => fn({ transaction: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, withdrawal: m.prisma.withdrawal }));
    return m.service.agentProcessPayment(5, 'ag', 'REF');
  };

  it('arrondit chaque part et donne le reste à la société : la somme égale les frais', async () => {
    const m = make({ tx: baseTx(), wallets: [...agentWallets, { id: 'w-envoi', currency: 'XOF' }] });
    const r: any = await run(m);
    const { payerAgency, senderAgency, companyAdmin } = r.commissions;
    expect(payerAgency.amount + senderAgency.amount + companyAdmin.amount).toBe(1_001);
    expect(Number.isInteger(payerAgency.amount) && Number.isInteger(senderAgency.amount) && Number.isInteger(companyAdmin.amount)).toBe(true);
  });

  it('crédits via creditInTx, tous liés à la transaction ; le cash avancé est remboursé en entier', async () => {
    const m = make({ tx: baseTx(), wallets: [...agentWallets, { id: 'w-envoi', currency: 'XOF' }] });
    await run(m);
    expect(m.credits.every((c) => c.transactionId === 't1')).toBe(true);
    expect(m.credits[0]).toMatchObject({ walletId: 'w-agence', amount: 100_000 });
    const total = m.credits.reduce((s, c) => s + c.amount, 0);
    expect(total).toBe(100_000 + 1_001);
    expect(m.credits.filter((c) => c.description.startsWith('Commission')).length).toBe(3);
  });

  it('taux de change indisponible → 503, aucun crédit, rien n\'est marqué payé', async () => {
    const convert = jest.fn().mockRejectedValue(new Error('pas de taux'));
    const m = make({ tx: baseTx({ currency: 'EUR', targetCurrency: 'XOF', amount: 100, receivedAmount: 65_000, fees: 2 }), wallets: agentWallets, convert });
    await expect(m.service.agentProcessPayment(5, 'ag', 'REF')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
    expect(m.credits).toHaveLength(0);
  });

  it('expéditeur client (sans agence) : la part d\'envoi va à la société, pas de caisse d\'envoi', async () => {
    const m = make({ tx: baseTx({ agencyId: null, sender: { id: 's1', agencyId: null } }), wallets: agentWallets });
    const r: any = await run(m);
    expect(r.commissions.senderAgency.amount).toBe(0);
    expect(r.commissions.payerAgency.amount + r.commissions.companyAdmin.amount).toBe(1_001);
    expect(m.prisma.agency.findFirst).not.toHaveBeenCalled();
  });

  it('même agence : la part d\'envoi s\'ajoute à l\'agence payeuse', async () => {
    const m = make({ tx: baseTx({ agencyId: 'a1' }), wallets: agentWallets });
    const r: any = await run(m);
    expect(r.commissions.senderAgency.amount).toBe(0);
    expect(r.commissions.payerAgency.share).toBe(60);
  });

  it('l\'agence enregistrée sur l\'envoi prime sur l\'agence actuelle de l\'expéditeur, et son type est lu en base', async () => {
    const m = make({ tx: baseTx({ agencyId: 'a-ancienne', sender: { id: 's1', agencyId: 'a-nouvelle' } }), wallets: [...agentWallets, { id: 'w-envoi', currency: 'XOF' }] });
    m.prisma.agency.findFirst.mockResolvedValue({ type: 'PARTNER' });
    await run(m);
    expect(m.prisma.agency.findFirst).toHaveBeenCalledWith({ where: { id: 'a-ancienne', clientId: 5 }, select: { type: true } });
    expect(m.prisma.commissionConfig.findFirst.mock.calls[0][0].where).toMatchObject({ sourceType: 'PARTNER', destType: 'SUBSIDIARY' });
  });

  it('pas de caisse dans la devise pour l\'agence d\'envoi → sa part revient à la société', async () => {
    const m = make({ tx: baseTx(), wallets: agentWallets });
    m.prisma.wallet.findMany.mockResolvedValueOnce(agentWallets).mockResolvedValueOnce([]);
    const r: any = await run(m);
    expect(r.commissions.senderAgency.amount).toBe(0);
    expect(r.commissions.payerAgency.amount + r.commissions.companyAdmin.amount).toBe(1_001);
  });

  it('applique la règle configurée de la société', async () => {
    const m = make({ tx: baseTx({ fees: 1000 }), wallets: [...agentWallets, { id: 'w-envoi', currency: 'XOF' }], split: { payerShare: 50, senderShare: 10, platformShare: 40 } });
    const r: any = await run(m);
    expect(r.commissions.payerAgency.amount).toBe(500);
    expect(r.commissions.senderAgency.amount).toBe(100);
    expect(r.commissions.companyAdmin.amount).toBe(400);
  });
});

describe('WithdrawalsService.adminUpdateStatus — société de l\'appelant et statuts (v4.13)', () => {
  it('met à jour un retrait de SA société, conditionnellement au statut lu, et journalise', async () => {
    const { service, prisma, transactions } = make();
    await service.adminUpdateStatus(5, 'admin', 'w1', { status: 'APPROVED' } as any);
    expect(prisma.withdrawal.findFirst).toHaveBeenCalledWith({ where: { id: 'w1', clientId: 5 }, select: { status: true } });
    expect(prisma.withdrawal.updateMany).toHaveBeenCalledWith({ where: { id: 'w1', clientId: 5, status: 'PENDING' }, data: { status: 'APPROVED' } });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(transactions.closeFromWithdrawal).not.toHaveBeenCalled();
  });

  it('REJECTED / CANCELLED / FAILED / EXPIRED ferment la transaction et remboursent (audit point 4)', async () => {
    for (const status of ['REJECTED', 'CANCELLED', 'FAILED', 'EXPIRED']) {
      const { service, prisma, transactions } = make();
      await service.adminUpdateStatus(5, 'admin', 'w1', { status } as any);
      expect(transactions.closeFromWithdrawal).toHaveBeenCalledWith(5, 'admin', 't1', status);
      // le statut du retrait est posé DANS la transaction de remboursement, pas par un updateMany séparé
      expect(prisma.withdrawal.updateMany).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    }
  });

  it('si la transaction ne peut plus être close (déjà payée), l\'erreur remonte et rien n\'est journalisé', async () => {
    const closeFromWithdrawal = jest.fn().mockRejectedValue(new ConflictException('déjà PAID'));
    const { service, prisma } = make({ closeFromWithdrawal });
    await expect(service.adminUpdateStatus(5, 'admin', 'w1', { status: 'REJECTED' } as any)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('retrait d\'une autre société → 404, rien n\'est modifié', async () => {
    const { service, prisma } = make({ withdrawalBefore: null });
    await expect(service.adminUpdateStatus(5, 'admin', 'w-autre-societe', { status: 'REJECTED' } as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.withdrawal.updateMany).not.toHaveBeenCalled();
  });

  it('PAID à la main est refusé', async () => {
    const { service, prisma } = make();
    await expect(service.adminUpdateStatus(5, 'admin', 'w1', { status: 'PAID' } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.withdrawal.updateMany).not.toHaveBeenCalled();
  });

  it('un retrait déjà payé ou clos n\'est plus modifiable', async () => {
    for (const status of ['PAID', 'REJECTED', 'CANCELLED', 'FAILED', 'EXPIRED']) {
      const { service, prisma } = make({ withdrawalBefore: { status } });
      await expect(service.adminUpdateStatus(5, 'admin', 'w1', { status: 'APPROVED' } as any)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.withdrawal.updateMany).not.toHaveBeenCalled();
    }
  });

  it('modification concurrente (0 ligne mise à jour) → 409', async () => {
    const { service, prisma } = make();
    prisma.withdrawal.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.adminUpdateStatus(5, 'admin', 'w1', { status: 'APPROVED' } as any)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});


describe('WithdrawalsService — un retrait clos n\'est plus payable (audit point 4)', () => {
  const agentWallets = [{ id: 'w-agence', currency: 'XOF' }];
  const tx = (withdrawal: any) => ({
    id: 't1', status: TransactionStatus.VALIDATED, currency: 'XOF', targetCurrency: null, payoutMethod: 'CASH_PICKUP',
    amount: 100_000, receivedAmount: null, fees: 1_000, agencyId: 'a-envoi', senderId: null,
    sender: { id: 's1', agencyId: 'a-envoi', firstName: 'S', lastName: 'T' }, withdrawal, beneficiary: null,
  });

  it('agentProcessPayment refuse un retrait REJECTED / CANCELLED / FAILED / EXPIRED, sans ouvrir de transaction SQL', async () => {
    for (const status of ['REJECTED', 'CANCELLED', 'FAILED', 'EXPIRED']) {
      const m = make({ tx: tx({ id: 'wd1', status }), wallets: agentWallets });
      await expect(m.service.agentProcessPayment(5, 'ag', 'REF')).rejects.toBeInstanceOf(ConflictException);
      expect(m.prisma.$transaction).not.toHaveBeenCalled();
      expect(m.credits).toHaveLength(0);
    }
  });

  it('agentCheckCode refuse aussi un retrait clos', async () => {
    const m = make({ tx: tx({ id: 'wd1', status: 'REJECTED' }) });
    await expect(m.service.agentCheckCode(5, 'REF')).rejects.toBeInstanceOf(ConflictException);
  });

  it('un admin qui rejette pendant le paiement : le retrait n\'est pas réclamé (0 ligne) → 409, paiement annulé', async () => {
    const m = make({ tx: tx({ id: 'wd1', status: 'PENDING' }), wallets: agentWallets });
    m.prisma.withdrawal.updateMany.mockResolvedValue({ count: 0 });
    m.prisma.$transaction.mockImplementation(async (fn: any) => fn({ transaction: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, withdrawal: m.prisma.withdrawal }));
    await expect(m.service.agentProcessPayment(5, 'ag', 'REF')).rejects.toBeInstanceOf(ConflictException);
    expect(m.prisma.withdrawal.updateMany).toHaveBeenCalledWith({
      where: { id: 'wd1', status: { in: ['PENDING', 'APPROVED'] } },
      data: expect.objectContaining({ status: 'PAID' }),
    });
  });
});

// ✅ v4.15 — pays de paiement + expiration à 5 mois
describe('WithdrawalsService — pays de paiement et expiration (v4.15)', () => {
  const agentIn = (country: string | null, primaryCurrency = 'XOF') => ({
    id: 'ag', agencyId: 'a1', agency: { id: 'a1', type: 'SUBSIDIARY', name: 'Agence', country, primaryCurrency }, email: null, firstName: 'A', lastName: 'B',
  });
  const monthsAgo = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d; };
  const tx = (over: any = {}) => ({
    id: 't1', status: TransactionStatus.VALIDATED, currency: 'EUR', targetCurrency: 'GNF', payoutMethod: 'CASH_PICKUP',
    amount: 100, receivedAmount: 1_000_000, fees: 1, agencyId: 'a-envoi', senderId: null, receiveCountry: 'GN',
    createdAt: new Date(), pickupExpiry: null,
    sender: { id: 's1', agencyId: 'a-envoi', firstName: 'S', lastName: 'T' }, withdrawal: null, beneficiary: null, ...over,
  });

  it('un code EUR → Guinée (GNF) ne peut PAS être payé au Sénégal (XOF) : message qui indique la Guinée', async () => {
    const m = make({ tx: tx(), agent: agentIn('SN') });
    const p = m.service.agentProcessPayment(5, 'ag', 'REF');
    await expect(p).rejects.toBeInstanceOf(ForbiddenException);
    await expect(m.service.agentProcessPayment(5, 'ag', 'REF')).rejects.toThrow(/Guinée/);
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
    expect(m.credits).toHaveLength(0);
  });

  it('la vérification du code (avant paiement) donne déjà le même message', async () => {
    const m = make({ tx: tx() });
    m.prisma.user.findUnique.mockResolvedValue(agentIn('SN'));
    await expect(m.service.agentCheckCode(5, 'REF', 'ag')).rejects.toThrow(/Guinée/);
  });

  it('un code envoyé en Côte d\'Ivoire ne se paie pas au Sénégal, même devise XOF', async () => {
    const m = make({ tx: tx({ currency: 'EUR', targetCurrency: 'XOF', receiveCountry: 'CI' }), agent: agentIn('SN', 'XOF') });
    await expect(m.service.agentProcessPayment(5, 'ag', 'REF')).rejects.toThrow(/Côte d'Ivoire/);
  });

  it('un code envoyé en Côte d\'Ivoire se paie en Côte d\'Ivoire', async () => {
    const m = make({ tx: tx({ currency: 'EUR', targetCurrency: 'XOF', receiveCountry: 'CI' }), agent: agentIn('CI', 'XOF'), wallets: [{ id: 'w-agence', currency: 'XOF', balance: 0 }] });
    m.prisma.$transaction.mockImplementation(async (fn: any) => fn({
      transaction: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      withdrawal: m.prisma.withdrawal,
    }));
    await m.service.agentCheckCode(5, 'REF', 'ag').catch(() => undefined);
    // Le contrôle de pays ne doit pas être la cause d'un refus.
    await m.service.agentProcessPayment(5, 'ag', 'REF').catch((e: any) => {
      expect(e).not.toBeInstanceOf(ForbiddenException);
    });
  });

  it('agence sans pays renseigné + destination connue → refus explicite', async () => {
    const m = make({ tx: tx(), agent: agentIn(null, 'GNF') });
    await expect(m.service.agentProcessPayment(5, 'ag', 'REF')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('ancien envoi sans receiveCountry : le pays du bénéficiaire fait foi', async () => {
    const m = make({ tx: tx({ receiveCountry: null, beneficiary: { country: 'Guinée' } }), agent: agentIn('SN') });
    await expect(m.service.agentProcessPayment(5, 'ag', 'REF')).rejects.toThrow(/Guinée/);
  });

  it('code expiré (plus de 5 mois) : refusé au guichet avant le passage du cron, vérification comme paiement', async () => {
    const old = tx({ createdAt: monthsAgo(6), pickupExpiry: null, receiveCountry: 'SN' });
    const m = make({ tx: old, agent: agentIn('SN') });
    await expect(m.service.agentProcessPayment(5, 'ag', 'REF')).rejects.toThrow(/expiré/);
    await expect(m.service.agentCheckCode(5, 'REF', 'ag')).rejects.toThrow(/expiré/);
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('pickupExpiry explicite dans le passé → expiré ; dans le futur → pas expiré', async () => {
    const past = make({ tx: tx({ pickupExpiry: new Date(Date.now() - 1000), receiveCountry: 'SN' }), agent: agentIn('SN') });
    await expect(past.service.agentProcessPayment(5, 'ag', 'REF')).rejects.toThrow(/expiré/);
    const future = make({ tx: tx({ createdAt: monthsAgo(8), pickupExpiry: new Date(Date.now() + 86_400_000), receiveCountry: 'SN' }), agent: agentIn('SN') });
    await future.service.agentCheckCode(5, 'REF', 'ag').catch((e: any) => expect(String(e.message)).not.toMatch(/expiré/));
  });

  it('statut EXPIRED : refusé', async () => {
    const m = make({ tx: tx({ status: TransactionStatus.EXPIRED, receiveCountry: 'SN' }), agent: agentIn('SN') });
    await expect(m.service.agentProcessPayment(5, 'ag', 'REF')).rejects.toBeInstanceOf(ConflictException);
  });
});
