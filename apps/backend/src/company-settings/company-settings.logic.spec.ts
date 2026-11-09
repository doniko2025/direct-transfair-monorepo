// Paramètres de société — défauts, fusion tolérante, validation stricte.
import { applyPatch, defaultSettings, isFreeMethod, isRechargeEnabled, mergeSettings, SettingsValidationError } from './company-settings.logic';

describe('company-settings.logic', () => {
  it('défauts : seul wallet → wallet est gratuit, répartition 40/20/40, code valable 5 mois', () => {
    const d = defaultSettings();
    expect(d.fees.freeMethods).toEqual(['WALLET']);
    expect(isFreeMethod(d, 'WALLET')).toBe(true);
    expect(isFreeMethod(d, 'MOBILE_MONEY')).toBe(false);
    expect(isFreeMethod(d, 'CASH_PICKUP')).toBe(false);
    expect(d.commissions.defaultSplit).toEqual({ payerShare: 40, senderShare: 20, platformShare: 40 });
    expect(d.pickup.validityMonths).toBe(5);
    expect(d.fees.fallbackFeeRatePct).toBe(1.5);
  });

  it('fusion : les surcharges valides s\'appliquent, les invalides sont ignorées champ par champ', () => {
    const m = mergeSettings({
      fees: { freeMethods: ['WALLET', 'MOBILE_MONEY'], fallbackFeeRatePct: 999 },
      commissions: { defaultSplit: { payerShare: 50, senderShare: 10 } },
      pickup: { validityMonths: 99, maxFailedChecks: 3 },
      alerts: { lowBalance: { XOF: 1000, ZZZ: 5, EUR: -1 } },
    });
    expect(m.fees.freeMethods).toEqual(['WALLET', 'MOBILE_MONEY']);
    expect(m.fees.fallbackFeeRatePct).toBe(1.5); // hors bornes → défaut
    expect(m.commissions.defaultSplit).toEqual({ payerShare: 50, senderShare: 10, platformShare: 40 });
    expect(m.pickup.validityMonths).toBe(5); // 99 mois : hors bornes
    expect(m.pickup.maxFailedChecks).toBe(3);
    expect(m.alerts.lowBalance.XOF).toBe(1000);
    expect(m.alerts.lowBalance.EUR).toBe(100); // négatif ignoré
    expect(m.alerts.lowBalance.ZZZ).toBeUndefined();
  });

  it('données illisibles : défauts', () => {
    expect(mergeSettings(null)).toEqual(defaultSettings());
    expect(mergeSettings('x')).toEqual(defaultSettings());
    expect(mergeSettings({ fees: { freeMethods: [{ $ne: 1 }] } }).fees.freeMethods).toEqual(['WALLET']);
  });

  it('modification : partielle, fusionnée avec l\'existant, retrait d\'une surcharge par null', () => {
    const a = applyPatch({}, { fees: { freeMethods: ['wallet', 'mobile_money'] } });
    expect(a.fees?.freeMethods).toEqual(['WALLET', 'MOBILE_MONEY']);
    const b = applyPatch(a, { pickup: { validityMonths: 3 }, alerts: { lowBalance: { xof: 70_000 } } });
    expect(b.fees?.freeMethods).toEqual(['WALLET', 'MOBILE_MONEY']);
    expect(b.pickup?.validityMonths).toBe(3);
    expect(b.alerts?.lowBalance?.XOF).toBe(70_000);
    const c = applyPatch(b, { alerts: { lowBalance: { XOF: null } } });
    expect(c.alerts?.lowBalance?.XOF).toBeUndefined();
  });

  it('modification : refus clairs', () => {
    const bad = (p: unknown) => expect(() => applyPatch({}, p)).toThrow(SettingsValidationError);
    bad(null);
    bad({ fees: { freeMethods: ['TELEPORT'] } });
    bad({ fees: { fallbackFeeRatePct: -1 } });
    bad({ fees: { fallbackFeeRatePct: 1.555 } });
    bad({ commissions: { defaultSplit: { payerShare: 70, senderShare: 40 } } });
    bad({ commissions: { defaultSplit: { payerShare: 'x', senderShare: 1 } } });
    bad({ pickup: { validityMonths: 0 } });
    bad({ pickup: { validityMonths: 1.5 } });
    bad({ pickup: { phoneCheckDigits: 2 } });
    bad({ pickup: { requireBeneficiaryPhoneCheck: 'oui' } });
    bad({ alerts: { lowBalance: { ABC: 10 } } });
    bad({ alerts: { lowBalance: { XOF: -5 } } });
  });
});

describe('recharge — moyens ouverts', () => {
  it('par défaut les trois moyens sont ouverts', () => {
    expect(defaultSettings().recharge.enabledMethods).toEqual(['CARD', 'ORANGE_MONEY', 'SENDWAVE']);
  });

  it('applyPatch normalise, refuse les moyens inconnus, accepte la liste vide (recharge fermée)', () => {
    expect(applyPatch({}, { recharge: { enabledMethods: ['card', 'CARD', 'sendwave'] } }).recharge).toEqual({ enabledMethods: ['CARD', 'SENDWAVE'] });
    expect(applyPatch({}, { recharge: { enabledMethods: [] } }).recharge).toEqual({ enabledMethods: [] });
    expect(() => applyPatch({}, { recharge: { enabledMethods: ['PAYPAL'] } })).toThrow(SettingsValidationError);
    expect(() => applyPatch({}, { recharge: { enabledMethods: 'CARD' } })).toThrow(SettingsValidationError);
  });

  it('mergeSettings ignore une surcharge invalide et applique une valide', () => {
    expect(mergeSettings({ recharge: { enabledMethods: ['CARD'] } }).recharge.enabledMethods).toEqual(['CARD']);
    expect(mergeSettings({ recharge: { enabledMethods: ['PAYPAL'] } }).recharge.enabledMethods).toEqual(['CARD', 'ORANGE_MONEY', 'SENDWAVE']);
    expect(isRechargeEnabled(mergeSettings({ recharge: { enabledMethods: [] } }), 'CARD')).toBe(false);
  });
});

