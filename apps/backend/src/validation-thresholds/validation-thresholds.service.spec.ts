// apps/backend/src/validation-thresholds/validation-thresholds.service.spec.ts
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import {
  DEFAULT_VALIDATION_THRESHOLD,
  needsValidation,
  ValidationThresholdsService,
} from './validation-thresholds.service';

type Row = { clientId: number; currency: string; amount: number; updatedAt: Date };

function setup(initial: Row[] = []) {
  const rows: Row[] = [...initial];
  const audits: any[] = [];
  const keyOf = (w: any) => w.clientId_currency ?? w;
  const prisma: any = {
    client: { findUnique: jest.fn().mockResolvedValue({ id: 7, name: 'Flash', code: 'FLASH' }) },
    validationThreshold: {
      findMany: jest.fn().mockImplementation(async ({ where }: any) => rows.filter((r) => r.clientId === where.clientId)),
      findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
        const k = keyOf(where);
        return rows.find((r) => r.clientId === k.clientId && r.currency === k.currency) ?? null;
      }),
      upsert: jest.fn().mockImplementation(async ({ where, create, update }: any) => {
        const k = keyOf(where);
        const found = rows.find((r) => r.clientId === k.clientId && r.currency === k.currency);
        if (found) Object.assign(found, update, { updatedAt: new Date() });
        else rows.push({ ...create, updatedAt: new Date() });
      }),
      deleteMany: jest.fn().mockImplementation(async ({ where }: any) => {
        for (let i = rows.length - 1; i >= 0; i--) if (rows[i].clientId === where.clientId && rows[i].currency === where.currency) rows.splice(i, 1);
      }),
    },
    auditLog: {
      create: jest.fn().mockImplementation(async ({ data }: any) => { audits.push(data); }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  return { service: new ValidationThresholdsService(prisma), prisma, rows, audits };
}

const admin: any = { id: 'a1', role: 'COMPANY_ADMIN', clientId: 7 };
const superAdmin: any = { id: 's1', role: 'SUPER_ADMIN', clientId: null };
const agent: any = { id: 'g1', role: 'AGENT', clientId: 7 };

describe('needsValidation', () => {
  it('au seuil exact : validé d\'office ; au-dessus : en attente', () => {
    expect(needsValidation(500_000, 500_000)).toBe(false);
    expect(needsValidation(500_000.01, 500_000)).toBe(true);
    expect(needsValidation(1, 0)).toBe(true);
  });
});

describe('ValidationThresholdsService.thresholdFor', () => {
  it('renvoie 500 000 tant que rien n\'est réglé (comportement historique)', async () => {
    const { service } = setup();
    expect(DEFAULT_VALIDATION_THRESHOLD).toBe(500_000);
    await expect(service.thresholdFor(7, 'XOF')).resolves.toBe(500_000);
  });

  it('renvoie la valeur réglée de la société et de la devise demandées', async () => {
    const { service } = setup([{ clientId: 7, currency: 'EUR', amount: 1500, updatedAt: new Date() }]);
    await expect(service.thresholdFor(7, 'EUR')).resolves.toBe(1500);
    await expect(service.thresholdFor(7, 'XOF')).resolves.toBe(500_000);
    await expect(service.thresholdFor(8, 'EUR')).resolves.toBe(500_000);
  });
});

describe('ValidationThresholdsService.get', () => {
  it('liste toutes les devises, réglées ou non', async () => {
    const { service } = setup([{ clientId: 7, currency: 'EUR', amount: 1500, updatedAt: new Date() }]);
    const res = await service.get(admin);
    expect(res.editable).toBe(true);
    const eur = res.thresholds.find((t) => t.currency === 'EUR')!;
    const xof = res.thresholds.find((t) => t.currency === 'XOF')!;
    expect(eur).toMatchObject({ amount: 1500, configured: true });
    expect(xof).toMatchObject({ amount: 500_000, configured: false });
    expect(res.thresholds.map((t) => t.currency).sort()).toEqual(['EUR', 'GBP', 'GNF', 'USD', 'XOF']);
  });

  it('le super admin consulte (lecture seule) et doit préciser la société', async () => {
    const { service } = setup();
    await expect(service.get(superAdmin)).rejects.toBeInstanceOf(BadRequestException);
    const res = await service.get(superAdmin, 7);
    expect(res.editable).toBe(false);
  });

  it('un admin de société ignore clientId et reste sur sa société', async () => {
    const { service, prisma } = setup();
    await service.get(admin, 999);
    expect(prisma.client.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 7 } }));
  });
});

