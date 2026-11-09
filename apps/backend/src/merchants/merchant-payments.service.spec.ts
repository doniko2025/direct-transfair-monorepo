// apps/backend/src/merchants/merchant-payments.service.spec.ts
// Encaissements marchands : l'argent est conservé (débit = crédit marchand + commission), un QR ne se paie qu'une fois,
// un solde insuffisant ne débite rien, le code secret et l'identité sont contrôlés AVANT tout mouvement.
import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException, GoneException, NotFoundException } from '@nestjs/common';

import { buildQrPayload } from './merchant-rules';
import { MerchantPaymentsService } from './merchant-payments.service';

type J = Record<string, any>;

const NOW = () => new Date();
const inFuture = (min = 5) => new Date(Date.now() + min * 60_000);
const inPast = (min = 5) => new Date(Date.now() - min * 60_000);

const settings = {
  enabled: true, paymentFeePct: 1, qrValidityMinutes: 5, phoneRequestValidityMinutes: 30, payoutFeePct: 0,
  payoutMethods: ['ORANGE_MONEY'], payoutMode: 'MANUAL', payoutCooldownHours: 24,
  minPayment: { XOF: 100 }, maxPayment: { XOF: 2_000_000 }, minPayout: { XOF: 1000 },
};

const users: J = {
  mer: { id: 'mer', email: 'm@x.fr', firstName: 'Awa', lastName: 'Diallo', phone: '+224620000001', role: 'USER', kycLevel: 'LEVEL_2', clientId: 7, isActive: true, isSuspended: false, deletedAt: null, primaryCurrency: 'XOF' },
  cli: { id: 'cli', email: 'c@x.fr', firstName: 'Mamadou', lastName: 'Barry', phone: '+224620000002', role: 'USER', kycLevel: 'LEVEL_2', clientId: 7, isActive: true, isSuspended: false, deletedAt: null, primaryCurrency: 'XOF' },
  cli2: { id: 'cli2', email: 'c2@x.fr', firstName: 'Fanta', lastName: 'Sow', phone: '+224620000003', role: 'USER', kycLevel: 'LEVEL_2', clientId: 7, isActive: true, isSuspended: false, deletedAt: null, primaryCurrency: 'XOF' },
  caiss: { id: 'caiss', email: 'k@x.fr', firstName: 'Kadiatou', lastName: 'Camara', phone: '+224620000005', role: 'USER', kycLevel: 'LEVEL_2', clientId: 7, isActive: true, isSuspended: false, deletedAt: null, primaryCurrency: 'XOF' },
  mer2: { id: 'mer2', email: 'm2@x.fr', firstName: 'Ibrahima', lastName: 'Bah', phone: '+224620000004', role: 'USER', kycLevel: 'LEVEL_2', clientId: 7, isActive: true, isSuspended: false, deletedAt: null, primaryCurrency: 'XOF' },
};
const profiles: J = {
  mer: { id: 'mp:mer', businessName: 'Boutique Awa', city: 'Conakry', category: 'Boutique', address: null, logo: null, status: 'ACTIVE', staticQrToken: 'S'.repeat(32) },
  mer2: { id: 'mp:mer2', businessName: 'Pharmacie Bah', city: 'Conakry', category: 'Santé', status: 'ACTIVE' },
};

