// apps/backend/src/merchants/merchant-payouts.service.spec.ts
// Retraits : débit immédiat, commission seulement si payé, recrédit intégral si refusé, délai de sécurité, un retrait ne se traite qu'une fois.
import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

import { MerchantPayoutsService, PAYOUT_LOCKED_CODE } from './merchant-payouts.service';

type J = Record<string, any>;

const baseSettings = {
  enabled: true, paymentFeePct: 1, qrValidityMinutes: 5, phoneRequestValidityMinutes: 30, payoutFeePct: 2,
  payoutMethods: ['ORANGE_MONEY', 'BANK_TRANSFER'], payoutMode: 'MANUAL', payoutCooldownHours: 24,
  minPayment: {}, maxPayment: {}, minPayout: { XOF: 1000 },
};
const baseProfile = { businessName: 'Boutique Awa', orangeMoneyPhone: '+224620000001', bankIban: null, bankHolderName: null, destinationChangedAt: null as Date | null, status: 'ACTIVE' };
const me = { id: 'mer', email: 'm@x.fr', firstName: 'Awa', role: 'USER', kycLevel: 'LEVEL_2', clientId: 7, primaryCurrency: 'XOF', isActive: true, isSuspended: false, deletedAt: null };
const admin = { id: 'adm', role: 'COMPANY_ADMIN', clientId: 7 } as any;
const asMer = { id: 'mer', sub: 'mer', role: 'USER', clientId: 7 } as any;

function setup(over: { settings?: J; profile?: J; balance?: number; pin?: () => Promise<void>; kyc?: () => Promise<void> } = {}) {
  const db = { payouts: [] as J[], transactions: [] as J[], balances: { 'w:mer': over.balance ?? 100_000, 'w:company': 0 } as Record<string, number>, seq: 0 };
  let queue: Promise<unknown> = Promise.resolve();
  const snap = () => JSON.stringify(db);
  const restore = (s: string) => { const o = JSON.parse(s, (k, v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v) : v)); Object.assign(db, o); };
  const match = (r: J, w: J = {}) => Object.entries(w).every(([k, v]) => r[k] === v);
  const prisma: J = {
    user: { findUnique: jest.fn(async () => me), findMany: jest.fn(async () => [{ id: 'adm', email: 'a@x.fr', firstName: 'Admin' }]) },
    merchantPayout: {
      count: jest.fn(async ({ where }: J) => db.payouts.filter((p) => match(p, where)).length),
      create: jest.fn(async ({ data }: J) => { const p = { id: `p${++db.seq}`, status: 'PENDING', createdAt: new Date(), processedAt: null, providerRef: null, failureReason: null, ...data }; db.payouts.push(p); return p; }),
      findUnique: jest.fn(async ({ where }: J) => db.payouts.find((p) => p.id === where.id) ?? null),
      findUniqueOrThrow: jest.fn(async ({ where }: J) => db.payouts.find((p) => p.id === where.id)!),
      findFirst: jest.fn(async ({ where }: J) => db.payouts.find((p) => match(p, where)) ?? null),
      findMany: jest.fn(async ({ where }: J) => db.payouts.filter((p) => match(p, where))),
      updateMany: jest.fn(async ({ where, data }: J) => { const rows = db.payouts.filter((p) => match(p, where)); rows.forEach((p) => Object.assign(p, data)); return { count: rows.length }; }),
    },
    transaction: {
      create: jest.fn(async ({ data }: J) => { const t = { id: `t${db.transactions.length + 1}`, ...data }; db.transactions.push(t); return t; }),
      update: jest.fn(async ({ where, data }: J) => { Object.assign(db.transactions.find((t) => t.id === where.id)!, data); return {}; }),
    },
    auditLog: { create: jest.fn(async () => ({})) },
    $transaction: jest.fn((fn: (tx: J) => Promise<any>) => {
      const run = queue.then(async () => { const s = snap(); try { return await fn(prisma); } catch (e) { restore(s); throw e; } });
      queue = run.catch(() => undefined);
      return run;
    }),
  };
  const wallets = {
    getOrCreateWallet: jest.fn(async ({ userId }: J) => ({ id: userId ? `w:${userId}` : 'w:company', currency: 'XOF' })),
    debitInTx: jest.fn(async (_t: J, id: string, amount: number) => { if (db.balances[id] < amount) throw new BadRequestException('Solde insuffisant: 0 XOF'); db.balances[id] -= amount; }),
    creditInTx: jest.fn(async (_t: J, id: string, amount: number) => { db.balances[id] += amount; }),
  };
  const settings = { ...baseSettings, ...(over.settings ?? {}) };
  const profile = { ...baseProfile, ...(over.profile ?? {}) };
  const kyc = { assertVerified: jest.fn(over.kyc ?? (async () => undefined)) };
  const pins = { assertPin: jest.fn(over.pin ?? (async () => undefined)) };
  const merchants = { assertActiveMerchant: jest.fn(async () => ({ profile, settings })) };
  const notifier = { notifyUser: jest.fn(async () => undefined) };
  const service = new MerchantPayoutsService(prisma as any, wallets as any, kyc as any, pins as any, merchants as any, notifier as any);
  return { service, db, wallets, kyc, pins, notifier };
}

