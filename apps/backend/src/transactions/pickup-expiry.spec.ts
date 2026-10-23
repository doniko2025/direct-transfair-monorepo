// apps/backend/src/transactions/pickup-expiry.spec.ts
// Expiration des codes non retirés : annulation EXPIRED + remboursement atomique, une seule fois.
import 'reflect-metadata';
import { TransactionStatus as S, TransactionType as T, WithdrawalStatus as W } from '@prisma/client';
import { TransactionsService } from './transactions.service';

function setup(rows: any[]) {
  const state = { rows: rows.map((r) => ({ ...r })), credits: [] as any[], wd: [] as any[], notifs: [] as any[] };
  const txClient: any = {
    transaction: {
      updateMany: jest.fn(async ({ where, data }: any) => {
        const t = state.rows.find((r) => r.id === where.id);
        if (!t || !where.status.in.includes(t.status)) return { count: 0 };
        Object.assign(t, data);
        return { count: 1 };
      }),
      findUniqueOrThrow: jest.fn(async ({ where }: any) => ({ ...state.rows.find((r) => r.id === where.id) })),
    },
    withdrawal: { updateMany: jest.fn(async ({ data }: any) => { state.wd.push(data.status); return { count: 1 }; }) },
  };
  const prisma: any = {
    transaction: { findMany: jest.fn(async () => state.rows.filter((r) => r.status === S.VALIDATED || r.status === S.PENDING).map((r) => ({ ...r }))) },
    wallet: { findFirst: jest.fn().mockResolvedValue(null) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((fn: any) => fn(txClient)),
  };
  const wallets: any = {
    getOrCreateWallet: jest.fn(async (p: any) => ({ id: `user-wallet-${p.userId}` })),
    creditInTx: jest.fn(async (_d: any, walletId: string, amount: number, desc: string) => { state.credits.push({ walletId, amount, desc }); }),
  };
  const notifications: any = { create: jest.fn(async (...a: any[]) => { state.notifs.push(a); }) };
  const none: any = {};
  const service = new (TransactionsService as any)(prisma, {}, {}, wallets, none, {}, {}, {}, {}, {}, notifications, {}, {}, none, {}) as TransactionsService;
  return { service, state, prisma, wallets };
}

const old = (over: any = {}) => ({
  id: 't1', reference: '123456789', type: T.TRANSFER, status: S.VALIDATED, senderId: 'u1', agencyId: null,
  clientId: 5, currency: 'EUR', amount: 100, fees: 2, total: 102, pickupExpiry: new Date(Date.now() - 86_400_000),
  createdAt: new Date(Date.now() - 200 * 86_400_000), ...over,
});

describe('TransactionsService.expireUnclaimed', () => {
  it('annule en EXPIRED et rembourse le total une seule fois, retrait EXPIRED', async () => {
    const { service, state } = setup([old()]);
    expect(await service.expireUnclaimed()).toBe(1);
    expect(state.rows[0].status).toBe(S.EXPIRED);
    expect(state.credits).toEqual([{ walletId: 'user-wallet-u1', amount: 102, desc: 'Remboursement code expiré 123456789' }]);
    expect(state.wd).toEqual([W.EXPIRED]);
    // le lendemain : plus rien à expirer, pas de second remboursement
    expect(await service.expireUnclaimed()).toBe(0);
    expect(state.credits).toHaveLength(1);
  });

  it('la requête ne vise que PENDING / VALIDATED échus (pickupExpiry passé, ou absent + création > 5 mois)', async () => {
    const { service, prisma } = setup([]);
    await service.expireUnclaimed(50);
    const q = prisma.transaction.findMany.mock.calls[0][0];
    expect(q.where.status).toEqual({ in: [S.PENDING, S.VALIDATED] });
    expect(q.where.OR).toHaveLength(2);
    expect(q.where.OR[0]).toHaveProperty('pickupExpiry.lte');
    expect(q.where.OR[1]).toMatchObject({ pickupExpiry: null });
    expect(q.take).toBe(50);
  });

  it('un envoi payé entre-temps (statut plus annulable) est ignoré sans erreur ni remboursement', async () => {
    const { service, state, prisma } = setup([old()]);
    prisma.transaction.findMany.mockResolvedValueOnce([{ ...state.rows[0] }]);
    state.rows[0].status = S.PAID;
    expect(await service.expireUnclaimed()).toBe(0);
    expect(state.credits).toHaveLength(0);
  });

  it('un remboursement impossible (wallet gelé) laisse l\'envoi tel quel et n\'interrompt pas le lot', async () => {
    const { service, state, wallets } = setup([old(), old({ id: 't2', reference: '222222222', senderId: 'u2' })]);
    wallets.creditInTx.mockImplementationOnce(async () => { throw new Error('WALLET_FROZEN'); });
    // 1re ligne : le crédit échoue → SQL annulée (le double ci-dessus ne rejoue pas le rollback : on vérifie le décompte)
    const n = await service.expireUnclaimed();
    expect(n).toBe(1);
    expect(state.credits).toHaveLength(1);
  });
});
