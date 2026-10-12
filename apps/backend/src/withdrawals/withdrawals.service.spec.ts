// apps/backend/src/withdrawals/withdrawals.service.spec.ts
// Phase 6 (v4.11) — paiement en agence : seuls les envois cash sont payables, pas de caisse d'une autre
// devise, retraits limités à la société de l'appelant.
import 'reflect-metadata';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PayoutMethod, TransactionStatus, TransactionType } from '@prisma/client';
import { WithdrawalsService } from './withdrawals.service';

function make(over: { tx?: any; wallets?: any[]; agent?: any } = {}) {
  const prisma: any = {
    transaction: {
      findFirst: jest.fn().mockResolvedValue(over.tx === undefined ? null : over.tx),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(
        over.agent ?? { id: 'ag', agencyId: 'a1', agency: { id: 'a1', type: 'SUBSIDIARY', name: 'Agence' }, email: null, firstName: 'A', lastName: 'B' },
      ),
    },
    wallet: { findMany: jest.fn().mockResolvedValue(over.wallets ?? []) },
    withdrawal: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'w1' }),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'new' }),
    },
    $transaction: jest.fn(),
  };
  const service = new (WithdrawalsService as any)(prisma, {}, {}, {}, {}, {}, {}) as WithdrawalsService;
  return { service, prisma };
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

describe('WithdrawalsService.adminUpdateStatus — société de l\'appelant', () => {
  it('met à jour un retrait de SA société', async () => {
    const { service, prisma } = make();
    await service.adminUpdateStatus(5, 'admin', 'w1', { status: 'REJECTED' } as any);
    expect(prisma.withdrawal.updateMany).toHaveBeenCalledWith({ where: { id: 'w1', clientId: 5 }, data: { status: 'REJECTED' } });
  });

  it('retrait d\'une autre société → 404, rien n\'est modifié', async () => {
    const { service, prisma } = make();
    prisma.withdrawal.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.adminUpdateStatus(5, 'admin', 'w-autre-societe', { status: 'PAID' } as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.withdrawal.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe('WithdrawalsService.create — demande par transactionId', () => {
  const user = (role: string) => ({ id: 'u1', role, primaryCurrency: 'XOF', email: null });

  it('un client ne demande un retrait que pour SES transactions', async () => {
    const { service, prisma } = make();
    prisma.user.findUnique.mockResolvedValue(user('USER'));
    await expect(service.create(5, 'u1', { transactionId: 'tx-d-un-autre' } as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.transaction.findFirst.mock.calls[0][0].where).toEqual({ id: 'tx-d-un-autre', clientId: 5, senderId: 'u1' });
  });

  it('un admin de la société peut le faire pour n\'importe quelle transaction de la société', async () => {
    const { service, prisma } = make({ tx: { id: 'tx1', payoutMethod: 'CASH_PICKUP' } });
    prisma.user.findUnique.mockResolvedValue(user('COMPANY_ADMIN'));
    await service.create(5, 'u1', { transactionId: 'tx1' } as any);
    expect(prisma.transaction.findFirst.mock.calls[0][0].where).toEqual({ id: 'tx1', clientId: 5 });
  });

  it('une seconde demande renvoie la première (Withdrawal.transactionId est unique)', async () => {
    const { service, prisma } = make({ tx: { id: 'tx1', payoutMethod: 'CASH_PICKUP' } });
    prisma.user.findUnique.mockResolvedValue(user('USER'));
    prisma.withdrawal.findUnique.mockResolvedValue({ id: 'deja-la' });
    await expect(service.create(5, 'u1', { transactionId: 'tx1' } as any)).resolves.toEqual({ id: 'deja-la' });
    expect(prisma.withdrawal.create).not.toHaveBeenCalled();
  });
});
