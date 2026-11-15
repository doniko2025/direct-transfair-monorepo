// apps/backend/src/rates/rate-resolver.spec.ts
// Audit argent (v4.0) — aucun taux en dur : tout vient des taux enregistrés, et un taux absent REFUSE la conversion.
// v2.0 : les taux sont propres à chaque société (aucun repli sur ceux d'une autre).
import 'reflect-metadata';
import { ServiceUnavailableException } from '@nestjs/common';
import { candidatePairs, resolveMaxAgeMs, resolveRate } from './rate-resolver';
import { RatesService } from './rates.service';

const row = (pair: string, rate: number, updatedAt?: Date) => ({ pair, rate, updatedAt });

describe('resolveRate', () => {
  it('même devise : 1', () => {
    expect(resolveRate([], 'XOF', 'xof')).toEqual({ ok: true, rate: 1, via: 'DIRECT' });
  });

  it('taux direct', () => {
    expect(resolveRate([row('EUR_XOF', 655.957)], 'EUR', 'XOF')).toEqual({ ok: true, rate: 655.957, via: 'DIRECT' });
  });

  it('taux inverse : 1 / taux enregistré', () => {
    const r = resolveRate([row('EUR_XOF', 655.957)], 'XOF', 'EUR');
    expect(r.ok && r.via).toBe('INVERSE');
    expect(r.ok && r.rate).toBeCloseTo(1 / 655.957, 10);
  });

  it('pivot EUR entre deux devises sans paire directe, avec les seules lignes en base', () => {
    const r = resolveRate([row('EUR_XOF', 656), row('EUR_GNF', 9500)], 'XOF', 'GNF');
    expect(r.ok && r.via).toBe('PIVOT_EUR');
    expect(r.ok && r.rate).toBeCloseTo((1 / 656) * 9500, 8);
  });

  it('ancien format avec slash accepté, le format canonique l\'emporte quand les deux existent', () => {
    expect(resolveRate([row('EUR/XOF', 600)], 'EUR', 'XOF')).toMatchObject({ ok: true, rate: 600 });
    expect(resolveRate([row('EUR/XOF', 600), row('EUR_XOF', 656)], 'EUR', 'XOF')).toMatchObject({ ok: true, rate: 656 });
  });

  it('AUCUN repli en dur : base vide = conversion impossible, même pour EUR/XOF', () => {
    expect(resolveRate([], 'EUR', 'XOF')).toEqual({ ok: false, reason: 'MISSING' });
    expect(resolveRate([], 'USD', 'GNF')).toEqual({ ok: false, reason: 'MISSING' });
  });

  it('un taux nul, négatif ou non numérique est ignoré', () => {
    for (const bad of [0, -5, NaN, 'abc']) {
      expect(resolveRate([{ pair: 'EUR_XOF', rate: bad }], 'EUR', 'XOF')).toEqual({ ok: false, reason: 'MISSING' });
    }
  });

  it('pivot incomplet (une seule jambe en base) : impossible', () => {
    expect(resolveRate([row('EUR_XOF', 656)], 'XOF', 'GNF')).toEqual({ ok: false, reason: 'MISSING' });
  });

  it('taux trop ancien refusé quand une ancienneté maximale est demandée', () => {
    const now = new Date('2026-11-06T12:00:00Z');
    const old = new Date('2026-11-04T12:00:00Z');
    const fresh = new Date('2026-11-06T08:00:00Z');
    const day = 24 * 3_600_000;
    expect(resolveRate([row('EUR_XOF', 656, old)], 'EUR', 'XOF', { maxAgeMs: day, now })).toEqual({ ok: false, reason: 'STALE' });
    expect(resolveRate([row('EUR_XOF', 656, fresh)], 'EUR', 'XOF', { maxAgeMs: day, now })).toMatchObject({ ok: true });
    expect(resolveRate([row('EUR_XOF', 656, old)], 'EUR', 'XOF')).toMatchObject({ ok: true }); // pas de contrôle par défaut
  });

  it('candidatePairs couvre direct, inverse et pivot, dans les deux formats', () => {
    const c = candidatePairs('XOF', 'GNF');
    expect(c).toEqual(expect.arrayContaining(['XOF_GNF', 'GNF_XOF', 'XOF_EUR', 'EUR_XOF', 'EUR_GNF', 'GNF_EUR', 'EUR/XOF', 'EUR/GNF']));
  });
});

type Row = { pair: string; rate: number; updatedAt?: Date; clientId?: number | null };

/** Double de Prisma : filtre sur la société (clientId) et sur les paires demandées, comme la vraie requête. */
function service(rows: Row[]) {
  const prisma: any = {
    exchangeRate: {
      findMany: jest.fn().mockImplementation(async ({ where }: any = {}) =>
        rows.filter((r) =>
          (where?.clientId === undefined || (r.clientId ?? null) === where.clientId) &&
          (!where?.pair?.in || where.pair.in.includes(r.pair)))),
    },
  };
  return new RatesService(prisma);
}

