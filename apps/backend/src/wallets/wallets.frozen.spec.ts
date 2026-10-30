// apps/backend/src/wallets/wallets.frozen.spec.ts
// Audit points 6 et 9 (wallets v5.7) — gel de wallet appliqué, arrondi du montant converti, transfert vers soi-même.
import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WalletsService } from './wallets.service';

const D = (n: number) => new Prisma.Decimal(n);

function makeDb(wallets: Record<string, any>, rate = 1) {
  const state: Record<string, number> = Object.fromEntries(Object.entries(wallets).map(([id, w]) => [id, Number(w.balance)]));
  const ledger: any[] = [];
  const db: any = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    wallet: {
      // ✅ audit : transferInTx() lit d'abord les devises des deux wallets (avant la prise des verrous)
      findMany: jest.fn().mockImplementation(async ({ where }: any) =>
        (where.id.in as string[]).filter((id) => wallets[id]).map((id) => ({ id, currency: wallets[id].currency }))),
      findUnique: jest.fn().mockImplementation(async ({ where }: any) => ({ ...wallets[where.id], balance: D(state[where.id]) })),
      update: jest.fn().mockImplementation(async ({ where, data }: any) => {
        if (data.balance?.increment) state[where.id] += Number(data.balance.increment);
        if (data.balance?.decrement) state[where.id] -= Number(data.balance.decrement);
        return { ...wallets[where.id], balance: D(state[where.id]) };
      }),
    },
    ledgerEntry: {
      create: jest.fn().mockImplementation(async ({ data }: any) => { ledger.push(data); return data; }),
      createMany: jest.fn().mockImplementation(async ({ data }: any) => { ledger.push(...data); return { count: data.length }; }),
    },
  };
  const prisma: any = { $transaction: jest.fn().mockImplementation((fn: any) => fn(db)) };
  // ✅ audit : transferInTx() convertit avec RatesService.convert() (taux de la base) et non plus getRate()
  const rates: any = { convert: jest.fn().mockImplementation(async (amount: number) => amount * rate) };
  return { service: new WalletsService(prisma, rates), state, ledger, db };
}

const w = (over: any = {}) => ({ currency: 'XOF', balance: D(1000), reservedBalance: D(0), isFrozen: false, frozenReason: null, ...over });

describe('WalletsService v5.7 — wallet gelé', () => {
  const frozen = { id: 'w1', ...w({ isFrozen: true, frozenReason: 'Contrôle LCB-FT' }) };

  it('debitInTx refuse un wallet gelé (403 WALLET_FROZEN) sans rien écrire', async () => {
    const { service, db, ledger, state } = makeDb({ w1: frozen });
    await expect(service.debitInTx(db, 'w1', 10, 'x')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.debitInTx(db, 'w1', 10, 'x')).rejects.toMatchObject({ response: { code: 'WALLET_FROZEN' } });
    expect(state.w1).toBe(1000);
    expect(ledger).toHaveLength(0);
  });

  it('creditInTx avec { allowFrozen: true } (commission d\'un tiers) crédite quand même et journalise (v5.8)', async () => {
    const { service, db, ledger, state } = makeDb({ w1: frozen });
    await service.creditInTx(db, 'w1', 10, 'Commission', 't1', { allowFrozen: true });
    expect(state.w1).toBe(1010);
    expect(ledger).toHaveLength(1);
    // sans l'option, toujours refusé
    await expect(service.creditInTx(db, 'w1', 10, 'x', 't1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(state.w1).toBe(1010);
  });

  it('creditInTx refuse un wallet gelé, et le message donne le motif', async () => {
    const { service, db, ledger } = makeDb({ w1: frozen });
    await expect(service.creditInTx(db, 'w1', 10, 'x')).rejects.toThrow(/Contrôle LCB-FT/);
    expect(ledger).toHaveLength(0);
  });

  it('hold refuse un wallet gelé', async () => {
    const { service } = makeDb({ w1: frozen });
    await expect(service.hold('w1', 10, 'x')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('transferInTx refuse si la SOURCE ou la DESTINATION est gelée', async () => {
    const a = makeDb({ w1: frozen, w2: { id: 'w2', ...w() } });
    await expect(a.service.transferInTx(a.db, { fromWalletId: 'w1', toWalletId: 'w2', amount: 10, description: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
    const b = makeDb({ w1: { id: 'w1', ...w() }, w2: { id: 'w2', ...w({ isFrozen: true }) } });
    await expect(b.service.transferInTx(b.db, { fromWalletId: 'w1', toWalletId: 'w2', amount: 10, description: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(b.state).toEqual({ w1: 1000, w2: 1000 });
    expect(b.ledger).toHaveLength(0);
  });

  it('un wallet non gelé fonctionne comme avant', async () => {
    const { service, db, state } = makeDb({ w1: { id: 'w1', ...w() } });
    await service.creditInTx(db, 'w1', 50, 'x');
    await service.debitInTx(db, 'w1', 20, 'y');
    expect(state.w1).toBe(1030);
  });
});

describe('WalletsService v5.7 — transferInTx', () => {
  it('refuse un transfert d\'un wallet vers lui-même', async () => {
    const { service, db, ledger } = makeDb({ w1: { id: 'w1', ...w() } });
    await expect(service.transferInTx(db, { fromWalletId: 'w1', toWalletId: 'w1', amount: 10, description: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    expect(ledger).toHaveLength(0);
  });

  it('arrondit le montant converti à la devise de destination (XOF : unités entières)', async () => {
    // 100 EUR × 655,957 = 65 595,7 XOF → 65 596 XOF
    const { service, db, state } = makeDb({ e: { id: 'e', ...w({ currency: 'EUR' }) }, x: { id: 'x', ...w({ currency: 'XOF', balance: D(0) }) } }, 655.957);
    await service.transferInTx(db, { fromWalletId: 'e', toWalletId: 'x', amount: 100, description: 'change' });
    expect(state.x).toBe(65596);
    expect(state.e).toBe(900);
  });

  it('arrondit à 2 décimales pour une devise décimale (XOF → EUR)', async () => {
    const { service, db, state } = makeDb({ x: { id: 'x', ...w({ currency: 'XOF' }) }, e: { id: 'e', ...w({ currency: 'EUR', balance: D(0) }) } }, 0.0015245);
    await service.transferInTx(db, { fromWalletId: 'x', toWalletId: 'e', amount: 1000, description: 'change' });
    expect(state.e).toBe(1.52);
  });

  it('montant converti nul après arrondi → refusé, rien d\'écrit', async () => {
    const { service, db, ledger } = makeDb({ e: { id: 'e', ...w({ currency: 'EUR' }) }, x: { id: 'x', ...w({ currency: 'XOF', balance: D(0) }) } }, 655.957);
    await expect(service.transferInTx(db, { fromWalletId: 'e', toWalletId: 'x', amount: 0.0005, description: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    expect(ledger).toHaveLength(0);
  });
});