describe('merchant — comptes marchands', () => {
  it('défauts : ouvert, commission 1 %, QR 5 min, retrait manuel, délai 24 h', () => {
    const m = defaultSettings().merchant;
    expect(m.enabled).toBe(true);
    expect(m.paymentFeePct).toBe(1);
    expect(m.qrValidityMinutes).toBe(5);
    expect(m.payoutMode).toBe('MANUAL');
    expect(m.payoutCooldownHours).toBe(24);
    expect(m.payoutMethods).toEqual(['ORANGE_MONEY', 'BANK_TRANSFER']);
  });

  it('applyPatch accepte des valeurs valides et fusionne les montants par devise', () => {
    const a = applyPatch({}, { merchant: { paymentFeePct: 1.5, qrValidityMinutes: 10, minPayment: { xof: 200 } } });
    expect(a.merchant).toEqual({ paymentFeePct: 1.5, qrValidityMinutes: 10, minPayment: { XOF: 200 } });
    const b = applyPatch(a, { merchant: { minPayment: { GNF: 5000 } } });
    expect(b.merchant?.minPayment).toEqual({ XOF: 200, GNF: 5000 });
    const c = applyPatch(b, { merchant: { minPayment: { XOF: null } } });
    expect(c.merchant?.minPayment).toEqual({ GNF: 5000 });
  });

  it('applyPatch refuse les valeurs hors bornes, les moyens inconnus et min > max', () => {
    expect(() => applyPatch({}, { merchant: { paymentFeePct: 11 } })).toThrow(SettingsValidationError);
    expect(() => applyPatch({}, { merchant: { paymentFeePct: 1.234 } })).toThrow(SettingsValidationError);
    expect(() => applyPatch({}, { merchant: { qrValidityMinutes: 0 } })).toThrow(SettingsValidationError);
    expect(() => applyPatch({}, { merchant: { payoutCooldownHours: 200 } })).toThrow(SettingsValidationError);
    expect(() => applyPatch({}, { merchant: { payoutMethods: ['PAYPAL'] } })).toThrow(SettingsValidationError);
    expect(() => applyPatch({}, { merchant: { payoutMode: 'AUTO' } })).toThrow(SettingsValidationError);
    expect(() => applyPatch({}, { merchant: { minPayment: { XXX: 1 } } })).toThrow(SettingsValidationError);
    expect(() => applyPatch({}, { merchant: { minPayment: { XOF: 5_000_000 } } })).toThrow(SettingsValidationError);
  });

  it('mergeSettings ignore silencieusement les valeurs invalides stockées', () => {
    const m = mergeSettings({ merchant: { paymentFeePct: 99, qrValidityMinutes: 'x', payoutMode: 'AUTO', minPayment: { XOF: 300, ZZZ: 1 } } }).merchant;
    expect(m.paymentFeePct).toBe(1);
    expect(m.qrValidityMinutes).toBe(5);
    expect(m.payoutMode).toBe('MANUAL');
    expect(m.minPayment.XOF).toBe(300);
    expect(m.minPayment.ZZZ).toBeUndefined();
  });
});

describe('remboursements et rappels', () => {
  it('défauts : commission marchand conservée (comportement actuel), rappel ouvert 30 jours avec frais rendus', () => {
    expect(defaultSettings().refunds).toEqual({ returnMerchantCommission: false, returnFeesOnRecall: true, recallWindowDays: 30 });
  });

  it('applyPatch accepte des valeurs valides, mergeSettings les applique', () => {
    const stored = applyPatch({}, { refunds: { returnMerchantCommission: true, recallWindowDays: 0 } });
    expect(mergeSettings(stored).refunds).toEqual({ returnMerchantCommission: true, returnFeesOnRecall: true, recallWindowDays: 0 });
    // fusion avec l'existant : champs absents inchangés
    const next = applyPatch(stored, { refunds: { returnFeesOnRecall: false } });
    expect(mergeSettings(next).refunds).toEqual({ returnMerchantCommission: true, returnFeesOnRecall: false, recallWindowDays: 0 });
  });

  it('applyPatch refuse les valeurs invalides avec un message clair', () => {
    expect(() => applyPatch({}, { refunds: { returnMerchantCommission: 'oui' } })).toThrow(SettingsValidationError);
    expect(() => applyPatch({}, { refunds: { recallWindowDays: -1 } })).toThrow(/rappel/i);
    expect(() => applyPatch({}, { refunds: { recallWindowDays: 400 } })).toThrow(SettingsValidationError);
    expect(() => applyPatch({}, { refunds: { recallWindowDays: 2.5 } })).toThrow(SettingsValidationError);
  });

  it('mergeSettings ignore silencieusement les valeurs invalides stockées', () => {
    expect(mergeSettings({ refunds: { returnMerchantCommission: 'x', recallWindowDays: 999 } }).refunds).toEqual(defaultSettings().refunds);
  });
});