const CO = 7; // société de test

describe('RatesService — taux enregistrés uniquement (par société)', () => {
  afterEach(() => { delete process.env.RATE_MAX_AGE_HOURS; });

  it('convertit avec le taux de la société', async () => {
    await expect(service([{ pair: 'EUR_XOF', rate: 700, clientId: CO }]).convert(10, 'EUR', 'XOF', CO)).resolves.toBe(7000);
  });

  it('base vide : 503, jamais un taux inventé', async () => {
    await expect(service([]).convert(10, 'EUR', 'XOF', CO)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('isolation : le taux d\'une autre société n\'est jamais utilisé (aucun repli)', async () => {
    const s = service([{ pair: 'EUR_XOF', rate: 700, clientId: 8 }]);
    await expect(s.convert(10, 'EUR', 'XOF', CO)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(s.convert(10, 'EUR', 'XOF', 8)).resolves.toBe(7000);
  });

  it('chaque société garde son propre taux pour la même paire', async () => {
    const s = service([{ pair: 'EUR_XOF', rate: 650, clientId: 7 }, { pair: 'EUR_XOF', rate: 660, clientId: 8 }]);
    await expect(s.convert(1, 'EUR', 'XOF', 7)).resolves.toBe(650);
    await expect(s.convert(1, 'EUR', 'XOF', 8)).resolves.toBe(660);
  });

  it('anciens taux « plateforme » (clientId null) : lus sans société, jamais pour une société', async () => {
    const s = service([{ pair: 'EUR_XOF', rate: 656, clientId: null }]);
    await expect(s.convert(1, 'EUR', 'XOF')).resolves.toBe(656);
    await expect(s.convert(1, 'EUR', 'XOF', CO)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('la méthode getRate() synchrone (qui lisait la table en dur) n\'existe plus', () => {
    expect((service([]) as any).getRate).toBeUndefined();
  });

  it('RATE_MAX_AGE_HOURS : un taux de société plus vieux que la limite est refusé', async () => {
    process.env.RATE_MAX_AGE_HOURS = '24';
    const old = new Date(Date.now() - 48 * 3_600_000);
    await expect(service([{ pair: 'EUR_XOF', rate: 700, updatedAt: old, clientId: CO }]).convert(1, 'EUR', 'XOF', CO)).rejects.toThrow(/trop ancien/);
  });

  it('RATE_MAX_AGE_HOURS : les anciens taux « plateforme » (sans société) sont exemptés du contrôle d\'ancienneté', async () => {
    process.env.RATE_MAX_AGE_HOURS = '24';
    const old = new Date(Date.now() - 48 * 3_600_000);
    await expect(service([{ pair: 'EUR_XOF', rate: 700, updatedAt: old, clientId: null }]).convert(1, 'EUR', 'XOF')).resolves.toBe(700);
  });

  it('missingPairs liste les couples impossibles à convertir pour la société', async () => {
    const missing = await service([{ pair: 'EUR_XOF', rate: 656, clientId: CO }, { pair: 'EUR_GNF', rate: 9500, clientId: CO }]).missingPairs(CO);
    expect(missing).not.toContain('EUR_XOF');
    expect(missing).not.toContain('XOF_GNF'); // couvert par le pivot EUR
    expect(missing).toContain('EUR_USD');
    expect(missing).toContain('GBP_USD');
  });

  it('missingPairs ignore les taux des autres sociétés', async () => {
    const missing = await service([{ pair: 'EUR_XOF', rate: 656, clientId: 8 }]).missingPairs(CO);
    expect(missing).toContain('EUR_XOF');
  });
});

describe('resolveMaxAgeMs', () => {
  const H = 3_600_000;
  it('production sans variable : 48 h par défaut', () => expect(resolveMaxAgeMs({ NODE_ENV: 'production' })).toBe(48 * H));
  it('hors production sans variable : aucun contrôle', () => {
    expect(resolveMaxAgeMs({ NODE_ENV: 'development' })).toBeUndefined();
    expect(resolveMaxAgeMs({})).toBeUndefined();
  });
  it('valeur explicite > 0 : respectée, même en production', () => expect(resolveMaxAgeMs({ NODE_ENV: 'production', RATE_MAX_AGE_HOURS: '12' })).toBe(12 * H));
  it('« 0 » désactive volontairement le contrôle, même en production', () => expect(resolveMaxAgeMs({ NODE_ENV: 'production', RATE_MAX_AGE_HOURS: '0' })).toBeUndefined());
  it('valeur illisible : pas de contrôle silencieux ailleurs qu\'explicite (aucune limite)', () => expect(resolveMaxAgeMs({ NODE_ENV: 'production', RATE_MAX_AGE_HOURS: 'abc' })).toBeUndefined());
});
