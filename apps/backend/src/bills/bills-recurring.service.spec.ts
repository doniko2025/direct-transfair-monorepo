// Factures récurrentes : le prélèvement automatique ne se déclenche que si la société l'a ouvert, une seule fois par échéance,
// une échéance très en retard est sautée, trois échecs mettent en pause, le rappel n'est envoyé qu'une fois.
import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { defaultSettings, mergeSettings } from '../company-settings/company-settings.logic';
import { BillsRecurringService } from './bills-recurring.service';

type J = Record<string, any>;

const USER: J = { id: 'u1', email: 'c@x.fr', firstName: 'Mamadou', role: 'USER', kycLevel: 'LEVEL_2', clientId: 7, isActive: true, isSuspended: false, deletedAt: null, primaryCurrency: 'GNF' };
const BILLER: J = { id: 'b1', clientId: 7, name: 'Agence Immo', category: 'RENT', currency: 'GNF', status: 'ACTIVE', amountMode: 'FREE', minAmount: null, maxAmount: null, referenceLabel: 'N° de bail', referencePattern: null, fields: [] };
const NOW = new Date('2026-11-20T10:00:00Z');
const due = (iso: string) => new Date(iso);

function setup(opts: { bills?: J; schedules?: J[]; pay?: jest.Mock; pinOk?: boolean } = {}) {
  const settings = mergeSettings({ bills: { enabled: true, recurring: { autoDebitEnabled: true }, ...(opts.bills ?? {}) } });
  const rows: J[] = (opts.schedules ?? []).map((r) => ({
    id: 's1', clientId: 7, userId: 'u1', billerId: 'b1', label: 'Loyer', accountRef: 'BAIL-1', fields: null, amount: 500_000, walletCurrency: null,
    frequency: 'MONTHLY', anchorDay: 20, mode: 'AUTO', status: 'ACTIVE', nextRunAt: due('2026-11-20T08:00:00Z'), endAt: null,
    remindedFor: null, retryAt: null, failureCount: 0, lastError: null, lastRunAt: null, lastPaymentId: null, runsCount: 0, consentAt: NOW, createdAt: NOW, ...r, biller: BILLER,
  }));
  const notifications: J[] = [];
  const audits: J[] = [];
  const matches = (r: J, w: J = {}): boolean =>
    Object.entries(w).every(([k, v]) => {
      if (k === 'OR') return (v as J[]).some((o) => matches(r, o));
      if (k === 'biller') return true;
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        const x = v as J;
        if ('lte' in x && r[k] !== null && r[k] > x.lte) return false;
        if ('lte' in x && r[k] === null) return false;
        if ('gt' in x && !(r[k] > x.gt)) return false;
        if ('not' in x) return r[k] !== x.not;
        return true;
      }
      return v instanceof Date ? r[k]?.getTime() === v.getTime() : r[k] === v;
    });
  const apply = (r: J, data: J) => {
    for (const [k, v] of Object.entries(data)) r[k] = v && typeof v === 'object' && 'increment' in (v as J) ? (r[k] ?? 0) + (v as J).increment : v;
  };
  const prisma: J = {
    user: { findUnique: jest.fn(async ({ where }: J) => ({ ...USER, id: where.id })) },
    biller: { findFirst: jest.fn(async ({ where }: J) => (where.id === 'b1' && where.status === 'ACTIVE' ? BILLER : null)) },
    billSchedule: {
      count: jest.fn(async () => rows.filter((r) => r.status !== 'ENDED').length),
      findMany: jest.fn(async ({ where }: J) => rows.filter((r) => matches(r, where))),
      findFirst: jest.fn(async ({ where }: J) => rows.find((r) => r.id === where.id && r.userId === where.userId) ?? null),
      create: jest.fn(async ({ data }: J) => { const r = { id: `s${rows.length + 1}`, createdAt: NOW, ...data, biller: BILLER, status: 'ACTIVE', failureCount: 0, runsCount: 0 }; rows.push(r); return r; }),
      update: jest.fn(async ({ where, data }: J) => { const r = rows.find((x) => x.id === where.id)!; apply(r, data); return r; }),
      updateMany: jest.fn(async ({ where, data }: J) => { const hit = rows.filter((r) => matches(r, where)); hit.forEach((r) => apply(r, data)); return { count: hit.length }; }),
      deleteMany: jest.fn(async ({ where }: J) => { const i = rows.findIndex((r) => r.id === where.id && r.userId === where.userId); if (i >= 0) rows.splice(i, 1); return { count: i >= 0 ? 1 : 0 }; }),
    },
    auditLog: { create: jest.fn(async ({ data }: J) => { audits.push(data); return {}; }) },
  };
  const pay = opts.pay ?? jest.fn(async () => ({ id: 'pay1' }));
  const notifier: J = { notifyUser: jest.fn(async (_u: J, m: J) => { notifications.push(m); }) };
  const pins: J = { assertPin: jest.fn(async () => { if (opts.pinOk === false) throw new ForbiddenException('Code secret incorrect'); }) };
  const kyc: J = { assertVerified: jest.fn(async () => undefined) };
  const svc = new BillsRecurringService(prisma as never, { forClient: jest.fn(async () => settings) } as never, { payForSchedule: pay } as never, kyc as never, pins as never, notifier as never);
  return { svc, rows, pay, notifications, audits, pins, kyc, prisma };
}

