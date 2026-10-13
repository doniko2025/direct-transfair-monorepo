// apps/backend/src/transfer-limits/transfer-limits.spec.ts
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { checkLimitOrder, defaultLimits, evaluateLimits, KYC_LEVELS, type Limits } from './transfer-limit-defaults';
import { breachMessage, periodStarts, TransferLimitsService } from './transfer-limits.service';

describe('plafonds par défaut', () => {
  it('croissent avec le niveau KYC, dans chaque devise', () => {
    for (const cur of ['EUR', 'XOF', 'GNF', 'USD', 'GBP']) {
      for (const k of ['perTransaction', 'daily', 'monthly', 'yearly'] as const) {
        const values = KYC_LEVELS.map((l) => defaultLimits(l, cur)[k] as number);
        expect([...values].sort((a, b) => a - b)).toEqual(values);
        expect(new Set(values).size).toBe(values.length);
      }
    }
  });

  it('respectent par envoi ≤ jour ≤ mois ≤ an', () => {
    for (const l of KYC_LEVELS) expect(checkLimitOrder(defaultLimits(l, 'XOF'))).toBeNull();
  });

  it('mettent XOF à l\'échelle ×650 et GNF ×10 000', () => {
    expect(defaultLimits('LEVEL_1', 'EUR').daily).toBe(1_000);
    expect(defaultLimits('LEVEL_1', 'XOF').daily).toBe(650_000);
    expect(defaultLimits('LEVEL_1', 'GNF').daily).toBe(10_000_000);
  });
});

describe('evaluateLimits', () => {
  const limits: Limits = { perTransaction: 500, daily: 1000, monthly: 3000, yearly: 15000 };
  const none = { daily: 0, monthly: 0, yearly: 0 };

  it('laisse passer un envoi dans tous les plafonds, au plafond exact compris', () => {
    expect(evaluateLimits(limits, none, 500)).toBeNull();
    expect(evaluateLimits(limits, { daily: 500, monthly: 500, yearly: 500 }, 500)).toBeNull();
  });

  it('refuse un envoi au-dessus du plafond par envoi', () => {
    expect(evaluateLimits(limits, none, 500.01)).toMatchObject({ limit: 'perTransaction', max: 500 });
  });

  it('refuse quand le cumul du jour dépasse, avec le reste disponible', () => {
    expect(evaluateLimits(limits, { daily: 800, monthly: 800, yearly: 800 }, 300)).toEqual({ limit: 'daily', max: 1000, used: 800, remaining: 200 });
  });

  it('contrôle ensuite le mois puis l\'année', () => {
    expect(evaluateLimits(limits, { daily: 0, monthly: 2800, yearly: 2800 }, 300)).toMatchObject({ limit: 'monthly', remaining: 200 });
    expect(evaluateLimits(limits, { daily: 0, monthly: 0, yearly: 14900 }, 200)).toMatchObject({ limit: 'yearly', remaining: 100 });
  });

  it('un plafond null n\'est pas contrôlé', () => {
    const open: Limits = { perTransaction: null, daily: null, monthly: null, yearly: null };
    expect(evaluateLimits(open, { daily: 1e9, monthly: 1e9, yearly: 1e9 }, 1e9)).toBeNull();
  });

  it('un plafond à 0 bloque tout envoi', () => {
    expect(evaluateLimits({ ...limits, perTransaction: 0 }, none, 1)).toMatchObject({ limit: 'perTransaction' });
  });
});

describe('checkLimitOrder', () => {
  it('refuse un plafond plus petit que le précédent renseigné', () => {
    expect(checkLimitOrder({ perTransaction: 500, daily: 100, monthly: 1000, yearly: 2000 })).toMatch(/journalier/);
  });
  it('ignore les plafonds null dans la chaîne', () => {
    expect(checkLimitOrder({ perTransaction: 500, daily: null, monthly: 1000, yearly: null })).toBeNull();
    expect(checkLimitOrder({ perTransaction: 500, daily: null, monthly: 400, yearly: null })).toMatch(/mensuel/);
  });
});

