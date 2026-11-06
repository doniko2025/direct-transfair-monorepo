// apps/backend/src/wallets/money.spec.ts
// Audit argent (v5.10) — un montant est arrondi UNE fois à 4 décimales, et le solde et le journal portent la même valeur.
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toMoney } from './money';
import { WalletsService } from './wallets.service';

const D = (n: number | string) => new Prisma.Decimal(n);

describe('toMoney', () => {
  it('garde un montant propre tel quel', () => {
    expect(toMoney(1250).toString()).toBe('1250');
    expect(toMoney('99.9999').toString()).toBe('99.9999');
  });

  it('arrondit à 4 décimales, demi vers le haut', () => {
    expect(toMoney(0.00005).toString()).toBe('0.0001');
    expect(toMoney(10.00005).toString()).toBe('10.0001');
    expect(toMoney(1.23454).toString()).toBe('1.2345');
  });

  it('nettoie le bruit des flottants (0.1 + 0.2)', () => {
    expect(toMoney(0.1 + 0.2).toString()).toBe('0.3');
  });

  it('refuse NaN, infini, zéro, négatif et ce qui devient nul après arrondi', () => {
    for (const bad of [NaN, Infinity, -Infinity, 0, -5, 0.00001, 'abc', '']) {
      expect(() => toMoney(bad as any)).toThrow(BadRequestException);
    }
  });
});

function makeDb() {
  const state = { balance: D(100), ledger: [] as any[], updates: [] as any[] };
  const wallet = { id: 'w1', currency: 'XOF', reservedBalance: D(0), isFrozen: false };
  const db: any = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    wallet: {
      findUnique: jest.fn().mockImplementation(async () => ({ ...wallet, balance: state.balance })),
      update: jest.fn().mockImplementation(async ({ data }: any) => {
        state.updates.push(data);
        if (data.balance?.increment) state.balance = state.balance.plus(data.balance.increment);
        if (data.balance?.decrement) state.balance = state.balance.minus(data.balance.decrement);
        return { ...wallet, balance: state.balance };
      }),
    },
    ledgerEntry: { create: jest.fn().mockImplementation(async ({ data }: any) => { state.ledger.push(data); return data; }) },
  };
  return { service: new WalletsService({} as any, {} as any), db, state };
}

describe('WalletsService — montant normalisé avant écriture', () => {
  it('creditInTx : le solde et le journal reçoivent exactement la même valeur arrondie', async () => {
    const { service, db, state } = makeDb();
    await service.creditInTx(db, 'w1', 0.30000000000000004, 'test', 'tx1');
    expect(state.updates[0].balance.increment.toString()).toBe('0.3');
    expect(state.ledger[0].amount.toString()).toBe('0.3');
    expect(state.balance.toString()).toBe('100.3');
  });

  it('debitInTx : un montant à 5 décimales est arrondi avant de toucher le solde', async () => {
    const { service, db, state } = makeDb();
    await service.debitInTx(db, 'w1', 10.00005, 'test', 'tx1');
    expect(state.updates[0].balance.decrement.toString()).toBe('10.0001');
    expect(state.ledger[0].amount.toString()).toBe('10.0001');
    expect(state.balance.toString()).toBe('89.9999');
  });

  it('un montant qui devient nul après arrondi est refusé, rien n\'est écrit', async () => {
    const { service, db, state } = makeDb();
    await expect(service.creditInTx(db, 'w1', 0.00001, 'x')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.debitInTx(db, 'w1', NaN, 'x')).rejects.toBeInstanceOf(BadRequestException);
    expect(state.updates).toHaveLength(0);
    expect(state.ledger).toHaveLength(0);
  });

  it('crédit puis débit du même montant fractionnaire : le solde revient exactement à son point de départ', async () => {
    const { service, db, state } = makeDb();
    await service.creditInTx(db, 'w1', 0.00005, 'a');
    await service.debitInTx(db, 'w1', 0.00005, 'b');
    expect(state.balance.toString()).toBe('100');
  });
});
