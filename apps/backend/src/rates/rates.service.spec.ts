// apps/backend/src/rates/rates.service.spec.ts
// Taux PAR SOCIÉTÉ : chaque société ne lit et n'écrit que SES taux, jamais ceux d'une autre.
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { RatesService } from './rates.service';

type Row = { clientId: number | null; pair: string; rate: number; updatedAt: Date };

function build(rows: Row[]) {
  const prisma: any = {
    client: {
      findUnique: jest.fn(async ({ where }: any) => (where.code === 'FLASH' ? { id: 1 } : null)),
      findMany: jest.fn(async () => []),
    },
    exchangeRate: {
      findMany: jest.fn(async ({ where }: any) =>
        rows.filter((r) => r.clientId === where.clientId && (!where.pair || where.pair.in.includes(r.pair)))),
      upsert: jest.fn(async (a: any) => a),
    },
  };
  return { service: new RatesService(prisma), prisma };
}

const now = new Date();
const rows: Row[] = [
  { clientId: 1, pair: 'EUR_XOF', rate: 650, updatedAt: now },
  { clientId: 2, pair: 'EUR_XOF', rate: 700, updatedAt: now },
  { clientId: null, pair: 'EUR_GNF', rate: 9000, updatedAt: now }, // ancien taux « plateforme »
];

describe('RatesService — taux par société', () => {
  it('chaque société convertit avec SON taux, indépendamment des autres', async () => {
    const { service } = build(rows);
    expect(await service.convert(100, 'EUR', 'XOF', 1)).toBe(65_000);
    expect(await service.convert(100, 'EUR', 'XOF', 2)).toBe(70_000);
  });

  it('pas de repli sur le taux d\'une autre société ni sur celui de la plateforme : 503', async () => {
    const { service } = build(rows);
    await expect(service.convert(100, 'EUR', 'GNF', 1)).rejects.toThrow(ServiceUnavailableException);
    await expect(service.convert(100, 'EUR', 'XOF', 3)).rejects.toThrow(ServiceUnavailableException);
  });

  it('taux « plateforme » (sans société) : lus tels quels, sans contrôle d\'ancienneté ; société : contrôlé', async () => {
    const old = new Date(Date.now() - 400 * 3_600_000);
    const { service } = build([
      { clientId: null, pair: 'EUR_GNF', rate: 9000, updatedAt: old },
      { clientId: 1, pair: 'EUR_GNF', rate: 9100, updatedAt: old },
    ]);
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(await service.getRateFor('EUR', 'GNF', null)).toBe(9000);
      await expect(service.getRateFor('EUR', 'GNF', 1)).rejects.toThrow(ServiceUnavailableException);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('même devise → 1, sans lecture', async () => {
    const { service, prisma } = build(rows);
    expect(await service.getRateFor('XOF', 'xof', 1)).toBe(1);
    expect(prisma.exchangeRate.findMany).not.toHaveBeenCalled();
  });

  it('getAll() ne renvoie que les taux de la société demandée (format slash)', async () => {
    const { service } = build(rows);
    const list = await service.getAll(2);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ clientId: 2, pair: 'EUR/XOF', rate: 700 });
  });

  it('updateRate() écrit sous la clé (société, paire)', async () => {
    const { service, prisma } = build(rows);
    await service.updateRate(2, 'eur/xof', 705);
    expect(prisma.exchangeRate.upsert).toHaveBeenCalledWith({
      where: { clientId_pair: { clientId: 2, pair: 'EUR_XOF' } },
      update: { rate: 705 },
      create: { clientId: 2, pair: 'EUR_XOF', rate: 705 },
    });
  });

  it('missingPairs() est calculé société par société', async () => {
    const { service } = build(rows);
    const m1 = await service.missingPairs(1);
    expect(m1).not.toContain('EUR_XOF');
    expect(m1).toContain('EUR_GNF');
  });

  it('clientIdByCode() : code connu → id, inconnu → 404', async () => {
    const { service } = build(rows);
    expect(await service.clientIdByCode(' flash ')).toBe(1);
    await expect(service.clientIdByCode('NOPE')).rejects.toBeInstanceOf(NotFoundException);
  });
});
