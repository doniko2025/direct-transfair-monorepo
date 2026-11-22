// Paiement de factures : l'argent est conservé (débit client = crédit société), rien n'est écrit si le solde manque,
// une confirmation rejouée ne débite pas deux fois, le refus rembourse, le code secret et l'identité sont contrôlés AVANT tout mouvement.
import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { defaultSettings, mergeSettings } from '../company-settings/company-settings.logic';
import { BillConnectorsService } from './bills.connectors';
import { BillsService } from './bills.service';
import { BillsSettlementService } from './bills-settlement.service';

type J = Record<string, any>;

const USER: J = { id: 'u1', email: 'c@x.fr', firstName: 'Mamadou', lastName: 'Barry', role: 'USER', kycLevel: 'LEVEL_2', clientId: 7, isActive: true, isSuspended: false, deletedAt: null, primaryCurrency: 'GNF' };
const auth = { id: 'u1', role: 'USER' } as never;

const BILLER_BASE: J = {
  id: 'b1', clientId: 7, name: 'EDG Prépayé', category: 'ELECTRICITY', country: 'GN', currency: 'GNF', description: null, status: 'ACTIVE', connectorKey: 'manual',
  referenceLabel: 'N° de compteur', referenceHint: null, referencePattern: '^\\d{8,12}$', fields: [], amountMode: 'FREE', minAmount: null, maxAmount: null,
  feeFixed: 500, feePct: 1, partnershipStatus: 'NONE', settlementInfo: null, settlementDelayHours: 24, internalNote: null, sortOrder: 0,
};
const dec = (n: number) => ({ toString: () => String(n), minus: (o: J) => dec(n - Number(o)), valueOf: () => n, toNumber: () => n });

function setup(over: { biller?: J; enabled?: boolean; balance?: number; kyc?: () => Promise<void>; pin?: () => Promise<void>; company?: number; user?: J; daily?: J } = {}) {
  const db = {
    payments: [] as J[],
    transactions: [] as J[],
    saved: [] as J[],
    balances: { 'w:u1': over.balance ?? 100_000, 'w:co': over.company ?? 1_000_000 } as Record<string, number>,
    seq: 0,
  };
  const biller = { ...BILLER_BASE, ...(over.biller ?? {}) };
  let queue: Promise<unknown> = Promise.resolve();
  const snap = () => JSON.stringify({ p: db.payments, t: db.transactions, b: db.balances });
  const restore = (s: string) => {
    const o = JSON.parse(s, (k, v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v) : v));
    db.payments = o.p; db.transactions = o.t; db.balances = o.b;
  };
  const withBiller = (p: J | undefined) => (p ? { ...p, biller } : null);
  const num = (p: J) => ({ ...p, amount: dec(p.amount), fee: dec(p.fee), rate: dec(p.rate), amountCharged: dec(p.amountCharged), feeCharged: dec(p.feeCharged), totalCharged: dec(p.totalCharged) });
  const match = (r: J, w: J = {}): boolean =>
    Object.entries(w).every(([k, v]) => {
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        const x = v as J;
        if ('in' in x) return x.in.includes(r[k]);
        if ('not' in x) return r[k] !== x.not;
        if ('gte' in x) return r[k] >= x.gte;
        return true;
      }
      return r[k] === v;
    });

  const prisma: J = {
    user: { findUnique: jest.fn(async () => over.user ?? USER) },
    biller: { findFirst: jest.fn(async ({ where }: J) => (where.id === biller.id && biller.status === where.status ? biller : null)) },
    billPayment: {
      findUnique: jest.fn(async ({ where }: J) => {
        const k = where.payerId_idempotencyKey;
        const p = k ? db.payments.find((x) => x.payerId === k.payerId && x.idempotencyKey === k.idempotencyKey) : db.payments.find((x) => x.id === where.id || x.reference === where.reference);
        return withBiller(p ? num(p) : undefined);
      }),
      findFirst: jest.fn(async ({ where }: J) => withBiller(db.payments.filter((x) => match(x, { id: where.id, payerId: where.payerId }))[0]) ),
      create: jest.fn(async ({ data }: J) => {
        if (db.payments.some((x) => x.payerId === data.payerId && x.idempotencyKey === data.idempotencyKey)) { const e: any = new Error('dup'); e.code = 'P2002'; Object.setPrototypeOf(e, (require('@prisma/client').Prisma.PrismaClientKnownRequestError).prototype); e.clientVersion = 't'; throw e; }
        const p = { id: `p${++db.seq}`, status: 'SUBMITTED', createdAt: new Date(), completedAt: null, refundedAt: null, providerRef: null, token: null, receiptNote: null, failureReason: null, transactionId: null, refundTransactionId: null, ...data };
        db.payments.push(p);
        return withBiller(num(p));
      }),
      update: jest.fn(async ({ where, data }: J) => { const p = db.payments.find((x) => x.id === where.id)!; Object.assign(p, data); return p; }),
      updateMany: jest.fn(async ({ where, data }: J) => { const rows = db.payments.filter((r) => match(r, where)); rows.forEach((r) => Object.assign(r, data)); return { count: rows.length }; }),
      aggregate: jest.fn(async () => ({ _sum: { amount: dec(over.daily ?? 0) } })),
    },
    transaction: { create: jest.fn(async ({ data }: J) => { const t = { id: `t${db.transactions.length + 1}`, ...data }; db.transactions.push(t); return t; }) },
    savedBill: { count: jest.fn(async () => db.saved.length), findUnique: jest.fn(async () => null), upsert: jest.fn(async ({ create }: J) => { db.saved.push(create); return create; }) },
    wallet: { findFirst: jest.fn(async () => ({ balance: dec(db.balances['w:u1']), reservedBalance: dec(0) })) },
    auditLog: { create: jest.fn(async () => ({})) },
    $transaction: jest.fn(async (fn: (tx: J) => Promise<unknown>) => {
      const run = queue.then(async () => { const s = snap(); try { return await fn(prisma); } catch (e) { restore(s); throw e; } });
      queue = run.catch(() => undefined);
      return run;
    }),
  };

  const wallets: J = {
    getOrCreateWallet: jest.fn(async (p: J) => ({ id: p.userId ? `w:${p.userId}` : 'w:co' })),
    debitInTx: jest.fn(async (_tx: J, id: string, amount: number) => { if ((db.balances[id] ?? 0) < amount) throw new BadRequestException('Solde insuffisant'); db.balances[id] -= amount; }),
    creditInTx: jest.fn(async (_tx: J, id: string, amount: number) => { db.balances[id] = (db.balances[id] ?? 0) + amount; }),
  };
  const settings = { forClient: jest.fn(async () => mergeSettings({ bills: { enabled: over.enabled ?? true } })) };
  const rates = { getRateFor: jest.fn(async () => 0.0001) };
  const kyc = { assertVerified: jest.fn(over.kyc ?? (async () => undefined)) };
  const pins = { assertPin: jest.fn(over.pin ?? (async () => undefined)) };
  const notifier: J = { notifyUser: jest.fn(async () => undefined), notifyCompanyAdmins: jest.fn(async () => undefined) };
  const settlement = new BillsSettlementService(prisma as never, wallets as never, settings as never, notifier as never);
  const service = new BillsService(prisma as never, wallets as never, rates as never, kyc as never, pins as never, settings as never, new BillConnectorsService(), settlement, notifier as never);
  return { service, db, prisma, wallets, kyc, pins, notifier, settlement, rates };
}

