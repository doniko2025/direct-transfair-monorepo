// apps/backend/src/transactions/aml-scoring.spec.ts
import 'reflect-metadata';
import { amlFlagScore, amlThresholdXof, computeRiskScore } from './aml-scoring';

const base = { recentCount24h: 0, recentSumXof24h: 0, accountCreatedAt: new Date(2020, 0, 1), now: new Date(2026, 9, 23) };

describe('aml-scoring — non bloquant', () => {
  afterEach(() => { delete process.env.AML_THRESHOLD_XOF; delete process.env.AML_FLAG_SCORE; });

  it('petit envoi, compte ancien → score 0, pas de signalement', () => {
    expect(computeRiskScore({ ...base, amountXof: 20_000 })).toEqual({ score: 0, flagged: false, reasons: [] });
  });

  it('montant au-dessus du seuil seul → 40, sous le score de signalement (60)', () => {
    const r = computeRiskScore({ ...base, amountXof: 3_000_000 });
    expect(r.score).toBe(40);
    expect(r.flagged).toBe(false);
  });

  it('montant élevé + compte récent + vitesse → signalé', () => {
    const r = computeRiskScore({ ...base, amountXof: 3_000_000, recentCount24h: 6, accountCreatedAt: new Date(2026, 9, 20) });
    expect(r.score).toBe(40 + 20 + 15);
    expect(r.flagged).toBe(true);
    expect(r.reasons.length).toBe(3);
  });

  it('fractionnement : juste sous le seuil + cumul 24 h élevé', () => {
    const r = computeRiskScore({ ...base, amountXof: 1_700_000, recentSumXof24h: 3_000_000 });
    expect(r.score).toBe(20 + 15 + 20); // important + sous le seuil + cumul
  });

  it('le montant doit arriver converti en XOF par l\'appelant (5 000 € au taux enregistré ≈ 3,3 M XOF > seuil)', () => {
    expect(computeRiskScore({ ...base, amountXof: 5000 * 655.957 }).score).toBeGreaterThanOrEqual(40);
  });

  it('taux de change indisponible (amountXof = null) : rien n\'est deviné, l\'opération est signalée pour revue', () => {
    const r = computeRiskScore({ ...base, amountXof: null });
    expect(r.flagged).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(amlFlagScore());
    expect(r.reasons[0]).toMatch(/Taux de change indisponible/);
  });

  it('le score est plafonné à 100 ; seuils réglables par variable d\'environnement', () => {
    const r = computeRiskScore({ ...base, amountXof: 9_000_000, recentCount24h: 9, recentSumXof24h: 9_000_000, accountCreatedAt: new Date(2026, 9, 22) });
    expect(r.score).toBe(95);
    process.env.AML_THRESHOLD_XOF = '100000';
    process.env.AML_FLAG_SCORE = '30';
    expect(amlThresholdXof()).toBe(100000);
    expect(amlFlagScore()).toBe(30);
    expect(computeRiskScore({ ...base, amountXof: 150_000 }).flagged).toBe(true);
  });
});