describe('periodStarts / breachMessage', () => {
  it('calcule les débuts de période en UTC', () => {
    const p = periodStarts(new Date('2026-10-12T23:30:00Z'));
    expect(p.day.toISOString()).toBe('2026-10-12T00:00:00.000Z');
    expect(p.month.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(p.year.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
  it('rédige un message clair', () => {
    expect(breachMessage({ limit: 'daily', max: 1000, used: 800, remaining: 200 }, 'EUR')).toMatch(/journalier dépassé.*200.*1\s?000/);
    expect(breachMessage({ limit: 'perTransaction', max: 500, used: 0, remaining: 500 }, 'EUR')).toMatch(/par envoi/);
  });
});

// ── Service ──────────────────────────────────────────────
type Row = { clientId: number; kycLevel: string; currency: string; perTransaction: number | null; daily: number | null; monthly: number | null; yearly: number | null; updatedAt: Date };

function setup(opts: { rows?: Row[]; user?: any; sent?: number } = {}) {
  const rows: Row[] = [...(opts.rows ?? [])];
  const audits: any[] = [];
  const aggregates: any[] = [];
  const users: Record<string, any> = {
    c1: { id: 'c1', clientId: 7, role: 'USER', kycLevel: 'LEVEL_1', deletedAt: null },
    ag: { id: 'ag', clientId: 7, role: 'AGENT', kycLevel: 'LEVEL_1', deletedAt: null },
    ...(opts.user ? { [opts.user.id]: opts.user } : {}),
  };
  const prisma: any = {
    user: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
        const u = users[where.id];
        if (!u || u.clientId !== where.clientId) return null;
        if (where.role && u.role !== where.role) return null;
        if (where.deletedAt === null && u.deletedAt) return null;
        return u;
      }),
      update: jest.fn().mockImplementation(async ({ where, data }: any) => { Object.assign(users[where.id], data); }),
    },
    client: { findUnique: jest.fn().mockResolvedValue({ id: 7, name: 'Flash', code: 'F' }) },
    transferLimit: {
      findMany: jest.fn().mockImplementation(async ({ where }: any) => rows.filter((r) => r.clientId === where.clientId)),
      findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
        const k = where.clientId_kycLevel_currency;
        return rows.find((r) => r.clientId === k.clientId && r.kycLevel === k.kycLevel && r.currency === k.currency) ?? null;
      }),
      upsert: jest.fn().mockImplementation(async ({ where, create, update }: any) => {
        const k = where.clientId_kycLevel_currency;
        const f = rows.find((r) => r.clientId === k.clientId && r.kycLevel === k.kycLevel && r.currency === k.currency);
        if (f) Object.assign(f, update, { updatedAt: new Date() }); else rows.push({ ...create, updatedAt: new Date() });
      }),
      deleteMany: jest.fn().mockImplementation(async ({ where }: any) => {
        for (let i = rows.length - 1; i >= 0; i--) if (rows[i].clientId === where.clientId && rows[i].kycLevel === where.kycLevel && rows[i].currency === where.currency) rows.splice(i, 1);
      }),
    },
    transaction: {
      aggregate: jest.fn().mockImplementation(async (args: any) => { aggregates.push(args); return { _sum: { amount: opts.sent ?? 0 } }; }),
    },
    auditLog: { create: jest.fn().mockImplementation(async ({ data }: any) => { audits.push(data); }), findMany: jest.fn().mockResolvedValue([]) },
  };
  return { service: new TransferLimitsService(prisma), prisma, rows, audits, aggregates, users };
}

const admin: any = { id: 'a1', role: 'COMPANY_ADMIN', clientId: 7 };
const superAdmin: any = { id: 's1', role: 'SUPER_ADMIN', clientId: null };
const all = { perTransaction: 100, daily: 200, monthly: 500, yearly: 2000 };

