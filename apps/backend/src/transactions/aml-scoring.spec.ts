// apps/backend/src/transactions/aml-scoring.spec.ts
import 'reflect-metadata';
import { amlFlagScore, amlThresholdXof, approxXof, computeRiskScore } from './aml-scoring';

const base = { recentCount24h: 0, recentSumXof24h: 0, accountCreatedAt: new Date(2020, 0, 1), now: new Date(2026, 9, 23) };

describe('aml-scoring — non bloquant', () => {
  afterEach(() => { delete process.env.AML_THRESHOLD_XOF; delete process.env.AML_FLAG_SCORE; });

  it('petit envoi, compte ancien → score 0, pas de signalement', () => {
    expect(computeRiskScore({ ...base, amount: 20_000, currency: 'XOF' })).toEqual({ score: 0, flagged: false, reasons: [] });
  });

  it('montant au-dessus du seuil seul → 40, sous le score de signalement (60)', () => {
    const r = computeRiskScore({ ...base, amount: 3_000_000, currency: 'XOF' });
    expect(r.score).toBe(40);
    expect(r.flagged).toBe(false);
  });

  it('montant élevé + compte récent + vitesse → signalé', () => {
    const r = computeRiskScore({ ...base, amount: 3_000_000, currency: 'XOF', recentCount24h: 6, accountCreatedAt: new Date(2026, 9, 20) });
    expect(r.score).toBe(40 + 20 + 15);
    expect(r.flagged).toBe(true);
    expect(r.reasons.length).toBe(3);
  });

  it('fractionnement : juste sous le seuil + cumul 24 h élevé', () => {
    const r = computeRiskScore({ ...base, amount: 1_700_000, currency: 'XOF', recentSumXof24h: 3_000_000 });
    expect(r.score).toBe(20 + 15 + 20); // important + sous le seuil + cumul
  });

  it('les devises sont ramenées en XOF (5 000 € ≈ 3,3 M XOF > seuil)', () => {
    expect(approxXof(5000, 'EUR')).toBeGreaterThan(amlThresholdXof());
    expect(computeRiskScore({ ...base, amount: 5000, currency: 'EUR' }).score).toBeGreaterThanOrEqual(40);
  });

  it('le score est plafonné à 100 ; seuils réglables par variable d\'environnement', () => {
    const r = computeRiskScore({ ...base, amount: 9_000_000, currency: 'XOF', recentCount24h: 9, recentSumXof24h: 9_000_000, accountCreatedAt: new Date(2026, 9, 22) });
    expect(r.score).toBe(95);
    process.env.AML_THRESHOLD_XOF = '100000';
    process.env.AML_FLAG_SCORE = '30';
    expect(amlThresholdXof()).toBe(100000);
    expect(amlFlagScore()).toBe(30);
    expect(computeRiskScore({ ...base, amount: 150_000, currency: 'XOF' }).flagged).toBe(true);
  });
});
