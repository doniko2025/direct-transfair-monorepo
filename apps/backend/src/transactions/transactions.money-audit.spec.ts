// apps/backend/src/transactions/transactions.money-audit.spec.ts
// Audit argent (v4.33) — recharge d'agence par un SUPER_ADMIN, statuts manuels interdits, remboursement vers la caisse d'agence.
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { Prisma, TransactionStatus as S, TransactionType as T } from '@prisma/client';
import { TransactionsService } from './transactions.service';

type Row = Record<string, any>;

function build(over: { admin?: Row; agency?: Row; tx?: Row } = {}) {
  const state = { debits: [] as any[], credits: [] as any[], created: [] as any[], audits: [] as any[], walletRequests: [] as any[], status: over.tx?.status };

  const txClient: any = {
    transaction: {
      create: jest.fn().mockImplementation(async ({ data }: any) => { state.created.push(data); return { id: 'new-tx', ...data }; }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockImplementation(async () => ({ ...(over.tx ?? {}) })),
    },
    withdrawal: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const admin = { id: 'admin1', role: 'COMPANY_ADMIN', clientId: 5, email: null, ...(over.admin ?? {}) };
  const agency = { id: 'ag1', name: 'Agence Test', clientId: 7, ...(over.agency ?? {}) };
  const prisma: any = {
    // v4.34 : le wallet remboursé est lu dans le journal (DEBIT) ; sans écriture, repli sur les règles (anciennes données). Client de passage : aucun.
    ledgerEntry: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    counterCustomer: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn().mockResolvedValue(admin), findMany: jest.fn().mockResolvedValue([]) },
    agency: { findUnique: jest.fn().mockResolvedValue(agency) },
    wallet: {
      findUnique: jest.fn().mockImplementation(async ({ where }: any) => ({ id: where.id, balance: new Prisma.Decimal(10_000_000), reservedBalance: new Prisma.Decimal(0) })),
      findFirst: jest.fn().mockResolvedValue({ id: 'agency-wallet-existing' }),
    },
    transaction: {
      findUnique: jest.fn().mockImplementation(async () => (over.tx ? { ...over.tx } : null)),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    auditLog: { create: jest.fn().mockImplementation(async ({ data }: any) => { state.audits.push(data); return data; }) },
    $transaction: jest.fn().mockImplementation((fn: any) => fn(txClient)),
  };
  const wallets: any = {
    getOrCreateWallet: jest.fn().mockImplementation(async (p: any) => {
      state.walletRequests.push(p);
      return { id: p.agencyId ? `agency-wallet-${p.agencyId}` : p.clientId !== undefined ? `company-wallet-${p.clientId}` : `user-wallet-${p.userId}` };
    }),
    debitInTx: jest.fn().mockImplementation(async (_db: any, id: string, amount: number) => { state.debits.push({ id, amount }); }),
    creditInTx: jest.fn().mockImplementation(async (_db: any, id: string, amount: number) => { state.credits.push({ id, amount }); }),
  };
  const none: any = {};
  const service = new (TransactionsService as any)(prisma, {}, {}, wallets, none, {}, {}, {}, {}, {}, {}, {}, {}, none, {}) as TransactionsService;
  return { service, state, prisma, wallets, txClient };
}

describe('refillAgency — la société débitée est celle de l\'AGENCE', () => {
  it('SUPER_ADMIN : débite le wallet de la société propriétaire de l\'agence, pas le sien', async () => {
    const { service, state, wallets } = build({ admin: { role: 'SUPER_ADMIN', clientId: 1 }, agency: { clientId: 7 } });
    await service.refillAgency('admin1', 'ag1', 100000, 'XOF');
    // wallet société demandé pour la société 7 (agence), jamais pour la société 1 (super admin)
    expect(wallets.getOrCreateWallet).toHaveBeenCalledWith({ clientId: 7, currency: 'XOF' });
    expect(wallets.getOrCreateWallet).not.toHaveBeenCalledWith({ clientId: 1, currency: 'XOF' });
    expect(state.debits).toEqual([{ id: 'company-wallet-7', amount: 100000 }]);
    expect(state.credits).toEqual([{ id: 'agency-wallet-ag1', amount: 100000 }]);
    // la ligne de transaction est rangée dans la société de l'agence (visible pour son admin)
    expect(state.created[0].clientId).toBe(7);
    expect(state.audits[0].clientId).toBe(7);
  });

  it('COMPANY_ADMIN : inchangé, sa société est débitée', async () => {
    const { service, state } = build({ admin: { role: 'COMPANY_ADMIN', clientId: 5 }, agency: { clientId: 5 } });
    await service.refillAgency('admin1', 'ag1', 5000, 'XOF');
    expect(state.debits).toEqual([{ id: 'company-wallet-5', amount: 5000 }]);
    expect(state.created[0].clientId).toBe(5);
  });

  it('COMPANY_ADMIN : l\'agence d\'une autre société reste interdite', async () => {
    const { service, state } = build({ admin: { role: 'COMPANY_ADMIN', clientId: 5 }, agency: { clientId: 7 } });
    await expect(service.refillAgency('admin1', 'ag1', 5000, 'XOF')).rejects.toThrow('ne vous appartient pas');
    expect(state.debits).toHaveLength(0);
  });
});

const baseTx = (over: Row = {}): Row => ({
  id: 't1', reference: '123456789', type: T.SERVICE_PAYMENT, status: S.PENDING, senderId: 'u1', agencyId: null,
  clientId: 5, currency: 'XOF', amount: 10000, fees: 0, total: 10000, payoutMethod: 'WALLET', ...over,
});

describe('adminUpdateStatusForAdmin — statuts qui doivent suivre leur propre flux', () => {
  it.each([S.VALIDATED, S.PAID])('virement B2B : passage manuel à %s refusé (seul le Super Admin le valide)', async (target) => {
    const { service, txClient } = build({ tx: baseTx() });
    await expect(service.adminUpdateStatusForAdmin('admin1', 't1', { status: target } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(txClient.transaction.updateMany).not.toHaveBeenCalled();
  });

  it('recharge (DEPOSIT) : passage manuel à PAID refusé', async () => {
    const { service, prisma } = build({ tx: baseTx({ type: T.DEPOSIT, status: S.VALIDATED }) });
    await expect(service.adminUpdateStatusForAdmin('admin1', 't1', { status: S.PAID } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('virement B2B en attente : l\'annulation par l\'admin reste possible et rembourse la société', async () => {
    const { service, state } = build({ tx: baseTx() });
    await service.adminUpdateStatusForAdmin('admin1', 't1', { status: S.CANCELLED } as any);
    expect(state.credits).toEqual([{ id: 'company-wallet-5', amount: 10000 }]);
  });

  it('un envoi (TRANSFER) en attente peut toujours être validé par l\'admin (seuil de validation)', async () => {
    const { service, prisma } = build({ tx: baseTx({ type: T.TRANSFER, status: S.PENDING, payoutMethod: 'CASH_PICKUP' }) });
    prisma.transaction.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    prisma.transaction.findUniqueOrThrow = jest.fn().mockResolvedValue({ id: 't1', status: S.VALIDATED });
    await expect(service.adminUpdateStatusForAdmin('admin1', 't1', { status: S.VALIDATED } as any)).resolves.toBeDefined();
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({ where: { id: 't1', status: S.PENDING }, data: { status: S.VALIDATED } });
  });
});

describe('remboursement d\'un envoi fait depuis une caisse d\'agence', () => {
  it('revient à la caisse de l\'agence même si elle a été désactivée entre-temps (pas sur le wallet d\'un agent désactivé)', async () => {
    const { service, state, prisma } = build({
      tx: baseTx({ type: T.TRANSFER, status: S.VALIDATED, agencyId: 'ag1', payoutMethod: 'CASH_PICKUP', total: 10150, senderId: 'agent1' }),
    });
    prisma.wallet.findFirst = jest.fn().mockResolvedValue({ id: 'agency-wallet-inactive' });
    await service.adminUpdateStatusForAdmin('admin1', 't1', { status: S.CANCELLED } as any);
    // le filtre ne doit PAS exiger isActive
    const where = prisma.wallet.findFirst.mock.calls[0][0].where;
    expect(where).toEqual({ agencyId: 'ag1', currency: 'XOF' });
    expect(state.credits).toEqual([{ id: 'agency-wallet-inactive', amount: 10150 }]);
  });
});
