// apps/backend/src/wallets/wallets.service.spec.ts
// Phase 6 (v5.5) — creditInTx / debitInTx / creditOnce.
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WalletsService } from './wallets.service';

const D = (n: number) => new Prisma.Decimal(n);

function makeDb(wallet = { id: 'w1', currency: 'XOF', balance: D(100), reservedBalance: D(0) }) {
  const state = { balance: Number(wallet.balance), ledger: [] as any[] };
  const db: any = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    wallet: {
      findUnique: jest.fn().mockImplementation(async () => ({ ...wallet, balance: D(state.balance) })),
      update: jest.fn().mockImplementation(async ({ data }: any) => {
        if (data.balance?.increment) state.balance += Number(data.balance.increment);
        if (data.balance?.decrement) state.balance -= Number(data.balance.decrement);
        return { ...wallet, balance: D(state.balance) };
      }),
    },
    ledgerEntry: {
      create: jest.fn().mockImplementation(async ({ data }: any) => { state.ledger.push(data); return data; }),
      findFirst: jest.fn().mockImplementation(async ({ where }: any) =>
        state.ledger.find((e) => e.walletId === where.walletId && e.transactionId === where.transactionId && e.type === where.type) ?? null),
    },
  };
  const prisma: any = { $transaction: jest.fn().mockImplementation((fn: any) => fn(db)) };
  return { service: new WalletsService(prisma, {} as any), state, db, prisma };
}

describe('WalletsService v5.5', () => {
  it('credit() délègue à creditInTx (même résultat qu\'avant)', async () => {
    const { service, state } = makeDb();
    const res = await service.credit('w1', 50, 'test', 'tx1');
    expect(res.balance).toBe(150);
    expect(state.ledger).toHaveLength(1);
    expect(state.ledger[0]).toMatchObject({ type: 'CREDIT', transactionId: 'tx1' });
  });

  it('debit() refuse un solde insuffisant et n\'écrit rien', async () => {
    const { service, state } = makeDb();
    await expect(service.debit('w1', 500, 'x')).rejects.toBeInstanceOf(BadRequestException);
    expect(state.balance).toBe(100);
    expect(state.ledger).toHaveLength(0);
  });

  it('creditInTx / debitInTx travaillent sur le client Prisma fourni (pas de $transaction propre)', async () => {
    const { service, db, prisma } = makeDb();
    await service.creditInTx(db, 'w1', 10, 'a');
    await service.debitInTx(db, 'w1', 5, 'b');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creditOnce ne crédite qu\'une fois pour la même transaction', async () => {
    const { service, state } = makeDb();
    expect(await service.creditOnce('w1', 40, 'Recharge', 'tx9')).toBe(true);
    expect(await service.creditOnce('w1', 40, 'Recharge', 'tx9')).toBe(false);
    expect(state.balance).toBe(140);
    expect(state.ledger).toHaveLength(1);
  });

  it('creditOnce crédite deux transactions différentes', async () => {
    const { service, state } = makeDb();
    await service.creditOnce('w1', 10, 'a', 'txA');
    await service.creditOnce('w1', 10, 'b', 'txB');
    expect(state.balance).toBe(120);
  });
});