describe('TransferLimitsService.assertWithinLimits', () => {
  it('ne contrôle pas un agent', async () => {
    const { service, prisma } = setup();
    await expect(service.assertWithinLimits(prisma, { clientId: 7, userId: 'ag', currency: 'EUR', amount: 1e9 })).resolves.toBeUndefined();
    expect(prisma.transaction.aggregate).not.toHaveBeenCalled();
  });

  it('applique les plafonds par défaut du niveau KYC du client', async () => {
    const { service, prisma } = setup(); // LEVEL_1 : 500 € par envoi
    await expect(service.assertWithinLimits(prisma, { clientId: 7, userId: 'c1', currency: 'EUR', amount: 500 })).resolves.toBeUndefined();
    await expect(service.assertWithinLimits(prisma, { clientId: 7, userId: 'c1', currency: 'EUR', amount: 501 })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('utilise le plafond réglé par la société à la place du défaut', async () => {
    const { service, prisma } = setup({ rows: [{ clientId: 7, kycLevel: 'LEVEL_1', currency: 'XOF', perTransaction: 2_000_000, daily: 5_000_000, monthly: 9_000_000, yearly: 90_000_000, updatedAt: new Date() }] });
    await expect(service.assertWithinLimits(prisma, { clientId: 7, userId: 'c1', currency: 'XOF', amount: 1_900_000 })).resolves.toBeUndefined();
  });

  it('refuse avec le code LIMIT_EXCEEDED et le reste disponible', async () => {
    const { service, prisma } = setup({ sent: 900 }); // défaut LEVEL_1 EUR : 1000 par jour
    try {
      await service.assertWithinLimits(prisma, { clientId: 7, userId: 'c1', currency: 'EUR', amount: 200 });
      throw new Error('aurait dû refuser');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ForbiddenException);
      expect(e.getResponse()).toMatchObject({ code: 'LIMIT_EXCEEDED', limit: 'daily', max: 1000, used: 900, remaining: 100, currency: 'EUR' });
      expect(String(e.getResponse().message)).toMatch(/journalier/);
    }
  });

  it('compte les envois en cours ou réussis du client, dans la devise, et exclut les annulés', async () => {
    const { service, prisma, aggregates } = setup({ sent: 0 });
    await service.assertWithinLimits(prisma, { clientId: 7, userId: 'c1', currency: 'EUR', amount: 10 });
    const where = aggregates[0].where;
    expect(where).toMatchObject({ clientId: 7, senderId: 'c1', currency: 'EUR' });
    expect(where.status.in).toEqual(expect.arrayContaining(['PENDING', 'VALIDATED', 'PROCESSING', 'PAID']));
    expect(where.status.in).not.toContain('CANCELLED');
    expect(where.status.in).not.toContain('REFUNDED');
    expect(where.type.in).toEqual(['TRANSFER', 'SCHEDULED']);
    expect(aggregates).toHaveLength(3);
  });

  it('ne lit pas les cumuls quand seuls des plafonds par envoi existent', async () => {
    const { service, prisma } = setup({ rows: [{ clientId: 7, kycLevel: 'LEVEL_1', currency: 'EUR', perTransaction: 300, daily: null, monthly: null, yearly: null, updatedAt: new Date() }] });
    await service.assertWithinLimits(prisma, { clientId: 7, userId: 'c1', currency: 'EUR', amount: 300 });
    expect(prisma.transaction.aggregate).not.toHaveBeenCalled();
  });

  it('ne lit que les plafonds de SA société', async () => {
    const { service, prisma } = setup({ rows: [{ clientId: 8, kycLevel: 'LEVEL_1', currency: 'EUR', perTransaction: 1, daily: 1, monthly: 1, yearly: 1, updatedAt: new Date() }] });
    await expect(service.assertWithinLimits(prisma, { clientId: 7, userId: 'c1', currency: 'EUR', amount: 400 })).resolves.toBeUndefined();
  });
});

describe('TransferLimitsService.get', () => {
  it('liste 4 niveaux × 5 devises avec le défaut ou la valeur réglée', async () => {
    const { service } = setup({ rows: [{ clientId: 7, kycLevel: 'LEVEL_2', currency: 'EUR', ...all, updatedAt: new Date() }] });
    const res = await service.get(admin);
    expect(res.limits).toHaveLength(20);
    expect(res.editable).toBe(true);
    expect(res.limits.find((l) => l.kycLevel === 'LEVEL_2' && l.currency === 'EUR')).toMatchObject({ ...all, configured: true });
    expect(res.limits.find((l) => l.kycLevel === 'LEVEL_0' && l.currency === 'EUR')).toMatchObject({ daily: 200, configured: false });
  });

  it('super admin : lecture seule, société obligatoire', async () => {
    const { service } = setup();
    await expect(service.get(superAdmin)).rejects.toBeInstanceOf(BadRequestException);
    expect((await service.get(superAdmin, 7)).editable).toBe(false);
  });
});

describe('TransferLimitsService.set / reset', () => {
  it('refuse tout rôle autre que l\'admin de société', async () => {
    const { service } = setup();
    await expect(service.set(superAdmin, 'LEVEL_1', 'EUR', all)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.reset({ id: 'g', role: 'AGENT', clientId: 7 } as any, 'LEVEL_1', 'EUR')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuse niveau ou devise inconnus, incohérence et plus de deux décimales', async () => {
    const { service } = setup();
    await expect(service.set(admin, 'LEVEL_9', 'EUR', all)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.set(admin, 'LEVEL_1', 'ABC', all)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.set(admin, 'LEVEL_1', 'EUR', { ...all, daily: 50 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.set(admin, 'LEVEL_1', 'EUR', { ...all, daily: 200.123 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enregistre dans SA société, journalise, accepte null (sans plafond)', async () => {
    const { service, rows, audits } = setup();
    const view = await service.set(admin, 'level_1', 'eur', { perTransaction: 100, daily: null, monthly: null, yearly: null });
    expect(view).toMatchObject({ kycLevel: 'LEVEL_1', currency: 'EUR', perTransaction: 100, daily: null, configured: true });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ clientId: 7, kycLevel: 'LEVEL_1', currency: 'EUR' });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ clientId: 7, entity: 'TransferLimit', entityId: 'LEVEL_1:EUR' });
  });

  it('une valeur identique ne réécrit rien', async () => {
    const { service, prisma } = setup({ rows: [{ clientId: 7, kycLevel: 'LEVEL_1', currency: 'EUR', ...all, updatedAt: new Date() }] });
    await service.set(admin, 'LEVEL_1', 'EUR', all);
    expect(prisma.transferLimit.upsert).not.toHaveBeenCalled();
  });

  it('reset supprime la ligne de SA société et revient aux défauts', async () => {
    const { service, rows } = setup({ rows: [
      { clientId: 7, kycLevel: 'LEVEL_1', currency: 'EUR', ...all, updatedAt: new Date() },
      { clientId: 8, kycLevel: 'LEVEL_1', currency: 'EUR', ...all, updatedAt: new Date() },
    ] });
    const view = await service.reset(admin, 'LEVEL_1', 'EUR');
    expect(view).toMatchObject({ configured: false, daily: 1000 });
    expect(rows).toHaveLength(1);
    expect(rows[0].clientId).toBe(8);
  });
});

describe('TransferLimitsService.setUserKycLevel', () => {
  it('change le niveau d\'un client de la société et journalise', async () => {
    const { service, users, audits } = setup();
    await expect(service.setUserKycLevel(admin, 'c1', 'LEVEL_3')).resolves.toMatchObject({ kycLevel: 'LEVEL_3', changed: true });
    expect(users.c1.kycLevel).toBe('LEVEL_3');
    expect(audits[0]).toMatchObject({ entity: 'UserKycLevel', action: 'USER_UPDATE', clientId: 7 });
  });

  it('refuse un agent ou un utilisateur d\'une autre société, et le super admin', async () => {
    const { service } = setup({ user: { id: 'other', clientId: 9, role: 'USER', kycLevel: 'LEVEL_0', deletedAt: null } });
    await expect(service.setUserKycLevel(admin, 'ag', 'LEVEL_2')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.setUserKycLevel(admin, 'other', 'LEVEL_2')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.setUserKycLevel(superAdmin, 'c1', 'LEVEL_2')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.setUserKycLevel(admin, 'c1', 'LEVEL_7')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('même niveau : rien n\'est écrit', async () => {
    const { service, prisma } = setup();
    await expect(service.setUserKycLevel(admin, 'c1', 'LEVEL_1')).resolves.toMatchObject({ changed: false });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('SetLimitsDto', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { plainToInstance } = require('class-transformer');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { validate } = require('class-validator');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { SetLimitsDto } = require('./dto/transfer-limit.dto');
  const errs = async (body: unknown) => (await validate(plainToInstance(SetLimitsDto, body))).length;

  it('accepte des montants et null (sans plafond)', async () => {
    expect(await errs({ perTransaction: 100, daily: 200, monthly: null, yearly: null })).toBe(0);
  });
  it('exige les quatre champs (un champ absent est refusé)', async () => {
    expect(await errs({ perTransaction: 100, daily: 200, monthly: 300 })).toBeGreaterThan(0);
  });
  it('refuse négatif, texte et valeur démesurée', async () => {
    expect(await errs({ perTransaction: -1, daily: null, monthly: null, yearly: null })).toBeGreaterThan(0);
    expect(await errs({ perTransaction: 'abc', daily: null, monthly: null, yearly: null })).toBeGreaterThan(0);
    expect(await errs({ perTransaction: 1e15, daily: null, monthly: null, yearly: null })).toBeGreaterThan(0);
  });
});