function setup(over: { balances?: J; pin?: () => Promise<void>; kyc?: () => Promise<void>; seed?: J[]; staff?: J[]; returnCommission?: boolean } = {}) {
  const db = {
    requests: [...(over.seed ?? [])] as J[],
    balances: { 'w:cli': 50_000, 'w:cli2': 50_000, 'wm:mer': 0, 'wm:mer2': 0, 'w:mer2': 0, 'w:company': 0, ...(over.balances ?? {}) } as Record<string, number>,
    transactions: [] as J[],
    seq: 0,
  };
  let queue: Promise<unknown> = Promise.resolve();
  const snapshot = () => JSON.stringify({ r: db.requests, b: db.balances, t: db.transactions });
  const restore = (s: string) => {
    const o = JSON.parse(s, (k, v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v) : v));
    db.requests = o.r; db.balances = o.b; db.transactions = o.t;
  };
  const withParties = (r: J | undefined) =>
    r && { ...r, payee: { ...users[r.payeeId], merchantProfile: profiles[r.payeeId] ?? null }, payer: r.payerId ? users[r.payerId] : null };
  const match = (r: J, w: J = {}): boolean =>
    Object.entries(w).every(([k, v]) => {
      if (k === 'OR') return (v as J[]).some((c) => match(r, c));
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        const x = v as J;
        if ('not' in x) return (r[k] ?? null) !== x.not;
        if ('gt' in x) return r[k] > x.gt;
        if ('lte' in x) return r[k] <= x.lte;
        if ('in' in x) return x.in.includes(r[k]);
        return true;
      }
      return v === null ? (r[k] ?? null) === null : r[k] === v;
    });

  const prisma: J = {
    user: { findUnique: jest.fn(async ({ where }: J) => users[where.id] ?? null), findFirst: jest.fn(async ({ where }: J) => Object.values(users).find((u: J) => u.phone === where.phone && u.clientId === where.clientId) ?? null) },
    paymentRequest: {
      count: jest.fn(async ({ where }: J) => db.requests.filter((r) => match(r, where)).length),
      create: jest.fn(async ({ data }: J) => { const r = { id: `r${++db.seq}`, status: 'PENDING', createdAt: NOW(), paidAt: null, failureReason: null, payerId: null, payerPhone: null, qrToken: null, note: null, ...data }; db.requests.push(r); return withParties(r); }),
      findFirst: jest.fn(async ({ where }: J) => withParties(db.requests.find((r) => match(r, where)))),
      findMany: jest.fn(async ({ where }: J) => db.requests.filter((r) => match(r, where)).map(withParties)),
      updateMany: jest.fn(async ({ where, data }: J) => { const rows = db.requests.filter((r) => match(r, where)); rows.forEach((r) => Object.assign(r, data)); return { count: rows.length }; }),
      update: jest.fn(async ({ where, data }: J) => { const r = db.requests.find((x) => x.id === where.id)!; Object.assign(r, data); return r; }),
    },
    transaction: { create: jest.fn(async ({ data }: J) => { const t = { id: `t${db.transactions.length + 1}`, ...data }; db.transactions.push(t); return t; }) },
    auditLog: { create: jest.fn(async () => ({})) },
    // Lecture du solde du portefeuille de la société (contrôle avant de lui reprendre la commission).
    wallet: { findUnique: jest.fn(async ({ where }: J) => ({ balance: db.balances[where.id] ?? 0, reservedBalance: 0, isFrozen: false })) },
    merchantProfile: {
      // Commerce dont le QR de caisse permanent porte ce jeton (même société).
      findFirst: jest.fn(async ({ where }: J) => {
        const hit = Object.entries(profiles).find(([, p]: [string, J]) => p.staticQrToken && p.staticQrToken === where.staticQrToken);
        return hit && where.clientId === 7 ? { ...hit[1], userId: hit[0], clientId: 7, user: { id: hit[0], primaryCurrency: 'XOF' } } : null;
      }),
    },
    merchantStaff: { findFirst: jest.fn(async ({ where }: J) => (over.staff ?? []).find((s) => s.merchantId === where.merchantId && s.userId === where.userId && s.active !== false) ?? null) },
    // Les transactions SQL sont isolées : la file d'attente reproduit ce qu'imposent le verrou de portefeuille et la prise atomique.
    $transaction: jest.fn((fn: (tx: J) => Promise<any>) => {
      const run = queue.then(async () => {
        const snap = snapshot();
        try { return await fn(prisma); } catch (e) { restore(snap); throw e; }
      });
      queue = run.catch(() => undefined);
      return run;
    }),
  };
  const wallets = {
    // userId = portefeuille personnel (« w:… ») ; merchantId = portefeuille PROPRE du commerce (« wm:… ») ; sinon la société.
    getOrCreateWallet: jest.fn(async ({ userId, merchantId, clientId }: J) => ({ id: merchantId ? `wm:${String(merchantId).replace('mp:', '')}` : userId ? `w:${userId}` : 'w:company', currency: 'XOF', _c: clientId })),
    debitInTx: jest.fn(async (_tx: J, id: string, amount: number) => {
      if ((db.balances[id] ?? 0) < amount) throw new BadRequestException(`Solde insuffisant: ${db.balances[id] ?? 0} XOF`);
      db.balances[id] -= amount;
    }),
    creditInTx: jest.fn(async (_tx: J, id: string, amount: number) => { db.balances[id] = (db.balances[id] ?? 0) + amount; }),
  };
  const kyc = { assertVerified: jest.fn(over.kyc ?? (async () => undefined)) };
  const pins = { assertPin: jest.fn(over.pin ?? (async () => undefined)) };
  const merchants = {
    assertActiveMerchant: jest.fn(async (id: string) => {
      if (!profiles[id]) throw new ForbiddenException({ code: 'MERCHANT_REQUIRED' });
      return { profile: profiles[id], settings };
    }),
    settingsFor: jest.fn(async () => settings),
    refundSettingsFor: jest.fn(async () => ({ returnMerchantCommission: !!over.returnCommission, returnFeesOnRecall: true, recallWindowDays: 30 })),
    // Pour qui j'agis : mon commerce, ou celui où je suis caissier actif.
    resolveActing: jest.fn(async (user: J, merchantId?: string) => {
      if (!merchantId || profiles[user.id]?.id === merchantId) {
        if (!profiles[user.id]) throw new ForbiddenException({ code: 'MERCHANT_REQUIRED' });
        return { ownerId: user.id, profile: profiles[user.id], settings, staff: null, isOwner: true };
      }
      const ownerId = Object.keys(profiles).find((k) => profiles[k].id === merchantId);
      if (!ownerId) throw new NotFoundException('Commerce introuvable.');
      const staff = (over.staff ?? []).find((x) => x.merchantId === merchantId && x.userId === user.id && x.active !== false);
      if (!staff) throw new ForbiddenException({ code: 'NOT_STAFF' });
      return { ownerId, profile: profiles[ownerId], settings, staff, isOwner: false };
    }),
  };
  const notifier = { notifyUser: jest.fn(async () => undefined) };
  const alerts = { onBalanceChanged: jest.fn(async () => undefined), onPaymentFailed: jest.fn(async () => undefined) };
  const compliance = { assertWithinLimits: jest.fn(async () => undefined), scorePayment: jest.fn(async () => undefined) };
  const service = new MerchantPaymentsService(prisma as any, wallets as any, kyc as any, pins as any, merchants as any, notifier as any, alerts as any, compliance as any);
  return { service, db, prisma, wallets, kyc, pins, merchants, notifier, alerts, compliance };
}

const asUser = (id: string) => ({ id, sub: id, role: 'USER', clientId: 7 }) as any;
const total = (b: Record<string, number>) => Object.values(b).reduce((a, x) => a + x, 0);