const dto = (o: J = {}) => ({ pin: '486213', amount: 10_000, method: 'ORANGE_MONEY' as const, ...o });
const sum = (b: Record<string, number>) => Object.values(b).reduce((a, x) => a + x, 0);

describe('demande de retrait', () => {
  it('débite tout de suite, fige la destination, crée une opération en attente, prévient marchand et administrateurs', async () => {
    const { service, db, notifier } = setup();
    const v = await service.request(asMer, dto());
    expect(v).toMatchObject({ status: 'PENDING', amount: 10_000, fee: 200, netAmount: 9_800, destination: expect.stringContaining('•••') });
    expect(db.balances['w:mer']).toBe(90_000);
    expect(db.payouts[0]).toMatchObject({ destination: '+224620000001', method: 'ORANGE_MONEY' });
    expect(db.transactions[0]).toMatchObject({ type: 'MERCHANT_PAYOUT', status: 'PENDING', platformCommission: 200, receivedAmount: 9_800 });
    const kinds = notifier.notifyUser.mock.calls.map((c: any[]) => c[1].kind);
    expect(kinds).toEqual(expect.arrayContaining(['PAYOUT_REQUESTED', 'PAYOUT_PENDING_ADMIN']));
  });

  it('code secret et identité vérifiés avant tout débit', async () => {
    const a = setup({ pin: async () => { throw new ForbiddenException({ code: 'PIN_INVALID' }); } });
    await expect(a.service.request(asMer, dto({ pin: '000000' }))).rejects.toBeInstanceOf(ForbiddenException);
    expect(a.wallets.debitInTx).not.toHaveBeenCalled();
    const b = setup({ kyc: async () => { throw new ForbiddenException({ code: 'KYC_REQUIRED' }); } });
    await expect(b.service.request(asMer, dto())).rejects.toBeInstanceOf(ForbiddenException);
    expect(b.pins.assertPin).not.toHaveBeenCalled();
  });

  it('solde insuffisant : rien d’écrit', async () => {
    const { service, db } = setup({ balance: 5_000 });
    await expect(service.request(asMer, dto())).rejects.toThrow(/Solde insuffisant/);
    expect(db.payouts).toHaveLength(0);
    expect(db.transactions).toHaveLength(0);
    expect(db.balances['w:mer']).toBe(5_000);
  });

  it('refuse : minimum, moyen fermé, destination absente, centimes en XOF', async () => {
    const { service } = setup();
    await expect(service.request(asMer, dto({ amount: 500 }))).rejects.toThrow(/minimum/);
    await expect(service.request(asMer, dto({ method: 'BANK_TRANSFER' }))).rejects.toThrow(/Renseignez cette destination/);
    await expect(setup({ settings: { payoutMethods: ['BANK_TRANSFER'] } }).service.request(asMer, dto())).rejects.toThrow(/pas ouvert/);
    await expect(service.request(asMer, dto({ amount: 1500.5 }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('délai de sécurité après un changement de destination : 403 PAYOUT_LOCKED, rien débité', async () => {
    const { service, db } = setup({ profile: { destinationChangedAt: new Date(Date.now() - 2 * 3_600_000) } });
    const err: any = await service.request(asMer, dto()).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse()).toMatchObject({ code: PAYOUT_LOCKED_CODE });
    expect(db.balances['w:mer']).toBe(100_000);
    // passé le délai, c'est possible
    const ok = setup({ profile: { destinationChangedAt: new Date(Date.now() - 30 * 3_600_000) } });
    await expect(ok.service.request(asMer, dto())).resolves.toMatchObject({ status: 'PENDING' });
  });

  it('SANDBOX : payé aussitôt (hors production)', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    try {
      const { service, db } = setup({ settings: { payoutMode: 'SANDBOX' } });
      const v = await service.request(asMer, dto());
      expect(v.status).toBe('PAID');
      expect(db.balances['w:company']).toBe(200);
      expect(db.balances['w:mer']).toBe(90_000);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('SANDBOX en production : forcé en manuel', async () => {
    const prev = { n: process.env.NODE_ENV, a: process.env.ALLOW_SANDBOX_PAYOUTS };
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_SANDBOX_PAYOUTS;
    try {
      const { service } = setup({ settings: { payoutMode: 'SANDBOX' } });
      expect((await service.request(asMer, dto())).status).toBe('PENDING');
    } finally {
      process.env.NODE_ENV = prev.n;
      if (prev.a !== undefined) process.env.ALLOW_SANDBOX_PAYOUTS = prev.a;
    }
  });

  it('limite de retraits en attente', async () => {
    const { service } = setup();
    for (let i = 0; i < 5; i++) await service.request(asMer, dto({ amount: 1000 }));
    await expect(service.request(asMer, dto({ amount: 1000 }))).rejects.toThrow(/plusieurs retraits/);
  });
});

describe('traitement par l’administrateur', () => {
  it('payé : commission versée à la société, opération PAID, marchand prévenu, argent conservé', async () => {
    const { service, db, notifier } = setup();
    const before = sum(db.balances);
    const v = await service.request(asMer, dto());
    const out = await service.markPaid(admin, v.id, { providerRef: 'OM-998' });
    expect(out).toMatchObject({ status: 'PAID', providerRef: 'OM-998' });
    expect(db.balances).toMatchObject({ 'w:mer': 90_000, 'w:company': 200 });
    expect(db.transactions[0].status).toBe('PAID');
    // 9 800 sortent de la plateforme vers l'Orange du marchand : le reste est conservé
    expect(before - sum(db.balances)).toBe(9_800);
    expect(notifier.notifyUser.mock.calls.some((c: any[]) => c[1].kind === 'PAYOUT_PAID')).toBe(true);
  });

  it('refusé : recrédit intégral, pas de commission, opération annulée', async () => {
    const { service, db } = setup();
    const v = await service.request(asMer, dto());
    const out = await service.reject(admin, v.id, { reason: 'Numéro Orange injoignable' });
    expect(out.status).toBe('REJECTED');
    expect(db.balances).toMatchObject({ 'w:mer': 100_000, 'w:company': 0 });
    expect(db.transactions[0].status).toBe('CANCELLED');
  });

  it('un retrait ne se traite qu’une fois (double clic, payé puis refusé)', async () => {
    const { service, db } = setup();
    const v = await service.request(asMer, dto());
    await service.markPaid(admin, v.id, {});
    await expect(service.markPaid(admin, v.id, {})).rejects.toBeInstanceOf(ConflictException);
    await expect(service.reject(admin, v.id, { reason: 'motif valable' })).rejects.toBeInstanceOf(ConflictException);
    expect(db.balances['w:company']).toBe(200);
    expect(db.balances['w:mer']).toBe(90_000);
  });

  it('deux administrateurs en même temps : un seul gagne', async () => {
    const { service, db } = setup();
    const v = await service.request(asMer, dto());
    const [a, b] = await Promise.allSettled([service.reject(admin, v.id, { reason: 'motif valable' }), service.markPaid(admin, v.id, {})]);
    expect([a.status, b.status].sort()).toEqual(['fulfilled', 'rejected']);
    expect(db.balances['w:mer'] + db.balances['w:company']).toBeGreaterThanOrEqual(90_000);
    const paid = db.payouts[0].status === 'PAID';
    expect(db.balances['w:mer']).toBe(paid ? 90_000 : 100_000);
  });

  it('autre société : introuvable', async () => {
    const { service } = setup();
    const v = await service.request(asMer, dto());
    await expect(service.markPaid({ id: 'x', role: 'COMPANY_ADMIN', clientId: 99 } as any, v.id, {})).rejects.toThrow(/introuvable/);
  });

  it('la liste administrateur montre la vraie destination, celle du marchand la masque', async () => {
    const { service } = setup();
    await service.request(asMer, dto());
    const mine = await service.listMine(asMer, {});
    expect(mine.data[0].destination).not.toBe('+224620000001');
  });
});