const dto = (o: J = {}) => ({ reference: '0123456789', amount: 20_000, pin: '123456', idempotencyKey: 'key-00000001', ...o }) as never;

describe('BillsService.pay', () => {
  it('manuel : débit client = crédit société, facture « à régler », société prévenue', async () => {
    const { service, db, notifier } = setup();
    const r = await service.pay(auth, 'b1', dto());
    // 20 000 + frais (500 + 1 % = 700) = 20 700
    expect(r.status).toBe('SUBMITTED');
    expect(r.totalCharged).toBe(20_700);
    expect(db.balances['w:u1']).toBe(100_000 - 20_700);
    expect(db.balances['w:co']).toBe(1_000_000 + 20_700);
    expect(db.transactions).toHaveLength(1);
    expect(db.transactions[0]).toMatchObject({ type: 'BILL_PAYMENT', total: 20_700, senderId: 'u1' });
    expect(notifier.notifyCompanyAdmins).toHaveBeenCalledWith(7, expect.objectContaining({ kind: 'BILL_TO_SETTLE' }));
    expect(r.expectedBy).toBeInstanceOf(Date);
    expect(r.receiptCode).toBeNull();
  });

  it('confirmation rejouée (même clé) : même facture, aucun second débit', async () => {
    const { service, db } = setup();
    const a = await service.pay(auth, 'b1', dto());
    const b = await service.pay(auth, 'b1', dto());
    expect(b.id).toBe(a.id);
    expect(db.payments).toHaveLength(1);
    expect(db.balances['w:u1']).toBe(100_000 - 20_700);
  });

  it('deux confirmations simultanées (même clé) : un seul paiement', async () => {
    const { service, db } = setup();
    const [a, b] = await Promise.all([service.pay(auth, 'b1', dto()), service.pay(auth, 'b1', dto())]);
    expect(a.id).toBe(b.id);
    expect(db.payments).toHaveLength(1);
    expect(db.balances['w:u1']).toBe(100_000 - 20_700);
  });

  it('solde insuffisant : rien débité, rien enregistré', async () => {
    const { service, db } = setup({ balance: 10_000 });
    await expect(service.pay(auth, 'b1', dto())).rejects.toThrow(/solde/i);
    expect(db.payments).toHaveLength(0);
    expect(db.transactions).toHaveLength(0);
    expect(db.balances['w:u1']).toBe(10_000);
    expect(db.balances['w:co']).toBe(1_000_000);
  });

  it('identité non vérifiée ou code secret faux : aucun mouvement', async () => {
    const k = setup({ kyc: async () => { throw new ForbiddenException('KYC'); } });
    await expect(k.service.pay(auth, 'b1', dto())).rejects.toThrow(ForbiddenException);
    expect(k.db.payments).toHaveLength(0);
    expect(k.pins.assertPin).not.toHaveBeenCalled();
    const p = setup({ pin: async () => { throw new ForbiddenException('PIN'); } });
    await expect(p.service.pay(auth, 'b1', dto())).rejects.toThrow(ForbiddenException);
    expect(p.db.balances['w:u1']).toBe(100_000);
    expect(p.db.payments).toHaveLength(0);
  });

  it('fonction fermée, mauvais rôle, facturier inactif : refusés', async () => {
    await expect(setup({ enabled: false }).service.pay(auth, 'b1', dto())).rejects.toThrow(/pas disponible/);
    await expect(setup({ user: { ...USER, role: 'COMPANY_ADMIN' } }).service.pay(auth, 'b1', dto())).rejects.toThrow(ForbiddenException);
    await expect(setup({ biller: { status: 'SUSPENDED' } }).service.pay(auth, 'b1', dto())).rejects.toThrow(NotFoundException);
  });

  it('référence au mauvais format, montant hors bornes, plafond par facture et par jour : refusés', async () => {
    const s = setup({ biller: { minAmount: 1000, maxAmount: 50_000 } });
    await expect(s.service.pay(auth, 'b1', dto({ reference: 'abc' }))).rejects.toThrow(/bon format/);
    await expect(s.service.pay(auth, 'b1', dto({ amount: 500 }))).rejects.toThrow(BadRequestException);
    await expect(s.service.pay(auth, 'b1', dto({ amount: 60_000 }))).rejects.toThrow(BadRequestException);
    const big = setup();
    await expect(big.service.pay(auth, 'b1', dto({ amount: defaultSettings().bills.maxPerPayment.GNF! + 1 }))).rejects.toThrow(/ne peut pas dépasser/);
    const day = setup({ daily: defaultSettings().bills.maxPerDay.GNF! - 1000 });
    await expect(day.service.pay(auth, 'b1', dto({ amount: 5000 }))).rejects.toThrow(/par jour/);
    expect(day.db.payments).toHaveLength(0);
  });

  it('portefeuille dans une autre devise : converti au taux de la société, total = facture + frais', async () => {
    const { service, db, rates } = setup();
    db.balances['w:u1'] = 500;
    const r = await service.pay(auth, 'b1', dto({ walletCurrency: 'EUR' }));
    expect(rates.getRateFor).toHaveBeenCalledWith('GNF', 'EUR', 7);
    expect(r.walletCurrency).toBe('EUR');
    expect(r.totalCharged).toBeCloseTo(r.amountCharged + r.feeCharged, 8);
  });

  it('simulation : règlement automatique, reçu et jeton immédiats', async () => {
    const { service, db, notifier } = setup({ biller: { connectorKey: 'sandbox' } });
    const r = await service.pay(auth, 'b1', dto());
    expect(r.status).toBe('COMPLETED');
    expect(r.simulated).toBe(true);
    expect(r.providerRef).toMatch(/^SANDBOX-FAC-/);
    expect(r.token).toBeTruthy();
    expect(r.receiptCode).toMatch(/^FAC-.+\..{22}$/);
    expect(notifier.notifyUser).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: 'BILL_COMPLETED' }));
    expect(db.balances['w:u1']).toBe(100_000 - 20_700);
  });

  it('simulation « échec » : le client est remboursé (frais compris par défaut)', async () => {
    const { service, db } = setup({ biller: { connectorKey: 'sandbox', referencePattern: null } });
    const r = await service.pay(auth, 'b1', dto({ reference: 'FAIL-1234' }));
    expect(r.status).toBe('REFUNDED');
    expect(r.failureReason).toMatch(/refusé/);
    expect(db.balances['w:u1']).toBe(100_000);
    expect(db.balances['w:co']).toBe(1_000_000);
    expect(db.transactions.map((t) => t.type)).toEqual(['BILL_PAYMENT', 'BILL_REFUND']);
  });

  it('facture enregistrée : « saveAs » crée l\'entrée, sans jamais bloquer le paiement', async () => {
    const { service, db } = setup();
    await service.pay(auth, 'b1', dto({ saveAs: 'Maison' }));
    expect(db.saved).toHaveLength(1);
    expect(db.saved[0]).toMatchObject({ label: 'Maison', accountRef: '0123456789' });
  });
});