describe('ValidationThresholdsService.set / reset', () => {
  it('refuse tout rôle autre que l\'admin de société (super admin, agent)', async () => {
    const { service } = setup();
    await expect(service.set(superAdmin, 'XOF', { amount: 1000 })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.set(agent, 'XOF', { amount: 1000 })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.reset(superAdmin, 'XOF')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuse une devise inconnue et plus de deux décimales', async () => {
    const { service } = setup();
    await expect(service.set(admin, 'ABC', { amount: 1000 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.set(admin, 'XOF', { amount: 10.123 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.set(admin, 'XOF', { amount: -1 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.set(admin, 'XOF', { amount: Number.NaN })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fixe le seuil (devise insensible à la casse), écrit dans SA société et journalise', async () => {
    const { service, rows, audits } = setup();
    const view = await service.set(admin, 'xof', { amount: 250_000 });
    expect(view).toMatchObject({ currency: 'XOF', amount: 250_000, configured: true });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ clientId: 7, currency: 'XOF', amount: 250_000 });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ clientId: 7, userId: 'a1', entity: 'ValidationThreshold', entityId: 'XOF' });
    expect(audits[0].details.from).toEqual({ amount: 500_000, configured: false });
    expect(audits[0].details.to).toEqual({ amount: 250_000, configured: true });
  });

  it('accepte 0 (tout valider à la main)', async () => {
    const { service } = setup();
    await expect(service.set(admin, 'EUR', { amount: 0 })).resolves.toMatchObject({ amount: 0, configured: true });
  });

  it('une valeur identique ne réécrit rien et ne journalise pas', async () => {
    const { service, prisma, audits } = setup([{ clientId: 7, currency: 'XOF', amount: 1000, updatedAt: new Date() }]);
    await service.set(admin, 'XOF', { amount: 1000 });
    expect(prisma.validationThreshold.upsert).not.toHaveBeenCalled();
    expect(audits).toHaveLength(0);
  });

  it('un échec du journal ne fait pas échouer la modification', async () => {
    const { service, prisma, rows } = setup();
    prisma.auditLog.create.mockRejectedValueOnce(new Error('db'));
    await expect(service.set(admin, 'GNF', { amount: 5_000_000 })).resolves.toMatchObject({ amount: 5_000_000 });
    expect(rows).toHaveLength(1);
  });

  it('reset supprime la ligne de SA société seulement et revient à 500 000', async () => {
    const { service, rows, audits } = setup([
      { clientId: 7, currency: 'XOF', amount: 1000, updatedAt: new Date() },
      { clientId: 8, currency: 'XOF', amount: 2000, updatedAt: new Date() },
    ]);
    const view = await service.reset(admin, 'XOF');
    expect(view).toMatchObject({ amount: 500_000, configured: false });
    expect(rows).toEqual([expect.objectContaining({ clientId: 8, amount: 2000 })]);
    expect(audits).toHaveLength(1);
  });

  it('reset sans réglage existant ne fait rien', async () => {
    const { service, prisma } = setup();
    await service.reset(admin, 'XOF');
    expect(prisma.validationThreshold.deleteMany).not.toHaveBeenCalled();
  });
});

describe('plus de seuil codé en dur', () => {
  it('transactions.service.ts et agent-desk.service.ts lisent le seuil via ValidationThresholdsService', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path') as typeof import('path');
    const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\/\/.*$/gm, '');
    const tx = read('transactions/transactions.service.ts');
    const desk = read('agent-desk/agent-desk.service.ts');
    expect(tx).not.toMatch(/Decimal\(\s*500[_]?000\s*\)/);
    expect(tx).toContain('thresholds.thresholdFor(clientId, currency)');
    expect(desk).not.toMatch(/500[_]?000/);
    expect(desk).toContain('thresholds.thresholdFor(');
  });
});
