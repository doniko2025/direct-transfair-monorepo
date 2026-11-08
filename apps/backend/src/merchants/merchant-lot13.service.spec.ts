// Lot 13 — services : alertes, caissiers, clôture/export, résolution « pour quel commerce j'agis », QR de caisse, logo.
import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { defaultSettings } from '../company-settings/company-settings.logic';
import { MerchantAlertsService } from './merchant-alerts.service';
import { MerchantLogoService } from './merchant-logo.service';
import { MerchantReportsService } from './merchant-reports.service';
import { MerchantStaffService } from './merchant-staff.service';
import { MerchantsService } from './merchants.service';
import { parseQrPayload } from './merchant-rules';

type J = Record<string, any>;
const owner = { id: 'mer', sub: 'mer', role: 'USER', clientId: 7 } as any;
const cashier = { id: 'caiss', sub: 'caiss', role: 'USER', clientId: 7 } as any;
const stranger = { id: 'x', sub: 'x', role: 'USER', clientId: 7 } as any;
const otherCompany = { id: 'y', sub: 'y', role: 'USER', clientId: 99 } as any;
const kinds = (n: jest.Mock) => n.mock.calls.map((c: any[]) => c[1].kind);

const shop = (over: J = {}) => ({ createdAt: new Date(), id: 'mp1', userId: 'mer', clientId: 7, businessName: 'Boutique Awa', city: 'Conakry', status: 'ACTIVE', staticQrToken: null, lowBalanceThreshold: null, lowBalanceNotifiedAt: null, failureAlertsEnabled: true, failureAlertedAt: null, logo: null, ...over });

// ── Alertes ──────────────────────────────────────────────
describe('alertes du marchand', () => {
  function alertSetup(profile: J, wallet: J | null, failures = 0) {
    const row = { ...profile, user: { id: 'mer', email: 'm@x.fr', firstName: 'Awa', primaryCurrency: 'XOF' } };
    const prisma: J = {
      merchantProfile: {
        findUnique: jest.fn(async () => row),
        updateMany: jest.fn(async ({ where, data }: J) => {
          // prise atomique : ne réussit que si la condition tient encore
          if ('lowBalanceNotifiedAt' in where && where.lowBalanceNotifiedAt === null && row.lowBalanceNotifiedAt) return { count: 0 };
          if (where.OR && row.failureAlertedAt && row.failureAlertedAt > where.OR[1].failureAlertedAt.lt) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        }),
      },
      wallet: { findFirst: jest.fn(async () => wallet) },
      paymentRequest: { aggregate: jest.fn(async () => ({ _sum: { failedAttempts: failures } })) },
    };
    const notifier = { notifyUser: jest.fn(async () => undefined) };
    return { service: new MerchantAlertsService(prisma as any, notifier as any), prisma, notifier, row };
  }

  it('solde bas : une seule alerte, puis silence tant que le solde reste bas', async () => {
    const t = alertSetup(shop({ lowBalanceThreshold: 5000 }), { balance: 3000, reservedBalance: 0 });
    await t.service.onBalanceChanged('mp1', 'XOF');
    await t.service.onBalanceChanged('mp1', 'XOF');
    expect(kinds(t.notifier.notifyUser)).toEqual(['LOW_BALANCE']);
    expect(t.row.lowBalanceNotifiedAt).toBeInstanceOf(Date);
  });

  it('le solde remonte : alerte réarmée, nouvelle chute = nouvelle alerte', async () => {
    const t = alertSetup(shop({ lowBalanceThreshold: 5000 }), { balance: 3000, reservedBalance: 0 });
    await t.service.onBalanceChanged('mp1', 'XOF');
    t.prisma.wallet.findFirst.mockResolvedValue({ balance: 9000, reservedBalance: 0 });
    await t.service.onBalanceChanged('mp1', 'XOF');
    expect(t.row.lowBalanceNotifiedAt).toBeNull();
    t.prisma.wallet.findFirst.mockResolvedValue({ balance: 100, reservedBalance: 0 });
    await t.service.onBalanceChanged('mp1', 'XOF');
    expect(kinds(t.notifier.notifyUser)).toEqual(['LOW_BALANCE', 'LOW_BALANCE']);
  });

  it("le montant réservé (retrait en cours) compte : c'est le disponible qui est surveillé", async () => {
    const t = alertSetup(shop({ lowBalanceThreshold: 5000 }), { balance: 8000, reservedBalance: 4000 });
    await t.service.onBalanceChanged('mp1', 'XOF');
    expect(kinds(t.notifier.notifyUser)).toEqual(['LOW_BALANCE']);
  });

  it('sans seuil, ou autre devise que celle du compte : rien', async () => {
    const none = alertSetup(shop(), { balance: 0, reservedBalance: 0 });
    await none.service.onBalanceChanged('mp1', 'XOF');
    const eur = alertSetup(shop({ lowBalanceThreshold: 5000 }), { balance: 0, reservedBalance: 0 });
    await eur.service.onBalanceChanged('mp1', 'EUR');
    expect(none.notifier.notifyUser).not.toHaveBeenCalled();
    expect(eur.notifier.notifyUser).not.toHaveBeenCalled();
  });

  it("ne lève jamais, même si la base est en panne (une alerte ratée ne casse pas un paiement)", async () => {
    const t = alertSetup(shop({ lowBalanceThreshold: 5000 }), null);
    t.prisma.merchantProfile.findUnique.mockRejectedValue(new Error('db down'));
    await expect(t.service.onBalanceChanged('mp1', 'XOF')).resolves.toBeUndefined();
    await expect(t.service.onPaymentFailed('mer')).resolves.toBeUndefined();
  });

  it('échecs de paiement : alerte à 3 échecs, une seule fois, désactivable', async () => {
    const two = alertSetup(shop(), null, 2);
    await two.service.onPaymentFailed('mer');
    expect(two.notifier.notifyUser).not.toHaveBeenCalled();

    const three = alertSetup(shop(), null, 3);
    await three.service.onPaymentFailed('mer');
    await three.service.onPaymentFailed('mer');
    expect(kinds(three.notifier.notifyUser)).toEqual(['PAYMENT_FAILURES']);

    const off = alertSetup(shop({ failureAlertsEnabled: false }), null, 9);
    await off.service.onPaymentFailed('mer');
    expect(off.notifier.notifyUser).not.toHaveBeenCalled();
  });
});

