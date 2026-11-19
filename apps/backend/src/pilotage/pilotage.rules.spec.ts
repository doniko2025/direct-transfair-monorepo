import {
  computeVariance,
  liquidityLevel,
  liquiditySeverity,
  monthBounds,
  needsLiquidityAlert,
  parseCounted,
  parseMonth,
  parseTarget,
  pickMinBalance,
  previousMonth,
  rankAgents,
  targetProgress,
  toCorridorRow,
  totalsByCurrency,
  varianceSeverity,
} from './pilotage.rules';

describe('caisse', () => {
  it('calcule l’écart compté − théorique, arrondi à la devise', () => {
    expect(computeVariance(99_500, 100_000, 'XOF')).toBe(-500);
    expect(computeVariance(100.456, 100, 'EUR')).toBe(0.46);
  });

  it('classe la gravité par rapport au solde théorique', () => {
    expect(varianceSeverity(0, 1000)).toBe('NONE');
    expect(varianceSeverity(-5, 1000)).toBe('LOW');
    expect(varianceSeverity(30, 1000)).toBe('MEDIUM');
    expect(varianceSeverity(-200, 1000)).toBe('HIGH');
    expect(varianceSeverity(10, 0)).toBe('HIGH');
  });

  it('refuse un montant compté invalide', () => {
    expect(parseCounted('1 250,5'.replace(' ', ''), 'EUR')).toBe(1250.5);
    expect(() => parseCounted(-1, 'EUR')).toThrow();
    expect(() => parseCounted('abc', 'EUR')).toThrow();
    expect(() => parseCounted(Number.NaN, 'EUR')).toThrow();
    expect(() => parseCounted(1e15, 'EUR')).toThrow();
  });
});

describe('liquidité', () => {
  it('niveaux autour du seuil', () => {
    expect(liquidityLevel(1000, null)).toBe('OK');
    expect(liquidityLevel(1000, 0)).toBe('OK');
    expect(liquidityLevel(499, 1000)).toBe('CRITICAL');
    expect(liquidityLevel(999, 1000)).toBe('LOW');
    expect(liquidityLevel(1100, 1000)).toBe('WARN');
    expect(liquidityLevel(1250, 1000)).toBe('OK');
  });

  it('alerte seulement sous le seuil', () => {
    expect(needsLiquidityAlert('LOW')).toBe(true);
    expect(needsLiquidityAlert('CRITICAL')).toBe(true);
    expect(needsLiquidityAlert('WARN')).toBe(false);
    expect(liquiditySeverity('CRITICAL')).toBe('CRITICAL');
    expect(liquiditySeverity('LOW')).toBe('HIGH');
  });

  it('la règle d’une agence l’emporte sur la règle générale, et une règle inactive est ignorée', () => {
    const rules = [
      { agencyId: null, currency: 'XOF', minBalance: 500, isActive: true },
      { agencyId: 'a1', currency: 'XOF', minBalance: 900, isActive: true },
      { agencyId: 'a2', currency: 'XOF', minBalance: 100, isActive: false },
    ];
    expect(pickMinBalance(rules, 'a1', 'XOF')).toBe(900);
    expect(pickMinBalance(rules, 'a2', 'XOF')).toBe(500);
    expect(pickMinBalance(rules, 'a1', 'EUR')).toBeNull();
  });
});

describe('rentabilité', () => {
  it('marge nette = frais − commissions agents − part plateforme', () => {
    const row = toCorridorRow({ currency: 'EUR', targetCurrency: 'GNF', count: 10, sent: 1000, received: 9_000_000, fees: 50, agentCommissions: 20, platformShare: 5 });
    expect(row.corridor).toBe('EUR → GNF');
    expect(row.net).toBe(25);
    expect(row.marginPct).toBe(50);
  });

  it('marge 0 % sans frais, et totaux par devise sans mélanger les devises', () => {
    const a = toCorridorRow({ currency: 'EUR', targetCurrency: 'GNF', count: 1, sent: 10, received: 0, fees: 0, agentCommissions: 0, platformShare: 0 });
    const b = toCorridorRow({ currency: 'EUR', targetCurrency: 'XOF', count: 2, sent: 100, received: 0, fees: 10, agentCommissions: 2, platformShare: 1 });
    const c = toCorridorRow({ currency: 'XOF', targetCurrency: null, count: 1, sent: 5000, received: 0, fees: 100, agentCommissions: 0, platformShare: 0 });
    expect(a.marginPct).toBe(0);
    expect(totalsByCurrency([a, b, c])).toEqual([
      { currency: 'EUR', count: 3, sent: 110, fees: 10, net: 7 },
      { currency: 'XOF', count: 1, sent: 5000, fees: 100, net: 100 },
    ]);
  });
});

describe('objectifs et classement', () => {
  const act = { agentId: 'a', operations: 30, volume: { XOF: 600_000 }, fees: {} };

  it('avancement : volume, opérations, meilleur des deux', () => {
    expect(targetProgress(act, null).pct).toBeNull();
    const p = targetProgress(act, { currency: 'XOF', targetAmount: 1_000_000, targetOperations: 25 });
    expect(p.amountPct).toBe(60);
    expect(p.operationsPct).toBe(120);
    expect(p.pct).toBe(120);
    expect(p.reached).toBe(true);
  });

  it('un objectif sans volume ne compte que les opérations', () => {
    const p = targetProgress(act, { currency: 'XOF', targetAmount: 0, targetOperations: 60 });
    expect(p.amountPct).toBeNull();
    expect(p.pct).toBe(50);
    expect(p.reached).toBe(false);
  });

  it('classe par opérations, ex æquo partagent le rang, ordre stable par nom', () => {
    const r = rankAgents([
      { name: 'Zoé', operations: 5 },
      { name: 'Amadou', operations: 9 },
      { name: 'Binta', operations: 5 },
    ]);
    expect(r.map((x) => [x.name, x.rank])).toEqual([['Amadou', 1], ['Binta', 2], ['Zoé', 2]]);
  });

  it('valide un objectif', () => {
    expect(parseTarget({ currency: 'XOF', targetAmount: '500000', targetOperations: 10 })).toEqual({ currency: 'XOF', targetAmount: 500000, targetOperations: 10 });
    expect(() => parseTarget({ currency: 'XOF', targetAmount: 0, targetOperations: 0 })).toThrow();
    expect(() => parseTarget({ currency: 'XOF', targetAmount: -1, targetOperations: 1 })).toThrow();
    expect(() => parseTarget({ currency: 'XOF', targetAmount: 1, targetOperations: 1.5 })).toThrow();
  });
});

describe('mois', () => {
  it('parse et bornes', () => {
    expect(parseMonth('2026-11')).toBe('2026-11');
    expect(() => parseMonth('2026-13')).toThrow();
    expect(parseMonth(undefined, new Date('2026-11-19T10:00:00Z'))).toBe('2026-11');
    const b = monthBounds('2026-12');
    expect(b.from.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(b.to.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(monthBounds('2026-11', 60).from.toISOString()).toBe('2026-10-31T23:00:00.000Z');
    expect(previousMonth(new Date('2026-01-01T07:10:00Z'))).toBe('2025-12');
  });
});