describe('BillsSettlementService', () => {
  it('refus : un second traitement est refusé, une seule restitution', async () => {
    const { service, db, settlement } = setup();
    const r = await service.pay(auth, 'b1', dto());
    await settlement.fail(r.id, { reason: 'Facturier injoignable' });
    await expect(settlement.fail(r.id, { reason: 'encore' })).rejects.toThrow(ConflictException);
    await expect(settlement.complete(r.id, { providerRef: 'X' })).rejects.toThrow(ConflictException);
    expect(db.balances['w:u1']).toBe(100_000);
    expect(db.balances['w:co']).toBe(1_000_000);
  });

  it('refus sans les frais : seuls les frais restent à la société', async () => {
    const { service, db, settlement } = setup();
    const r = await service.pay(auth, 'b1', dto());
    await settlement.fail(r.id, { reason: 'Refusé', refundFee: false });
    expect(db.balances['w:u1']).toBe(100_000 - 700);
    expect(db.balances['w:co']).toBe(1_000_000 + 700);
  });

  it('société sans fonds pour rembourser : message clair, facture inchangée', async () => {
    const { service, db, settlement } = setup();
    const r = await service.pay(auth, 'b1', dto());
    db.balances['w:co'] = 0;
    await expect(settlement.fail(r.id, { reason: 'Refusé' })).rejects.toThrow(/approvisionnez/i);
    expect(db.payments[0].status).toBe('SUBMITTED');
  });

  it('réglée : la facture passe à COMPLETED avec le reçu du facturier, une seule fois', async () => {
    const { service, db, settlement } = setup();
    const r = await service.pay(auth, 'b1', dto());
    await settlement.markProcessing(r.id, 'admin1');
    await settlement.complete(r.id, { providerRef: 'EDG-998', token: '1111 2222', processedById: 'admin1' });
    expect(db.payments[0]).toMatchObject({ status: 'COMPLETED', providerRef: 'EDG-998', token: '1111 2222' });
    await expect(settlement.complete(r.id, { providerRef: 'EDG-999' })).rejects.toThrow(ConflictException);
  });
});