// ── Résolution, QR de caisse, alertes (réglages) ─────────
describe('MerchantsService — pour quel commerce j’agis, QR de caisse, réglages d’alertes', () => {
  function msetup(opts: { staff?: J[]; profile?: J } = {}) {
    const row = shop(opts.profile);
    const prisma: J = {
      user: { findUnique: jest.fn(async () => ({ id: 'mer', email: 'm@x.fr', firstName: 'Awa', primaryCurrency: 'XOF', accountType: 'MERCHANT', clientId: 7 })) },
      merchantProfile: {
        findUnique: jest.fn(async ({ where }: J) => (where.userId ? (where.userId === 'mer' ? row : null) : where.id === 'mp1' ? row : null)),
        updateMany: jest.fn(async ({ where, data }: J) => {
          if (where.staticQrToken === null && row.staticQrToken) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        }),
        update: jest.fn(async ({ data }: J) => Object.assign(row, data)),
      },
      merchantStaff: { findFirst: jest.fn(async ({ where }: J) => (opts.staff ?? []).find((s) => s.merchantId === where.merchantId && s.userId === where.userId && s.active) ?? null) },
      auditLog: { create: jest.fn(async () => ({})) },
    };
    const s = defaultSettings();
    s.merchant.enabled = true;
    const pins = { assertPin: jest.fn(async () => undefined) };
    const notifier = { notifyUser: jest.fn(async () => undefined) };
    const service = new MerchantsService(prisma as any, { forClient: jest.fn(async () => s) } as any, pins as any, notifier as any);
    return { service, prisma, pins, notifier, row };
  }

  it('sans merchantId : mon commerce ; pas de commerce : 403', async () => {
    const { service } = msetup();
    await expect(service.resolveActing(owner)).resolves.toMatchObject({ ownerId: 'mer', isOwner: true, staff: null });
    await expect(service.resolveActing(stranger)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('propriétaire avec son propre merchantId : propriétaire', async () => {
    const { service } = msetup();
    await expect(service.resolveActing(owner, 'mp1')).resolves.toMatchObject({ isOwner: true });
  });

  it('caissier actif : agit pour le propriétaire ; sinon 403 NOT_STAFF ; autre société / commerce inconnu : 404', async () => {
    const staff = [{ id: 's1', merchantId: 'mp1', userId: 'caiss', active: true, canRefund: false, maxAmount: null }];
    const { service } = msetup({ staff });
    await expect(service.resolveActing(cashier, 'mp1')).resolves.toMatchObject({ ownerId: 'mer', isOwner: false, staff: staff[0] });
    const err: any = await service.resolveActing(stranger, 'mp1').catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse().code).toBe('NOT_STAFF');
    await expect(service.resolveActing(otherCompany, 'mp1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.resolveActing(cashier, 'inconnu')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('commerce suspendu : le caissier ne peut plus encaisser', async () => {
    const staff = [{ id: 's1', merchantId: 'mp1', userId: 'caiss', active: true }];
    const { service } = msetup({ staff, profile: { status: 'SUSPENDED', suspendedReason: 'Contrôle' } });
    await expect(service.resolveActing(cashier, 'mp1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('QR de caisse : créé à la première demande, le même ensuite, valide pour le scan (32 caractères)', async () => {
    const staff = [{ id: 's1', merchantId: 'mp1', userId: 'caiss', active: true }];
    const { service, row } = msetup({ staff });
    const a = await service.getStaticQr(owner);
    const b = await service.getStaticQr(owner);
    expect(a.payload).toBe(b.payload);
    expect(parseQrPayload(a.payload)).toBe(row.staticQrToken);
    expect(a).toMatchObject({ shopId: 'mp1', businessName: 'Boutique Awa', currency: 'XOF' });
    // le caissier affiche le même QR
    expect((await service.getStaticQr(cashier, 'mp1')).payload).toBe(a.payload);
    await expect(service.getStaticQr(stranger, 'mp1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("renouveler le QR : code secret exigé, l'ancien jeton cesse d'exister, le propriétaire est prévenu", async () => {
    const { service, pins, notifier, row } = msetup();
    const first = await service.getStaticQr(owner);
    const next = await service.rotateStaticQr(owner, '486213');
    expect(pins.assertPin).toHaveBeenCalledWith('mer', '486213');
    expect(next.payload).not.toBe(first.payload);
    expect(parseQrPayload(next.payload)).toBe(row.staticQrToken);
    expect(kinds(notifier.notifyUser)).toEqual(['QR_ROTATED']);
  });

  it('renouvellement avec un mauvais code secret : le QR ne change pas', async () => {
    const { service, pins, row } = msetup();
    const first = await service.getStaticQr(owner);
    pins.assertPin.mockRejectedValue(new ForbiddenException({ code: 'PIN_INVALID' }));
    await expect(service.rotateStaticQr(owner, '000000')).rejects.toBeInstanceOf(ForbiddenException);
    expect(first.payload).toContain(row.staticQrToken);
  });

  it('alertes : seuil positif enregistré, null le supprime et réarme, valeur invalide refusée', async () => {
    const { service, row } = msetup();
    await service.updateAlerts(owner, { lowBalanceThreshold: 25_000, failureAlertsEnabled: false });
    expect(row).toMatchObject({ lowBalanceThreshold: 25_000, failureAlertsEnabled: false, lowBalanceNotifiedAt: null });
    row.lowBalanceNotifiedAt = new Date() as any;
    await service.updateAlerts(owner, { lowBalanceThreshold: null });
    expect(row).toMatchObject({ lowBalanceThreshold: null, lowBalanceNotifiedAt: null });
    await expect(service.updateAlerts(owner, { lowBalanceThreshold: -5 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateAlerts(owner, { lowBalanceThreshold: 100.5 })).rejects.toBeInstanceOf(BadRequestException); // XOF : entier
  });
});

// ── Caissiers ────────────────────────────────────────────
describe('caissiers — gestion par le propriétaire', () => {
  function ssetup(over: { existing?: J | null; activeCount?: number; person?: J | null } = {}) {
    const person = over.person === undefined ? { id: 'caiss', email: 'k@x.fr', firstName: 'Kadiatou', lastName: 'Camara', phone: '+224620000005' } : over.person;
    const rows: J[] = over.existing ? [{ createdAt: new Date(), user: { firstName: 'Kadiatou', lastName: 'Camara', email: 'k@x.fr', phone: '+224620000005' }, ...over.existing }] : [];
    const prisma: J = {
      user: { findFirst: jest.fn(async () => person), findUnique: jest.fn(async () => ({ id: 'caiss', email: 'k@x.fr', firstName: 'Kadiatou', primaryCurrency: 'XOF' })) },
      merchantStaff: {
        findUnique: jest.fn(async ({ where }: J) => (where.id ? rows.find((r) => r.id === where.id) ?? null : rows[0] ?? null)),
        findFirst: jest.fn(async ({ where }: J) => rows.find((r) => r.id === where.id && r.merchantId === where.merchantId) ?? null),
        findMany: jest.fn(async () => rows),
        count: jest.fn(async () => over.activeCount ?? 0),
        create: jest.fn(async ({ data }: J) => { const r = { id: 'st1', createdAt: new Date(), user: { firstName: 'Kadiatou', lastName: 'Camara', email: 'k@x.fr', phone: '+224620000005' }, ...data }; rows.push(r); return r; }),
        update: jest.fn(async ({ where, data }: J) => { const r = rows.find((x) => x.id === where.id)!; Object.assign(r, data); return { ...r, user: { firstName: 'Kadiatou', lastName: 'Camara', email: 'k@x.fr', phone: '+224620000005' } }; }),
        delete: jest.fn(async ({ where }: J) => rows.splice(rows.findIndex((r) => r.id === where.id), 1)),
      },
      paymentRequest: { updateMany: jest.fn(async () => ({ count: 1 })) },
      auditLog: { create: jest.fn(async () => ({})) },
    };
    const merchants = { assertActiveMerchant: jest.fn(async () => ({ profile: shop(), settings: defaultSettings().merchant })), settingsFor: jest.fn(async () => defaultSettings().merchant) };
    const pins = { assertPin: jest.fn(async () => undefined) };
    const notifier = { notifyUser: jest.fn(async () => undefined) };
    return { service: new MerchantStaffService(prisma as any, merchants as any, pins as any, notifier as any), prisma, pins, notifier, rows };
  }

  it('ajoute par numéro : code secret contrôlé, droits limités par défaut, la personne est prévenue (espace client)', async () => {
    const t = ssetup();
    const v = await t.service.add(owner, { pin: '486213', phone: '+224 620 00 00 05' });
    expect(t.pins.assertPin).toHaveBeenCalledWith('mer', '486213');
    expect(v).toMatchObject({ userId: 'caiss', active: true, canRefund: false, maxAmount: null, name: 'Kadiatou Camara' });
    expect(v.phoneMasked).not.toContain('620000005');
    expect(t.notifier.notifyUser).toHaveBeenCalledWith(expect.objectContaining({ id: 'caiss' }), expect.objectContaining({ kind: 'STAFF_ADDED', actionUrl: '/cashier' }));
  });

  it('plafond fixé à l’ajout', async () => {
    const t = ssetup();
    expect((await t.service.add(owner, { pin: '486213', phone: '+224620000005', maxAmount: 50_000, canRefund: true })).maxAmount).toBe(50_000);
    await expect(ssetup().service.add(owner, { pin: '486213', phone: '+224620000005', maxAmount: -1 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refus : numéro invalide, inconnu, soi-même, déjà caissier, équipe pleine', async () => {
    await expect(ssetup().service.add(owner, { pin: '486213', phone: '0620000005' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ssetup({ person: null }).service.add(owner, { pin: '486213', phone: '+224620000005' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(ssetup({ person: { id: 'mer', email: 'm@x.fr' } }).service.add(owner, { pin: '486213', phone: '+224620000001' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ssetup({ existing: { id: 'st1', active: true } }).service.add(owner, { pin: '486213', phone: '+224620000005' })).rejects.toBeInstanceOf(ConflictException);
    await expect(ssetup({ activeCount: 10 }).service.add(owner, { pin: '486213', phone: '+224620000005' })).rejects.toThrow(/10 caissiers/);
  });

  it('code secret faux : personne n’est ajouté', async () => {
    const t = ssetup();
    t.pins.assertPin.mockRejectedValue(new ForbiddenException({ code: 'PIN_INVALID' }));
    await expect(t.service.add(owner, { pin: '000000', phone: '+224620000005' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(t.prisma.merchantStaff.create).not.toHaveBeenCalled();
  });

  it('un ancien caissier suspendu est réactivé (pas de doublon)', async () => {
    const t = ssetup({ existing: { id: 'st1', merchantId: 'mp1', userId: 'caiss', active: false, canRefund: true } });
    const v = await t.service.add(owner, { pin: '486213', phone: '+224620000005' });
    expect(t.prisma.merchantStaff.create).not.toHaveBeenCalled();
    expect(v).toMatchObject({ active: true, canRefund: false });
  });

  it('accorder le droit de rembourser exige le code secret ; le retirer non', async () => {
    const t = ssetup({ existing: { id: 'st1', merchantId: 'mp1', userId: 'caiss', active: true, canRefund: false } });
    await expect(t.service.update(owner, 'st1', { canRefund: true })).rejects.toThrow(/code secret/i);
    expect((await t.service.update(owner, 'st1', { canRefund: true, pin: '486213' })).canRefund).toBe(true);
    t.pins.assertPin.mockClear();
    expect((await t.service.update(owner, 'st1', { canRefund: false })).canRefund).toBe(false);
    expect(t.pins.assertPin).not.toHaveBeenCalled();
  });

  it('suspendre ou retirer un caissier ferme ses demandes encore ouvertes (un QR affiché ne doit plus être payable)', async () => {
    const a = ssetup({ existing: { id: 'st1', merchantId: 'mp1', userId: 'caiss', active: true } });
    await a.service.update(owner, 'st1', { active: false });
    expect(a.prisma.paymentRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ createdById: 'caiss', status: 'PENDING' }) }));
    const b = ssetup({ existing: { id: 'st1', merchantId: 'mp1', userId: 'caiss', active: true } });
    await expect(b.service.remove(owner, 'st1')).resolves.toEqual({ removed: true });
    expect(b.prisma.paymentRequest.updateMany).toHaveBeenCalled();
    expect(b.rows).toHaveLength(0);
    expect(kinds(b.notifier.notifyUser)).toEqual(['STAFF_REMOVED']);
  });

  it("un caissier d'un autre commerce est introuvable", async () => {
    const t = ssetup({ existing: { id: 'st1', merchantId: 'AUTRE', userId: 'caiss', active: true } });
    await expect(t.service.update(owner, 'st1', { active: false })).rejects.toBeInstanceOf(NotFoundException);
    await expect(t.service.remove(owner, 'st1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ── Clôture et export ────────────────────────────────────
describe('clôture de caisse et export', () => {
  const T0 = new Date();
  const todayUtc = T0.toISOString().slice(0, 10);
  const sale = (over: J = {}) => ({ id: 's1', reference: 'MP-1', paidAt: new Date(T0.getTime() - 60_000), currency: 'XOF', amount: 10_000, fee: 100, netAmount: 9_900, method: 'QR', viaStaticQr: false, createdById: null, note: null, payerPhone: null, refundedAt: null, payer: { firstName: 'Mamadou', lastName: 'Barry' }, ...over });

  function rsetup(sales: J[], refunds: J[] = [], closings: J[] = []) {
    const created: J[] = [...closings];
    const prisma: J = {
      paymentRequest: {
        findMany: jest.fn(async ({ where }: J) => (where.refundedAt ? refunds : sales)),
      },
      user: { findMany: jest.fn(async () => [{ id: 'caiss', firstName: 'Kadiatou', lastName: 'Camara', email: 'k@x.fr' }]), findUnique: jest.fn(async () => ({ id: 'mer', email: 'm@x.fr', firstName: 'Awa' })) },
      merchantClosing: {
        findMany: jest.fn(async () => created),
        create: jest.fn(async ({ data }: J) => { const c = { id: `c${created.length + 1}`, closedAt: new Date(), ...data }; created.push(c); return c; }),
      },
      auditLog: { create: jest.fn(async () => ({})) },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const merchants = { assertActiveMerchant: jest.fn(async () => ({ profile: shop(), settings: defaultSettings().merchant })) };
    const pins = { assertPin: jest.fn(async () => undefined) };
    const notifier = { notifyUser: jest.fn(async () => undefined) };
    return { service: new MerchantReportsService(prisma as any, merchants as any, pins as any, notifier as any), prisma, pins, notifier, created };
  }

  it('journée en direct : totaux par devise, par moyen, par caissier (nommé)', async () => {
    const t = rsetup([sale(), sale({ id: 's2', createdById: 'caiss', method: 'PHONE', amount: 5000, fee: 50, netAmount: 4950 })], [{ id: 'f1', reference: 'MP-9', refundedAt: T0, currency: 'XOF', amount: 3000, refundReason: null, payer: null }]);
    const d = await t.service.day(owner, { day: todayUtc, tz: 0 });
    expect(d.live[0]).toMatchObject({ currency: 'XOF', count: 2, gross: 15_000, fees: 150, net: 14_850, refundsCount: 1, refundsTotal: 3000, balanceChange: 11_850 });
    expect(d.live[0].byCashierNamed.map((c: J) => c.name).sort()).toEqual(['Kadiatou Camara', 'Propriétaire']);
    expect(d.closings).toEqual([]);
    expect(d.drift).toBe(false);
  });

  it('clôture : code secret exigé, une ligne par devise, photo figée, notification', async () => {
    const t = rsetup([sale(), sale({ id: 's2', currency: 'EUR', amount: 12.5, fee: 0.13, netAmount: 12.37 })]);
    const out = await t.service.close(owner, { day: todayUtc, tz: 0, pin: '486213' });
    expect(t.pins.assertPin).toHaveBeenCalledWith('mer', '486213');
    expect(t.created.map((c) => c.currency).sort()).toEqual(['EUR', 'XOF']);
    expect(out.closings).toHaveLength(2);
    expect(out.closings.find((c: J) => c.currency === 'XOF')).toMatchObject({ count: 1, gross: 10_000, net: 9_900 });
    expect(kinds(t.notifier.notifyUser)).toEqual(['DAY_CLOSED']);
  });

  it('une journée ne se clôture qu’une fois par devise (409), pas dans le futur, pas à vide, pas sans bon code secret', async () => {
    const t = rsetup([sale()]);
    await t.service.close(owner, { day: todayUtc, tz: 0, pin: '486213' });
    await expect(t.service.close(owner, { day: todayUtc, tz: 0, pin: '486213' })).rejects.toBeInstanceOf(ConflictException);
    await expect(rsetup([sale()]).service.close(owner, { day: '2999-01-01', tz: 0, pin: '486213' })).rejects.toThrow(/pas encore eu lieu/);
    await expect(rsetup([]).service.close(owner, { day: todayUtc, tz: 0, pin: '486213' })).rejects.toThrow(/rien à clôturer/);
    const bad = rsetup([sale()]);
    bad.pins.assertPin.mockRejectedValue(new ForbiddenException({ code: 'PIN_INVALID' }));
    await expect(bad.service.close(owner, { day: todayUtc, tz: 0, pin: '000000' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(bad.created).toHaveLength(0);
  });

  it('écart signalé quand un paiement arrive APRÈS la clôture', async () => {
    const sales = [sale()];
    const t = rsetup(sales);
    await t.service.close(owner, { day: todayUtc, tz: 0, pin: '486213' });
    sales.push(sale({ id: 's3' }));
    const d = await t.service.day(owner, { day: todayUtc, tz: 0 });
    expect(d.drift).toBe(true);
    expect(d.closings[0].count).toBe(1); // la photo figée n'a pas bougé
    expect(d.live[0].count).toBe(2);
  });

  it('CSV : en-têtes, BOM, remboursements en négatif, noms de caissiers, nom de fichier daté', async () => {
    const t = rsetup([sale({ createdById: 'caiss', note: '=cmd()' })], [{ id: 'f1', reference: 'MP-9', refundedAt: T0, currency: 'XOF', amount: 3000, refundReason: 'Article rendu', payer: { firstName: 'Mamadou', lastName: 'Barry' } }]);
    const f = await t.service.csv(owner, { from: todayUtc, to: todayUtc, tz: 0 });
    expect(f.filename).toBe(`encaissements_${todayUtc}_${todayUtc}.csv`);
    expect(f.body.startsWith('﻿Date (heure locale);Type;Référence;Moyen;Client;Caissier;Montant;Commission;Net;Devise;Statut;Libellé / motif\r\n')).toBe(true);
    expect(f.body).toContain('Paiement;MP-1;QR code;Mamadou Barry;Kadiatou Camara;10000;100;9900;XOF;;\'=cmd()');
    expect(f.body).toContain('Remboursement;MP-9;;Mamadou Barry;;-3000;0;-3000;XOF;;Article rendu');
  });

  it('période invalide ou trop longue : 400', async () => {
    const t = rsetup([]);
    await expect(t.service.report(owner, { from: '2026-02-30', to: '2026-03-01' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(t.service.report(owner, { from: '2026-01-01', to: '2026-12-31' })).rejects.toThrow(/trop longue/i);
  });
});

// ── Logo ─────────────────────────────────────────────────
describe('logo du commerce', () => {
  function lsetup() {
    const store: J = {};
    const prisma: J = {
      merchantLogo: {
        upsert: jest.fn(async ({ create }: J) => { store.logo = create; return create; }),
        deleteMany: jest.fn(async () => { const had = !!store.logo; delete store.logo; return { count: had ? 1 : 0 }; }),
        findFirst: jest.fn(async ({ where }: J) => (store.logo && where.merchant.clientId === 7 ? store.logo : null)),
      },
      merchantProfile: { findUnique: jest.fn(async () => ({ id: 'mp1' })) },
    };
    const merchants = { assertActiveMerchant: jest.fn(async () => ({ profile: shop(), settings: defaultSettings().merchant })) };
    return { service: new MerchantLogoService(prisma as any, merchants as any), prisma, store };
  }
  // PNG valide minimal (en-tête) complété pour dépasser la taille minimale
  const png = (extra = 20_000) => `data:image/png;base64,${Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(extra, 1)]).toString('base64')}`;

  it('enregistre une image, lisible seulement dans la société du commerce', async () => {
    const t = lsetup();
    const r = await t.service.save('mer', png());
    expect(r.mimeType).toBe('image/png');
    expect(await t.service.version('mp1', 7)).toBe(r.version);
    expect(await t.service.version('mp1', 99)).toBeNull();
    await expect(t.service.read('mp1', 99)).rejects.toBeInstanceOf(NotFoundException);
    expect((await t.service.read('mp1', 7)).sha256).toBe(r.version);
  });

  it('refuse : trop lourd, trop petit, pas une image, PDF', async () => {
    const t = lsetup();
    await expect(t.service.save('mer', png(1.5 * 1024 * 1024))).rejects.toThrow(/1 Mo/);
    await expect(t.service.save('mer', png(10))).rejects.toBeInstanceOf(BadRequestException);
    await expect(t.service.save('mer', 'ceci nest pas une image'.repeat(20))).rejects.toBeInstanceOf(BadRequestException);
    await expect(t.service.save('mer', `data:application/pdf;base64,${Buffer.from('%PDF-1.4 ' + 'x'.repeat(3000)).toString('base64')}`)).rejects.toBeInstanceOf(BadRequestException);
    expect(t.prisma.merchantLogo.upsert).not.toHaveBeenCalled();
  });

  it('retirer le logo', async () => {
    const t = lsetup();
    await t.service.save('mer', png());
    await expect(t.service.remove('mer')).resolves.toEqual({ removed: true });
    await expect(t.service.remove('mer')).resolves.toEqual({ removed: false });
  });
});
