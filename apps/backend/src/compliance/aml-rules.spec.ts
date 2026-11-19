import { evaluateExtraRules, normalizeCountry, type AmlSettingsLike } from './aml-rules';

const settings: AmlSettingsLike = { amlThresholdXof: null, amlFlagScore: null, highRiskCountries: ['ir', 'KP'], structuringCount: 3, fanInSenders: 3 };
const base = { amountXof: 100_000, threshold: 2_000_000, nearThresholdCount24h: 0, otherSendersToRecipient24h: 0 };

describe('normalizeCountry', () => {
  it('met en majuscules et retire les accents', () => {
    expect(normalizeCountry(' ir ')).toBe('IR');
    expect(normalizeCountry('Érythrée')).toBe('ERYTHREE');
  });
});

describe('evaluateExtraRules', () => {
  it('ne déclenche rien pour un envoi ordinaire', () => {
    expect(evaluateExtraRules(settings, { ...base, destinationCountry: 'GN' })).toEqual({ points: 0, reasons: [], rules: [] });
  });
  it('pays à risque, sans tenir compte de la casse', () => {
    const r = evaluateExtraRules(settings, { ...base, destinationCountry: 'ir' });
    expect(r.rules).toEqual(['HIGH_RISK_COUNTRY']);
    expect(r.points).toBe(25);
  });
  it('fractionnement : le présent envoi compte et doit lui-même être juste sous le seuil', () => {
    const r = evaluateExtraRules(settings, { ...base, amountXof: 1_900_000, nearThresholdCount24h: 2 });
    expect(r.rules).toEqual(['STRUCTURING']);
    // Même historique, mais cet envoi est petit : rien.
    expect(evaluateExtraRules(settings, { ...base, amountXof: 100_000, nearThresholdCount24h: 2 }).rules).toEqual([]);
    // Montant inconnu : jamais deviné.
    expect(evaluateExtraRules(settings, { ...base, amountXof: null, nearThresholdCount24h: 5 }).rules).toEqual([]);
  });
  it('regroupement de fonds', () => {
    const r = evaluateExtraRules(settings, { ...base, otherSendersToRecipient24h: 2 });
    expect(r.rules).toEqual(['FAN_IN']);
    expect(evaluateExtraRules(settings, { ...base, otherSendersToRecipient24h: 1 }).rules).toEqual([]);
  });
  it('cumule les règles', () => {
    const r = evaluateExtraRules(settings, { amountXof: 1_900_000, threshold: 2_000_000, nearThresholdCount24h: 2, otherSendersToRecipient24h: 2, destinationCountry: 'KP' });
    expect(r.points).toBe(75);
    expect(r.rules).toHaveLength(3);
  });
  it('un réglage à 0 ou 1 désactive la règle', () => {
    const off = { ...settings, structuringCount: 0, fanInSenders: 0 };
    expect(evaluateExtraRules(off, { amountXof: 1_900_000, threshold: 2_000_000, nearThresholdCount24h: 9, otherSendersToRecipient24h: 9 }).rules).toEqual([]);
  });
});