describe('BillsRecurringService — planificateur', () => {
  it('prélèvement automatique : une facture payée avec la clé d\'idempotence de l\'échéance, puis programmation avancée', async () => {
    const t = setup({ schedules: [{}] });
    const res = await t.svc.sweep(NOW);
    expect(res.processed).toBe(1);
    expect(t.pay).toHaveBeenCalledTimes(1);
    expect(t.pay).toHaveBeenCalledWith('u1', 'b1', 's1', expect.objectContaining({ reference: 'BAIL-1', amount: 500_000, idempotencyKey: 'sched-s1-2026-11-20' }));
    expect(t.rows[0].nextRunAt.toISOString().slice(0, 10)).toBe('2026-12-20');
    expect(t.rows[0].runsCount).toBe(1);
    expect(t.rows[0].lastPaymentId).toBe('pay1');
    // Un second balayage immédiat ne repaie pas la même échéance.
    await t.svc.sweep(NOW);
    expect(t.pay).toHaveBeenCalledTimes(1);
  });

  it('prélèvement automatique FERMÉ par la société : aucun débit, simple rappel, programmation avancée', async () => {
    const t = setup({ bills: { recurring: { autoDebitEnabled: false } }, schedules: [{}] });
    await t.svc.sweep(NOW);
    expect(t.pay).not.toHaveBeenCalled();
    expect(t.notifications.map((n) => n.kind)).toEqual(['BILL_REMINDER']);
    expect(t.rows[0].nextRunAt.toISOString().slice(0, 10)).toBe('2026-12-20');
  });

  it('module récurrent fermé : rien n\'est débité ni avancé', async () => {
    const t = setup({ bills: { recurring: { enabled: false } }, schedules: [{}] });
    await t.svc.sweep(NOW);
    expect(t.pay).not.toHaveBeenCalled();
    expect(t.rows[0].nextRunAt.toISOString().slice(0, 10)).toBe('2026-11-20');
  });

  it('échéance en retard de plus de 3 jours : sautée, signalée, JAMAIS prélevée', async () => {
    const t = setup({ schedules: [{ nextRunAt: due('2026-11-10T08:00:00Z'), anchorDay: 10 }] });
    await t.svc.sweep(NOW);
    expect(t.pay).not.toHaveBeenCalled();
    expect(t.notifications[0].title).toMatch(/manquée/i);
    expect(t.rows[0].nextRunAt.toISOString().slice(0, 10)).toBe('2026-12-10');
  });

  it('échec (solde) : client prévenu, nouvelle tentative plus tard, échéance NON avancée ; puis pause au 3e échec', async () => {
    const pay = jest.fn(async () => { throw new BadRequestException('Solde insuffisant.'); });
    const t = setup({ pay, schedules: [{}] });
    await t.svc.sweep(NOW);
    expect(t.rows[0].failureCount).toBe(1);
    expect(t.rows[0].lastError).toMatch(/Solde insuffisant/);
    expect(t.rows[0].retryAt.getTime()).toBeGreaterThan(NOW.getTime());
    expect(t.rows[0].nextRunAt.toISOString().slice(0, 10)).toBe('2026-11-20');
    // Avant l'heure de ré-essai : rien.
    await t.svc.sweep(new Date(NOW.getTime() + 3_600_000));
    expect(pay).toHaveBeenCalledTimes(1);
    // 2e et 3e essais.
    await t.svc.sweep(new Date(NOW.getTime() + 7 * 3_600_000));
    await t.svc.sweep(new Date(NOW.getTime() + 14 * 3_600_000));
    expect(pay).toHaveBeenCalledTimes(3);
    expect(t.rows[0].status).toBe('PAUSED');
    expect(t.notifications.at(-1)!.kind).toBe('BILL_SCHEDULE_PAUSED');
    // En pause : plus aucun essai.
    await t.svc.sweep(new Date(NOW.getTime() + 40 * 3_600_000));
    expect(pay).toHaveBeenCalledTimes(3);
  });

  it('rappel « échéance proche » : une seule fois par échéance', async () => {
    const t = setup({ schedules: [{ mode: 'REMIND', nextRunAt: due('2026-11-22T08:00:00Z'), anchorDay: 22 }] });
    expect((await t.svc.sweep(NOW)).reminded).toBe(1);
    expect((await t.svc.sweep(NOW)).reminded).toBe(0);
    expect(t.notifications).toHaveLength(1);
    expect(t.notifications[0]).toMatchObject({ kind: 'BILL_REMINDER', actionUrl: '/bills/schedules' });
  });

  it('REMIND le jour J : rappel puis échéance avancée, aucun débit', async () => {
    const t = setup({ schedules: [{ mode: 'REMIND' }] });
    await t.svc.sweep(NOW);
    expect(t.pay).not.toHaveBeenCalled();
    expect(t.notifications[0].title).toMatch(/aujourd'hui/i);
    expect(t.rows[0].nextRunAt.toISOString().slice(0, 10)).toBe('2026-12-20');
  });

  it('date de fin atteinte : la programmation se termine après la dernière échéance', async () => {
    const t = setup({ schedules: [{ endAt: due('2026-11-30T08:00:00Z') }] });
    await t.svc.sweep(NOW);
    expect(t.rows[0].status).toBe('ENDED');
  });
});

describe('BillsRecurringService — création par le client', () => {
  const base = { billerId: 'b1', label: 'Loyer', reference: 'BAIL-1', amount: 500_000, frequency: 'MONTHLY', startDate: '2026-12-01', mode: 'REMIND' };
  const auth = { id: 'u1', role: 'USER' } as never;

  it('rappel : accepté sans code secret, jour d\'ancrage = jour de départ', async () => {
    const t = setup();
    const v = await t.svc.create(auth, { ...base, startDate: '2026-12-31' } as never);
    expect(v).toMatchObject({ mode: 'REMIND', frequency: 'MONTHLY', amount: 500_000 });
    expect(t.rows[0].anchorDay).toBe(31);
    expect(t.pins.assertPin).not.toHaveBeenCalled();
  });

  it('prélèvement automatique : code secret exigé et vérifié, consentement horodaté', async () => {
    const t = setup();
    await expect(t.svc.create(auth, { ...base, mode: 'AUTO' } as never)).rejects.toThrow(BadRequestException);
    const v = await t.svc.create(auth, { ...base, mode: 'AUTO', pin: '123456' } as never);
    expect(v.mode).toBe('AUTO');
    expect(t.pins.assertPin).toHaveBeenCalledWith('u1', '123456');
    expect(t.rows[0].consentAt).toBeInstanceOf(Date);
  });

  it('code secret faux : rien n\'est créé', async () => {
    const t = setup({ pinOk: false });
    await expect(t.svc.create(auth, { ...base, mode: 'AUTO', pin: '000000' } as never)).rejects.toThrow(ForbiddenException);
    expect(t.rows).toHaveLength(0);
  });

  it('prélèvement automatique fermé par la société : refusé, le rappel reste possible', async () => {
    const t = setup({ bills: { recurring: { autoDebitEnabled: false } } });
    await expect(t.svc.create(auth, { ...base, mode: 'AUTO', pin: '123456' } as never)).rejects.toThrow(/prélèvement automatique/i);
    await expect(t.svc.create(auth, base as never)).resolves.toBeDefined();
  });

  it('module fermé, montant manquant, facturier inconnu, quota atteint : refusés', async () => {
    await expect(setup({ bills: { enabled: false } }).svc.create(auth, base as never)).rejects.toThrow(ForbiddenException);
    await expect(setup().svc.create(auth, { ...base, amount: undefined } as never)).rejects.toThrow(BadRequestException);
    await expect(setup().svc.create(auth, { ...base, billerId: 'zz' } as never)).rejects.toThrow(/introuvable/i);
    const t = setup({ bills: { recurring: { maxPerClient: 1 } } });
    await t.svc.create(auth, base as never);
    await expect(t.svc.create(auth, base as never)).rejects.toThrow(/au maximum/i);
  });

  it('la configuration par défaut garde le prélèvement automatique fermé', () => {
    expect(defaultSettings().bills.recurring).toMatchObject({ enabled: true, autoDebitEnabled: false, maxPerClient: 10, remindDaysBefore: 2, maxFailures: 3 });
  });
});

describe('BillsRecurringService — mise en pause, reprise, suppression', () => {
  const auth = { id: 'u1', role: 'USER' } as never;

  it('pause puis reprise : on ne prélève jamais une échéance passée pendant la pause ; code secret exigé pour un prélèvement automatique', async () => {
    const t = setup({ schedules: [{ nextRunAt: due('2026-10-20T08:00:00Z'), anchorDay: 20 }] });
    await t.svc.pause(auth, 's1');
    expect(t.rows[0].status).toBe('PAUSED');
    await expect(t.svc.resume(auth, 's1', {})).rejects.toThrow(BadRequestException);
    const v = await t.svc.resume(auth, 's1', { pin: '123456' });
    expect(v.status).toBe('ACTIVE');
    expect(t.rows[0].nextRunAt.getTime()).toBeGreaterThan(Date.now());
    expect(t.rows[0].failureCount).toBe(0);
  });

  it('suppression : seulement les siennes', async () => {
    const t = setup({ schedules: [{}] });
    await expect(t.svc.remove({ id: 'u2', role: 'USER' } as never, 's1')).rejects.toThrow();
    await expect(t.svc.remove(auth, 's1')).resolves.toEqual({ removed: true });
  });
});