describe('création — téléphone', () => {
  it('fige montant, commission et net ; prévient le client ; renvoie un nom abrégé', async () => {
    const { service, db, notifier } = setup();
    const v = await service.createPhoneRequest(asUser('mer'), { amount: 10_000, payerPhone: '+224 620 00 00 02' });
    expect(v).toMatchObject({ method: 'PHONE', status: 'PENDING', amount: 10_000, fee: 100, netAmount: 9_900, currency: 'XOF' });
    expect(v.payer).toEqual({ id: 'cli', name: 'Mamadou B.' });
    expect(db.requests[0]).toMatchObject({ payeeId: 'mer', payerId: 'cli', payerPhone: '+224620000002' });
    expect(notifier.notifyUser).toHaveBeenCalledWith(expect.objectContaining({ id: 'cli' }), expect.objectContaining({ kind: 'PAYMENT_REQUEST' }));
  });

  it('numéro inconnu : 404 ; soi-même : 400 ; numéro invalide : 400 ; hors plafonds : 400', async () => {
    const { service } = setup();
    await expect(service.createPhoneRequest(asUser('mer'), { amount: 1000, payerPhone: '+224699999999' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.createPhoneRequest(asUser('mer'), { amount: 1000, payerPhone: '+224620000001' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createPhoneRequest(asUser('mer'), { amount: 1000, payerPhone: '0620000002' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createPhoneRequest(asUser('mer'), { amount: 50, payerPhone: '+224620000002' })).rejects.toThrow(/minimum/);
    await expect(service.createPhoneRequest(asUser('mer'), { amount: 3_000_000, payerPhone: '+224620000002' })).rejects.toThrow(/maximum/);
    await expect(service.createPhoneRequest(asUser('mer'), { amount: 10.5, payerPhone: '+224620000002' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('double appui : la même demande ouverte est renvoyée, pas une seconde', async () => {
    const { service, db } = setup();
    const a = await service.createPhoneRequest(asUser('mer'), { amount: 5000, payerPhone: '+224620000002' });
    const b = await service.createPhoneRequest(asUser('mer'), { amount: 5000, payerPhone: '+224620000002' });
    expect(b.id).toBe(a.id);
    expect(db.requests).toHaveLength(1);
  });

  it("un compte qui n'est pas marchand ne peut pas créer", async () => {
    const { service } = setup();
    await expect(service.createPhoneRequest(asUser('cli'), { amount: 1000, payerPhone: '+224620000003' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.createQrRequest(asUser('cli'), { amount: 1000 })).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('création — QR', () => {
  it('jeton unique, lien dans la réponse du marchand, validité 5 min', async () => {
    const { service, db } = setup();
    const v = await service.createQrRequest(asUser('mer'), { amount: 2500 });
    expect(v.method).toBe('QR');
    expect(v.qrPayload).toBe(buildQrPayload(db.requests[0].qrToken));
    expect(v.secondsLeft).toBeGreaterThan(290);
    expect(v.secondsLeft).toBeLessThanOrEqual(300);
  });
});

describe('paiement — règlement', () => {
  const seedPhone = (over: J = {}) => ({ id: 'rp', reference: 'MP-1', clientId: 7, payeeId: 'mer', payerId: 'cli', payerPhone: '+224620000002', method: 'PHONE', status: 'PENDING', amount: 10_000, fee: 100, netAmount: 9_900, currency: 'XOF', note: null, qrToken: null, expiresAt: inFuture(), createdAt: NOW(), paidAt: null, failureReason: null, ...over });
  const seedQr = (over: J = {}) => seedPhone({ id: 'rq', reference: 'MP-2', method: 'QR', payerId: null, payerPhone: null, qrToken: 'A'.repeat(32), ...over });

  it("comptes séparés : l'encaissement va sur le portefeuille du COMMERCE, jamais sur le portefeuille personnel du marchand", async () => {
    const { service, db, wallets } = setup({ seed: [seedPhone()], balances: { 'w:mer': 7_511 } });
    await service.payRequest(asUser('cli'), 'rp', '486213');
    expect(wallets.getOrCreateWallet).toHaveBeenCalledWith(expect.objectContaining({ merchantId: 'mp:mer' }));
    expect(wallets.getOrCreateWallet).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 'mer' }));
    expect(db.balances['w:mer']).toBe(7_511); // son argent de client n'a pas bougé
    expect(db.balances['wm:mer']).toBe(9_900); // le commerce est crédité du net
  });

  it("PHONE : débite le client, crédite le marchand du net et la société de la commission — l'argent est conservé", async () => {
    const { service, db, notifier } = setup({ seed: [seedPhone()] });
    const before = total(db.balances);
    const out = await service.payRequest(asUser('cli'), 'rp', '486213');
    expect(out.status).toBe('PAID');
    expect(db.balances).toMatchObject({ 'w:cli': 40_000, 'wm:mer': 9_900, 'w:company': 100 });
    expect(total(db.balances)).toBe(before);
    expect(db.transactions[0]).toMatchObject({ type: 'MERCHANT_PAYMENT', status: 'PAID', senderId: 'cli', recipientId: 'mer', amount: 10_000, platformCommission: 100, reference: 'MP-1' });
    expect(db.requests[0]).toMatchObject({ status: 'PAID', transactionId: 't1' });
    const kinds = notifier.notifyUser.mock.calls.map((c: any[]) => c[1].kind);
    expect(kinds).toEqual(expect.arrayContaining(['PAYMENT_RECEIVED', 'PAYMENT_SENT']));
  });

  it('QR : payé par n’importe quel client de la société', async () => {
    const { service, db } = setup({ seed: [seedQr()] });
    const out = await service.payQr(asUser('cli2'), buildQrPayload('A'.repeat(32)), '486213');
    expect(out.status).toBe('PAID');
    expect(db.requests[0].payerId).toBe('cli2');
    expect(db.balances['w:cli2']).toBe(40_000);
  });

  it('marchand → marchand, par QR et par téléphone', async () => {
    const q = setup({ seed: [seedQr()], balances: { 'w:mer2': 20_000 } });
    await q.service.payQr(asUser('mer2'), 'A'.repeat(32), '486213');
    expect(q.db.balances).toMatchObject({ 'w:mer2': 10_000, 'wm:mer': 9_900 });
    const p = setup({ seed: [seedPhone({ payerId: 'mer2', payerPhone: '+224620000004' })], balances: { 'w:mer2': 20_000 } });
    await p.service.payRequest(asUser('mer2'), 'rp', '486213');
    expect(p.db.balances).toMatchObject({ 'w:mer2': 10_000, 'wm:mer': 9_900 });
  });

  it('deux clients scannent le même QR : un seul paie, l’autre reçoit 409 et n’est pas débité', async () => {
    const { service, db } = setup({ seed: [seedQr()] });
    const [a, b] = await Promise.allSettled([service.payQr(asUser('cli'), 'A'.repeat(32), '486213'), service.payQr(asUser('cli2'), 'A'.repeat(32), '486213')]);
    const ok = [a, b].filter((x) => x.status === 'fulfilled');
    const ko = [a, b].filter((x) => x.status === 'rejected') as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(ko).toHaveLength(1);
    expect(ko[0].reason).toBeInstanceOf(ConflictException);
    expect(db.transactions).toHaveLength(1);
    expect(db.balances['w:cli'] + db.balances['w:cli2']).toBe(90_000);
    expect(db.balances['wm:mer']).toBe(9_900);
  });

  it('double envoi par le même client : un seul débit', async () => {
    const { service, db } = setup({ seed: [seedPhone()] });
    await service.payRequest(asUser('cli'), 'rp', '486213');
    await expect(service.payRequest(asUser('cli'), 'rp', '486213')).rejects.toBeInstanceOf(ConflictException);
    expect(db.balances['w:cli']).toBe(40_000);
    expect(db.transactions).toHaveLength(1);
  });

  it('solde insuffisant : rien n’est débité ni crédité, la demande reste ouverte, le client et le marchand sont prévenus', async () => {
    const { service, db, notifier } = setup({ seed: [seedPhone()], balances: { 'w:cli': 5_000 } });
    await expect(service.payRequest(asUser('cli'), 'rp', '486213')).rejects.toThrow(/Solde insuffisant/);
    expect(db.balances).toMatchObject({ 'w:cli': 5_000, 'wm:mer': 0, 'w:company': 0 });
    expect(db.transactions).toHaveLength(0);
    expect(db.requests[0].status).toBe('PENDING');
    expect(db.requests[0].failureReason).toBe('Solde insuffisant du client');
    const kinds = notifier.notifyUser.mock.calls.map((c: any[]) => c[1].kind);
    expect(kinds).toEqual(['PAYMENT_FAILED', 'PAYMENT_FAILED']);
    // une fois rechargé, le même paiement passe
    db.balances['w:cli'] = 20_000;
    await expect(service.payRequest(asUser('cli'), 'rp', '486213')).resolves.toMatchObject({ status: 'PAID' });
  });

  it('commission 0 : pas de crédit société', async () => {
    const { service, db, wallets } = setup({ seed: [seedPhone({ fee: 0, netAmount: 10_000 })] });
    await service.payRequest(asUser('cli'), 'rp', '486213');
    expect(db.balances['wm:mer']).toBe(10_000);
    expect(wallets.creditInTx).toHaveBeenCalledTimes(1);
  });

  it('code secret faux : aucun mouvement, aucun accès aux portefeuilles', async () => {
    const { service, db, wallets } = setup({ seed: [seedPhone()], pin: async () => { throw new ForbiddenException({ code: 'PIN_INVALID' }); } });
    await expect(service.payRequest(asUser('cli'), 'rp', '000000')).rejects.toBeInstanceOf(ForbiddenException);
    expect(wallets.debitInTx).not.toHaveBeenCalled();
    expect(db.requests[0].status).toBe('PENDING');
  });

  it("identité non vérifiée : refusé avant même de demander le code secret", async () => {
    const { service, pins } = setup({ seed: [seedPhone()], kyc: async () => { throw new ForbiddenException({ code: 'KYC_REQUIRED' }); } });
    await expect(service.payRequest(asUser('cli'), 'rp', '486213')).rejects.toBeInstanceOf(ForbiddenException);
    expect(pins.assertPin).not.toHaveBeenCalled();
  });

  it('demande expirée : 410, rien débité, statut EXPIRED, marchand prévenu', async () => {
    const { service, db, notifier } = setup({ seed: [seedPhone({ expiresAt: inPast() })] });
    await expect(service.payRequest(asUser('cli'), 'rp', '486213')).rejects.toBeInstanceOf(GoneException);
    expect(db.requests[0].status).toBe('EXPIRED');
    expect(db.balances['w:cli']).toBe(50_000);
    expect(notifier.notifyUser.mock.calls.some((c: any[]) => c[1].kind === 'PAYMENT_EXPIRED')).toBe(true);
  });

  it('refusé : se payer soi-même, payer la demande d’un autre client (PHONE), autre société, demande annulée', async () => {
    const own = setup({ seed: [seedQr({ payeeId: 'mer' })] });
    await expect(own.service.payQr(asUser('mer'), 'A'.repeat(32), '486213')).rejects.toBeInstanceOf(BadRequestException);
    const other = setup({ seed: [seedPhone()] });
    await expect(other.service.payRequest(asUser('cli2'), 'rp', '486213')).rejects.toBeInstanceOf(NotFoundException);
    const foreign = setup({ seed: [seedQr()] });
    await expect(foreign.service.payQr({ id: 'cli', clientId: 99, role: 'USER' } as any, 'A'.repeat(32), '486213')).rejects.toBeInstanceOf(NotFoundException);
    const cancelled = setup({ seed: [seedPhone({ status: 'CANCELLED' })] });
    await expect(cancelled.service.payRequest(asUser('cli'), 'rp', '486213')).rejects.toBeInstanceOf(ConflictException);
  });

  it("un QR étranger (autre lien) est rejeté sans consulter la base", async () => {
    const { service, prisma } = setup();
    await expect(service.payQr(asUser('cli'), 'https://evil.example/x', '486213')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.paymentRequest.findFirst).not.toHaveBeenCalled();
  });

  it('marchand suspendu entre-temps : paiement refusé', async () => {
    const { service } = setup({ seed: [seedQr()] });
    profiles.mer.status = 'SUSPENDED';
    try {
      await expect(service.payQr(asUser('cli'), 'A'.repeat(32), '486213')).rejects.toBeInstanceOf(ConflictException);
    } finally {
      profiles.mer.status = 'ACTIVE';
    }
  });
});

describe('refus, annulation, aperçu, balayage', () => {
  const seed = (over: J = {}) => ({ id: 'rp', reference: 'MP-1', clientId: 7, payeeId: 'mer', payerId: 'cli', payerPhone: '+224620000002', method: 'PHONE', status: 'PENDING', amount: 10_000, fee: 100, netAmount: 9_900, currency: 'XOF', note: null, qrToken: null, expiresAt: inFuture(), createdAt: NOW(), paidAt: null, failureReason: null, ...over });

  it('le client refuse : le marchand est prévenu, plus payable', async () => {
    const { service, db, notifier } = setup({ seed: [seed()] });
    const v = await service.decline(asUser('cli'), 'rp');
    expect(v.status).toBe('DECLINED');
    expect(notifier.notifyUser).toHaveBeenCalledWith(expect.objectContaining({ id: 'mer' }), expect.objectContaining({ kind: 'PAYMENT_DECLINED' }));
    await expect(service.payRequest(asUser('cli'), 'rp', '486213')).rejects.toBeInstanceOf(ConflictException);
    expect(db.balances['w:cli']).toBe(50_000);
  });

  it('seul le marchand annule, une seule fois', async () => {
    const { service } = setup({ seed: [seed()] });
    await expect(service.cancel(asUser('cli'), 'rp')).rejects.toBeInstanceOf(NotFoundException);
    expect((await service.cancel(asUser('mer'), 'rp')).status).toBe('CANCELLED');
    await expect(service.cancel(asUser('mer'), 'rp')).rejects.toBeInstanceOf(ConflictException);
  });

  it("aperçu d'un QR : montant et commerce, jamais la commission ni le net", async () => {
    const { service } = setup({ seed: [seed({ id: 'rq', method: 'QR', payerId: null, qrToken: 'B'.repeat(32) })] });
    const v = await service.previewQr(asUser('cli'), buildQrPayload('B'.repeat(32)));
    expect(v).toMatchObject({ amount: 10_000, currency: 'XOF', merchant: { businessName: 'Boutique Awa' } });
    expect(v.fee).toBeUndefined();
    expect(v.netAmount).toBeUndefined();
    expect(v.qrPayload).toBeUndefined();
    expect(v.payerPhone).toBeUndefined();
  });

  it('le balayage ferme les demandes échues (une seule fois) et prévient', async () => {
    const { service, db, notifier } = setup({ seed: [seed({ expiresAt: inPast() }), seed({ id: 'rok' })] });
    expect(await service.sweepExpired()).toBe(1);
    expect(db.requests.find((r) => r.id === 'rp')!.status).toBe('EXPIRED');
    expect(db.requests.find((r) => r.id === 'rok')!.status).toBe('PENDING');
    notifier.notifyUser.mockClear();
    expect(await service.sweepExpired()).toBe(0);
    expect(notifier.notifyUser).not.toHaveBeenCalled();
  });

  it('les demandes à payer : seulement les miennes, ouvertes', async () => {
    const { service } = setup({ seed: [seed(), seed({ id: 'r2', payerId: 'cli2' }), seed({ id: 'r3', expiresAt: inPast() })] });
    const list = await service.incoming(asUser('cli'));
    expect(list.data.map((r: any) => r.id)).toEqual(['rp']);
    expect(list.data[0].fee).toBeUndefined();
  });
});


// ─────────────────────────────────────────────────────────
// LOT 13 — QR de caisse permanent, caissiers, remboursement
// ─────────────────────────────────────────────────────────
const SHOP_QR = buildQrPayload('S'.repeat(32));
const staffRow = (over: J = {}) => ({ id: 'st1', merchantId: 'mp:mer', userId: 'caiss', active: true, canRefund: false, maxAmount: null, ...over });

describe('QR de caisse permanent', () => {
  it("aperçu : commerce, devise et bornes ; le montant est à saisir (0), jamais de commission", async () => {
    const { service, db } = setup();
    const v: any = await service.previewQr(asUser('cli'), SHOP_QR);
    expect(v).toMatchObject({ staticQr: true, amount: 0, currency: 'XOF', minAmount: 100, maxAmount: 2_000_000, merchant: { businessName: 'Boutique Awa', shopId: 'mp:mer' } });
    expect(v.fee).toBeUndefined();
    expect(db.requests).toHaveLength(0); // un simple aperçu ne crée rien
  });

  it("le client saisit le montant : demande créée à la volée puis réglée — l'argent est conservé", async () => {
    const { service, db, notifier } = setup();
    const before = total(db.balances);
    const out = await service.payQr(asUser('cli'), SHOP_QR, '486213', { amount: 20_000 });
    expect(out.status).toBe('PAID');
    expect(db.requests).toHaveLength(1);
    expect(db.requests[0]).toMatchObject({ viaStaticQr: true, method: 'QR', payeeId: 'mer', payerId: 'cli', amount: 20_000, fee: 200, netAmount: 19_800, status: 'PAID' });
    expect(db.balances).toMatchObject({ 'w:cli': 30_000, 'wm:mer': 19_800, 'w:company': 200 });
    expect(total(db.balances)).toBe(before);
    expect(notifier.notifyUser.mock.calls.map((c: any[]) => c[1].kind)).toEqual(expect.arrayContaining(['PAYMENT_RECEIVED', 'PAYMENT_SENT']));
  });

  it('montant absent, hors bornes ou avec décimales : refusé, aucune demande créée', async () => {
    const { service, db } = setup();
    await expect(service.payQr(asUser('cli'), SHOP_QR, '486213')).rejects.toThrow(/montant/i);
    await expect(service.payQr(asUser('cli'), SHOP_QR, '486213', { amount: 50 })).rejects.toThrow(/minimum/);
    await expect(service.payQr(asUser('cli'), SHOP_QR, '486213', { amount: 3_000_000 })).rejects.toThrow(/maximum/);
    await expect(service.payQr(asUser('cli'), SHOP_QR, '486213', { amount: 10.5 })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.requests).toHaveLength(0);
  });

  it('code secret faux : rien débité, la demande transitoire est fermée (jamais orpheline)', async () => {
    const { service, db } = setup({ pin: async () => { throw new ForbiddenException({ code: 'PIN_INVALID' }); } });
    await expect(service.payQr(asUser('cli'), SHOP_QR, '000000', { amount: 5000 })).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.balances['w:cli']).toBe(50_000);
    expect(db.requests.every((r) => r.status === 'CANCELLED')).toBe(true);
  });

  it("solde insuffisant : le client est prévenu, PAS le marchand ; l'échec est compté pour l'alerte", async () => {
    const { service, db, notifier, alerts } = setup({ balances: { 'w:cli': 1_000 } });
    await expect(service.payQr(asUser('cli'), SHOP_QR, '486213', { amount: 5000 })).rejects.toThrow(/Solde insuffisant/);
    expect(db.requests[0]).toMatchObject({ status: 'CANCELLED', failedAttempts: { increment: 1 } });
    const to = notifier.notifyUser.mock.calls.map((c: any[]) => [c[0].id, c[1].kind]);
    expect(to).toEqual([['cli', 'PAYMENT_FAILED']]);
    expect(alerts.onPaymentFailed).toHaveBeenCalledWith('mer');
  });

  it('son propre QR, ou un commerce suspendu : refusé', async () => {
    const { service } = setup();
    await expect(service.payQr(asUser('mer'), SHOP_QR, '486213', { amount: 5000 })).rejects.toBeInstanceOf(BadRequestException);
    profiles.mer.status = 'SUSPENDED';
    try {
      await expect(service.payQr(asUser('cli'), SHOP_QR, '486213', { amount: 5000 })).rejects.toBeInstanceOf(ConflictException);
      await expect(service.previewQr(asUser('cli'), SHOP_QR)).rejects.toBeInstanceOf(ConflictException);
    } finally {
      profiles.mer.status = 'ACTIVE';
    }
  });

  it("un QR de caisse d'une autre société n'est pas reconnu", async () => {
    const { service } = setup();
    await expect(service.previewQr({ id: 'cli', clientId: 99, role: 'USER' } as any, SHOP_QR)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deux paiements successifs au même QR sont deux paiements distincts (QR permanent)', async () => {
    const { service, db } = setup();
    await service.payQr(asUser('cli'), SHOP_QR, '486213', { amount: 1000 });
    await service.payQr(asUser('cli2'), SHOP_QR, '486213', { amount: 2000 });
    expect(db.transactions).toHaveLength(2);
    expect(db.balances['wm:mer']).toBe(990 + 1_980);
  });
});

describe('caissiers', () => {
  it("encaisse POUR le commerce : le propriétaire est le bénéficiaire, le caissier est gardé sur la demande", async () => {
    const { service, db } = setup({ staff: [staffRow()] });
    const v: any = await service.createQrRequest(asUser('caiss'), { amount: 4000, merchantId: 'mp:mer' });
    expect(db.requests[0]).toMatchObject({ payeeId: 'mer', createdById: 'caiss' });
    expect(v.isMine).toBe('PAYEE');
    expect(v.qrPayload).toBeDefined(); // le caissier affiche le QR
    expect(v.merchant.businessName).toBe('Boutique Awa');
  });

  it('plafond par encaissement : au-delà, refusé ; en dessous, accepté', async () => {
    const { service } = setup({ staff: [staffRow({ maxAmount: 5000 })] });
    await expect(service.createQrRequest(asUser('caiss'), { amount: 5001, merchantId: 'mp:mer' })).rejects.toThrow(/plafond/i);
    await expect(service.createQrRequest(asUser('caiss'), { amount: 5000, merchantId: 'mp:mer' })).resolves.toMatchObject({ amount: 5000 });
  });

  it("pas caissier (ou retiré) : refusé ; il encaisse toujours dans la devise du commerce", async () => {
    const none = setup();
    await expect(none.service.createQrRequest(asUser('caiss'), { amount: 1000, merchantId: 'mp:mer' })).rejects.toBeInstanceOf(ForbiddenException);
    const off = setup({ staff: [staffRow({ active: false })] });
    await expect(off.service.createQrRequest(asUser('caiss'), { amount: 1000, merchantId: 'mp:mer' })).rejects.toBeInstanceOf(ForbiddenException);
    const { service, db } = setup({ staff: [staffRow()] });
    await service.createQrRequest(asUser('caiss'), { amount: 1000, merchantId: 'mp:mer', currency: 'EUR' });
    expect(db.requests[0].currency).toBe('XOF');
  });

  it('par téléphone : il ne peut pas viser le propriétaire ni lui-même', async () => {
    const { service } = setup({ staff: [staffRow()] });
    await expect(service.createPhoneRequest(asUser('caiss'), { amount: 1000, payerPhone: '+224620000001', merchantId: 'mp:mer' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createPhoneRequest(asUser('caiss'), { amount: 1000, payerPhone: '+224620000005', merchantId: 'mp:mer' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createPhoneRequest(asUser('caiss'), { amount: 1000, payerPhone: '+224620000002', merchantId: 'mp:mer' })).resolves.toMatchObject({ amount: 1000 });
  });

  it('suivi et annulation de SA demande ; pas celle de son collègue ni du propriétaire', async () => {
    const { service } = setup({ staff: [staffRow(), staffRow({ id: 'st2', userId: 'cli2' })] });
    const v: any = await service.createQrRequest(asUser('caiss'), { amount: 1000, merchantId: 'mp:mer' });
    await expect(service.getOne(asUser('caiss'), v.id)).resolves.toMatchObject({ id: v.id });
    await expect(service.getOne(asUser('cli2'), v.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.cancel(asUser('cli2'), v.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.cancel(asUser('caiss'), v.id)).resolves.toMatchObject({ status: 'CANCELLED' });
  });

  it('le caissier est prévenu quand sa demande est payée ; le propriétaire sait qui a encaissé', async () => {
    const { service, notifier } = setup({ staff: [staffRow()] });
    const v: any = await service.createQrRequest(asUser('caiss'), { amount: 4000, merchantId: 'mp:mer' });
    const token = v.qrPayload as string;
    notifier.notifyUser.mockClear();
    await service.payQr(asUser('cli'), token, '486213');
    const sent = notifier.notifyUser.mock.calls.map((c: any[]) => [c[0].id, c[1].kind, c[1].actionUrl]);
    expect(sent).toEqual(expect.arrayContaining([['caiss', 'PAYMENT_RECEIVED', '/cashier']]));
    const owner = notifier.notifyUser.mock.calls.find((c: any[]) => c[0].id === 'mer');
    expect(owner![1].body).toContain('Kadiatou Camara');
  });

  it("liste : le propriétaire voit tout ; le caissier seulement ses demandes ; les transitoires du QR de caisse n'y figurent que payées", async () => {
    const { service, db } = setup({ staff: [staffRow()] });
    await service.createQrRequest(asUser('mer'), { amount: 1000 });
    await service.createQrRequest(asUser('caiss'), { amount: 2000, merchantId: 'mp:mer' });
    db.requests.push({ id: 'ghost', reference: 'MP-G', clientId: 7, payeeId: 'mer', payerId: 'cli', method: 'QR', viaStaticQr: true, status: 'CANCELLED', amount: 10, fee: 0, netAmount: 10, currency: 'XOF', expiresAt: inPast(), createdAt: NOW(), createdById: null });
    const prismaFind = jest.spyOn((service as any).prisma.paymentRequest, 'findMany');
    prismaFind.mockImplementation(async ({ where }: J) => {
      const rows = db.requests.filter((r) => {
        const and = where.AND as J[];
        const base = and[0];
        const okBase = r.payeeId === base.payeeId && (!base.createdById || r.createdById === base.createdById);
        const okVisible = r.viaStaticQr !== true || r.status === 'PAID';
        return okBase && okVisible;
      });
      return rows.map((r) => ({ ...r, payee: { ...users[r.payeeId], merchantProfile: profiles[r.payeeId] }, payer: r.payerId ? users[r.payerId] : null }));
    });
    const owner = await service.listMine(asUser('mer'), {});
    expect(owner.data).toHaveLength(2);
    const cashier = await service.listMine(asUser('caiss'), { merchantId: 'mp:mer' });
    expect(cashier.data).toHaveLength(1);
    expect(cashier.data[0].amount).toBe(2000);
  });
});

describe('remboursement', () => {
  const paid = (over: J = {}) => ({ id: 'rp', reference: 'MP-1', clientId: 7, payeeId: 'mer', payerId: 'cli', payerPhone: null, method: 'QR', status: 'PAID', amount: 10_000, fee: 100, netAmount: 9_900, currency: 'XOF', note: null, qrToken: null, expiresAt: inPast(), createdAt: inPast(60), paidAt: inPast(60), refundedAt: null, failureReason: null, transactionId: 't0', ...over });
  const richShop = { 'wm:mer': 30_000 };

  it("rend TOUT au client, le commerce paie le montant payé — l'argent est conservé, l'opération est tracée", async () => {
    const { service, db, notifier, alerts } = setup({ seed: [paid()], balances: richShop });
    const before = total(db.balances);
    const out: any = await service.refund(asUser('mer'), 'rp', { pin: '486213', reason: 'Article rendu' });
    expect(out).toMatchObject({ refunded: true, status: 'PAID', refundReason: 'Article rendu', canRefund: false });
    expect(db.balances).toMatchObject({ 'w:cli': 60_000, 'wm:mer': 20_000 });
    expect(total(db.balances)).toBe(before);
    expect(db.transactions[0]).toMatchObject({ type: 'MERCHANT_REFUND', status: 'PAID', senderId: 'mer', recipientId: 'cli', amount: 10_000, platformCommission: 0 });
    expect(db.requests[0]).toMatchObject({ refundedById: 'mer', refundReason: 'Article rendu', refundTransactionId: 't1' });
    expect(notifier.notifyUser).toHaveBeenCalledWith(expect.objectContaining({ id: 'cli' }), expect.objectContaining({ kind: 'PAYMENT_REFUNDED', email: true }));
    expect(alerts.onBalanceChanged).toHaveBeenCalledWith('mp:mer', 'XOF');
  });

  describe('commission rendue (réglage de la société)', () => {
    it('réglage ouvert : le client récupère tout, le commerce ne perd que le NET, la société rend la commission', async () => {
      const { service, db, wallets } = setup({ seed: [paid()], balances: { 'wm:mer': 9_900, 'w:company': 500 }, returnCommission: true });
      const before = total(db.balances);
      const out: any = await service.refund(asUser('mer'), 'rp', { pin: '486213' });
      expect(out).toMatchObject({ refunded: true });
      // commerce : 9 900 + 100 (commission rendue) − 10 000 = 0 ; société : 500 − 100 ; client : +10 000.
      expect(db.balances).toMatchObject({ 'wm:mer': 0, 'w:company': 400, 'w:cli': 60_000 });
      expect(total(db.balances)).toBe(before);
      expect(db.transactions[0]).toMatchObject({ type: 'MERCHANT_REFUND', platformCommission: -100 });
      expect(wallets.debitInTx).toHaveBeenCalledWith(expect.anything(), 'w:company', 100, expect.stringContaining('Commission rendue'), 't1');
    });

    it('réglage fermé (défaut) : la commission reste acquise, le commerce rend le montant intégral', async () => {
      const { service, db } = setup({ seed: [paid()], balances: { 'wm:mer': 10_000, 'w:company': 500 } });
      await service.refund(asUser('mer'), 'rp', { pin: '486213' });
      expect(db.balances).toMatchObject({ 'wm:mer': 0, 'w:company': 500 });
      expect(db.transactions[0].platformCommission).toBe(0);
    });

    it("portefeuille de la société insuffisant : le client est remboursé quand même, la commission reste acquise", async () => {
      const { service, db } = setup({ seed: [paid()], balances: { 'wm:mer': 10_000, 'w:company': 50 }, returnCommission: true });
      await expect(service.refund(asUser('mer'), 'rp', { pin: '486213' })).resolves.toMatchObject({ refunded: true });
      expect(db.balances).toMatchObject({ 'wm:mer': 0, 'w:company': 50, 'w:cli': 60_000 });
      expect(db.transactions[0].platformCommission).toBe(0);
    });

    it("la vue indique au marchand si la commission lui sera rendue (affiché avant de confirmer)", async () => {
      const on = setup({ seed: [paid()], returnCommission: true });
      expect(await on.service.getOne(asUser('mer'), 'rp')).toMatchObject({ refundReturnsFee: true });
      const off = setup({ seed: [paid()] });
      expect(await off.service.getOne(asUser('mer'), 'rp')).toMatchObject({ refundReturnsFee: false });
      expect(await off.service.getOne(asUser('cli'), 'rp')).toMatchObject({ refundReturnsFee: undefined });
    });
  });

  it('une seule fois : le deuxième remboursement (ou deux simultanés) ne rend rien de plus', async () => {
    const a = setup({ seed: [paid()], balances: richShop });
    await a.service.refund(asUser('mer'), 'rp', { pin: '486213' });
    await expect(a.service.refund(asUser('mer'), 'rp', { pin: '486213' })).rejects.toBeInstanceOf(ConflictException);
    expect(a.db.balances['w:cli']).toBe(60_000);
    const b = setup({ seed: [paid()], balances: richShop });
    const [x, y] = await Promise.allSettled([b.service.refund(asUser('mer'), 'rp', { pin: '486213' }), b.service.refund(asUser('mer'), 'rp', { pin: '486213' })]);
    expect([x, y].filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(b.db.balances['w:cli']).toBe(60_000);
    expect(b.db.transactions).toHaveLength(1);
  });

  it("solde du commerce insuffisant : message clair, rien n'est écrit, le paiement reste remboursable", async () => {
    const { service, db } = setup({ seed: [paid()], balances: { 'wm:mer': 9_900 } });
    await expect(service.refund(asUser('mer'), 'rp', { pin: '486213' })).rejects.toThrow(/solde de votre commerce/);
    expect(db.balances).toMatchObject({ 'w:cli': 50_000, 'wm:mer': 9_900 });
    expect(db.transactions).toHaveLength(0);
    expect(db.requests[0].refundedAt).toBeNull();
    db.balances['wm:mer'] = 12_000;
    await expect(service.refund(asUser('mer'), 'rp', { pin: '486213' })).resolves.toMatchObject({ refunded: true });
  });

  it('code secret faux : aucun mouvement', async () => {
    const { service, db } = setup({ seed: [paid()], balances: richShop, pin: async () => { throw new ForbiddenException({ code: 'PIN_INVALID' }); } });
    await expect(service.refund(asUser('mer'), 'rp', { pin: '000000' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.transactions).toHaveLength(0);
    expect(db.requests[0].refundedAt).toBeNull();
  });

  it("refus : paiement non réglé, délai de 30 jours dépassé, paiement d'un autre commerce", async () => {
    const pending = setup({ seed: [paid({ status: 'PENDING', paidAt: null })], balances: richShop });
    await expect(pending.service.refund(asUser('mer'), 'rp', { pin: '486213' })).rejects.toBeInstanceOf(BadRequestException);
    const old = setup({ seed: [paid({ paidAt: inPast(31 * 24 * 60) })], balances: richShop });
    await expect(old.service.refund(asUser('mer'), 'rp', { pin: '486213' })).rejects.toThrow(/30 jours/);
    const other = setup({ seed: [paid()], balances: richShop });
    await expect(other.service.refund(asUser('mer2'), 'rp', { pin: '486213' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(other.service.refund(asUser('cli'), 'rp', { pin: '486213' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("caissier : sans droit → 403 ; avec droit → rembourse avec SON code secret et le propriétaire est prévenu", async () => {
    const without = setup({ seed: [paid()], balances: richShop, staff: [staffRow()] });
    await expect(without.service.refund(asUser('caiss'), 'rp', { pin: '486213' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(without.db.transactions).toHaveLength(0);

    const withRight = setup({ seed: [paid()], balances: richShop, staff: [staffRow({ canRefund: true })] });
    await withRight.service.refund(asUser('caiss'), 'rp', { pin: '486213' });
    expect(withRight.pins.assertPin).toHaveBeenCalledWith('caiss', '486213');
    expect(withRight.db.requests[0].refundedById).toBe('caiss');
    expect(withRight.notifier.notifyUser).toHaveBeenCalledWith(expect.objectContaining({ id: 'mer' }), expect.objectContaining({ kind: 'PAYMENT_REFUND_SENT' }));
  });

  it("vue : « canRefund » seulement pour le propriétaire ou le caissier autorisé, sur un paiement encore remboursable", async () => {
    const { service } = setup({ seed: [paid({ createdById: 'caiss' })], staff: [staffRow({ canRefund: true })] });
    expect((await service.getOne(asUser('mer'), 'rp') as any).canRefund).toBe(true);
    expect((await service.getOne(asUser('caiss'), 'rp') as any).canRefund).toBe(true);
    const noRight = setup({ seed: [paid({ createdById: 'caiss' })], staff: [staffRow()] });
    expect((await noRight.service.getOne(asUser('caiss'), 'rp') as any).canRefund).toBe(false);
    expect((await noRight.service.getOne(asUser('cli'), 'rp') as any).canRefund).toBe(false);
    const done = setup({ seed: [paid({ refundedAt: new Date() })] });
    expect(await done.service.getOne(asUser('mer'), 'rp')).toMatchObject({ refunded: true, canRefund: false });
  });
});

// ─────────────────────────────────────────────────────────
// LOT 14 — plafonds KYC, scoring AML, code de vérification du reçu
// ─────────────────────────────────────────────────────────
describe('conformité du paiement marchand', () => {
  it('le règlement contrôle les plafonds du payeur dans la transaction, puis lance le scoring AML', async () => {
    const { service, db, compliance } = setup();
    const out = await service.payQr(asUser('cli'), SHOP_QR, '486213', { amount: 20_000 });
    expect(compliance.assertWithinLimits).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ payerId: 'cli', currency: 'XOF', amount: 20_000, requestId: db.requests[0].id }));
    expect(compliance.scorePayment).toHaveBeenCalledWith(expect.objectContaining({ payerId: 'cli', amount: 20_000, requestId: db.requests[0].id }));
    expect(out.status).toBe('PAID');
  });

  it("plafond dépassé : rien n'est débité ni crédité, le client reçoit le message du plafond, le marchand n'est pas dérangé", async () => {
    const { service, db, notifier, compliance } = setup();
    compliance.assertWithinLimits.mockRejectedValueOnce(
      new ForbiddenException({ statusCode: 403, code: 'LIMIT_EXCEEDED', message: 'Plafond journalier dépassé : il vous reste 1 000 XOF sur 50 000 XOF.' }),
    );
    const before = total(db.balances);
    await expect(service.payQr(asUser('cli'), SHOP_QR, '486213', { amount: 20_000 })).rejects.toMatchObject({ response: { code: 'LIMIT_EXCEEDED' } });
    expect(db.balances).toMatchObject({ 'w:cli': 50_000 });
    expect(total(db.balances)).toBe(before);
    expect(db.requests[0]).toMatchObject({ status: 'CANCELLED' });
    const sent = notifier.notifyUser.mock.calls.map((c: any[]) => [c[0].id, c[1].kind, c[1].title]);
    expect(sent).toEqual([['cli', 'PAYMENT_FAILED', 'Paiement refusé : plafond atteint']]);
    expect(compliance.scorePayment).not.toHaveBeenCalled();
  });

  it('demande classique (téléphone) : le marchand est prévenu que le client a atteint son plafond', async () => {
    const { service, db, notifier, compliance } = setup();
    const v = await service.createPhoneRequest(asUser('mer'), { amount: 10_000, payerPhone: '+224 620 00 00 02' });
    compliance.assertWithinLimits.mockRejectedValueOnce(new ForbiddenException({ statusCode: 403, code: 'LIMIT_EXCEEDED', message: 'Plafond dépassé.' }));
    notifier.notifyUser.mockClear();
    await expect(service.payRequest(asUser('cli'), v.id, '486213')).rejects.toBeInstanceOf(ForbiddenException);
    const merchantMsg = notifier.notifyUser.mock.calls.find((c: any[]) => c[0].id === 'mer');
    expect(merchantMsg?.[1].body).toMatch(/plafond/i);
    expect(db.requests[0].failureReason).toBe('Plafond du client atteint');
  });
});

describe('code de vérification du reçu', () => {
  it('présent seulement sur un paiement réglé, identique pour le client et le marchand', async () => {
    const { service } = setup();
    const out = await service.payQr(asUser('cli'), SHOP_QR, '486213', { amount: 20_000 });
    expect(out.verifyCode).toMatch(/^MP-[A-Z0-9]+-[A-F0-9]{6}\.[A-Za-z0-9_-]{22}$/);
    const mine = await service.getOne(asUser('mer'), out.id);
    expect(mine.verifyCode).toBe(out.verifyCode);

    const pending = setup();
    const v = await pending.service.createPhoneRequest(asUser('mer'), { amount: 10_000, payerPhone: '+224 620 00 00 02' });
    expect(v.verifyCode).toBeUndefined();
  });
});