describe('BillsService — lecture', () => {
  it('quote : solde insuffisant signalé sans rien écrire ; titulaire masqué', async () => {
    const { service, db } = setup({ balance: 100, biller: { connectorKey: 'sandbox' } });
    const q = await service.quote(auth, 'b1', dto() as never);
    expect(q.sufficient).toBe(false);
    expect(q.customerName).toMatch(/^Client T\./);
    expect(db.payments).toHaveLength(0);
  });

  it('montant fourni par le facturier + connecteur qui sait interroger (simulation) : le montant vient de la recherche, pas du client', async () => {
    const { service } = setup({ biller: { connectorKey: 'sandbox', amountMode: 'FROM_LOOKUP', feeFixed: 0, feePct: 0 } });
    const lookup = await service.lookup(auth, 'b1', { reference: '0123456789' } as never);
    expect(lookup.supported).toBe(true);
    expect(lookup.amountDue).toBeGreaterThan(0);
    const q = await service.quote(auth, 'b1', dto({ amount: 1 }) as never);
    expect(q.amount).toBe(lookup.amountDue);
  });

  it('facturier mal réglé (montant du facturier mais connecteur manuel, sans recherche) : le client saisit le montant au lieu d\'être bloqué', async () => {
    const { service } = setup({ biller: { connectorKey: 'manual', amountMode: 'FROM_LOOKUP', feeFixed: 0, feePct: 0 } });
    const lookup = await service.lookup(auth, 'b1', { reference: '0123456789' } as never);
    expect(lookup.supported).toBe(false);
    const q = await service.quote(auth, 'b1', dto({ amount: 20_000 }) as never);
    expect(q.amount).toBe(20_000);
  });

  it('un client ne lit pas la facture d\'un autre', async () => {
    const { service } = setup();
    await expect(service.getOne(auth, 'inconnue')).rejects.toThrow(NotFoundException);
  });
});
