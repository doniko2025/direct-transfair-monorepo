// apps/backend/src/commission-rules/commission-snapshot.spec.ts
import { buildCommissionSnapshot, parseCommissionSnapshot, sharesFromSnapshot } from './commission-snapshot';

const fallback = { payerShare: 40, senderShare: 20, platformShare: 40 };
const NOW = new Date('2026-11-09T10:00:00Z');

describe('buildCommissionSnapshot', () => {
  it('prend la règle de l\'administrateur par type payeur, sinon la répartition par défaut de la société', () => {
    const snap = buildCommissionSnapshot({
      source: 'SUBSIDIARY',
      rules: [{ destType: 'PARTNER', payerShare: 50, senderShare: 10, platformShare: 40 }],
      fallback, now: NOW,
    });
    expect(snap.shares.PARTNER).toEqual({ payerShare: 50, senderShare: 10, platformShare: 40 });
    expect(snap.shares.SUBSIDIARY).toEqual(fallback);
    expect(snap).toMatchObject({ v: 1, source: 'SUBSIDIARY', frozenAt: NOW.toISOString() });
  });

  it('plusieurs lignes pour le même couple : la première (la plus récente) l\'emporte', () => {
    const snap = buildCommissionSnapshot({
      source: 'WALLET',
      rules: [
        { destType: 'SUBSIDIARY', payerShare: 30, senderShare: 0, platformShare: 70 },
        { destType: 'SUBSIDIARY', payerShare: 10, senderShare: 0, platformShare: 90 },
      ],
      fallback,
    });
    expect(snap.shares.SUBSIDIARY.payerShare).toBe(30);
  });
});

describe('sharesFromSnapshot', () => {
  const snap = buildCommissionSnapshot({ source: 'PARTNER', rules: [{ destType: 'SUBSIDIARY', payerShare: 25, senderShare: 25, platformShare: 50 }], fallback, now: NOW });

  it('relit les parts figées après un aller-retour JSON (stockage en base)', () => {
    const stored = JSON.parse(JSON.stringify(snap));
    expect(sharesFromSnapshot(stored, 'PARTNER', 'SUBSIDIARY')).toEqual({ payerShare: 25, senderShare: 25, platformShare: 50 });
    expect(sharesFromSnapshot(stored, 'PARTNER', 'PARTNER')).toEqual(fallback);
  });

  it('absent, abîmé, autre version ou autre type d\'envoi : null → repli sur les règles actuelles', () => {
    expect(sharesFromSnapshot(null, 'PARTNER', 'SUBSIDIARY')).toBeNull();
    expect(sharesFromSnapshot({}, 'PARTNER', 'SUBSIDIARY')).toBeNull();
    expect(sharesFromSnapshot({ ...snap, v: 2 }, 'PARTNER', 'SUBSIDIARY')).toBeNull();
    expect(sharesFromSnapshot({ ...snap, shares: { SUBSIDIARY: { payerShare: 'x' } } }, 'PARTNER', 'SUBSIDIARY')).toBeNull();
    expect(sharesFromSnapshot({ ...snap, shares: { ...snap.shares, PARTNER: { payerShare: 150, senderShare: 0, platformShare: 0 } } }, 'PARTNER', 'SUBSIDIARY')).toBeNull();
    expect(sharesFromSnapshot(snap, 'WALLET', 'SUBSIDIARY')).toBeNull();
    expect(parseCommissionSnapshot('texte')).toBeNull();
  });
});
