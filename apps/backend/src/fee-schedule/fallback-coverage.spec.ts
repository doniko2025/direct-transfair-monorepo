// apps/backend/src/fee-schedule/fallback-coverage.spec.ts
import { fallbackNotice } from './fallback-coverage';

const base = { fallbackFeeRatePct: 1.5, freeMethods: [] as string[], rules: [] as any[], flatMethods: [] as any[] };

describe('fallbackNotice', () => {
  it('rien de configuré : tous les modes taxés tombent sur le taux de repli', () => {
    const n = fallbackNotice(base);
    expect(n.noActiveRules).toBe(true);
    expect(n.feeRatePct).toBe(1.5);
    expect(n.uncoveredMethods).toEqual(['CASH_PICKUP', 'BANK_DEPOSIT', 'MOBILE_MONEY', 'WALLET', 'IBAN_TRANSFER']);
  });

  it('une règle active sans mode précis couvre tout', () => {
    expect(fallbackNotice({ ...base, rules: [{ isActive: true, payoutMethod: null }] }).uncoveredMethods).toEqual([]);
  });

  it('une règle désactivée ne compte pas', () => {
    const n = fallbackNotice({ ...base, rules: [{ isActive: false, payoutMethod: null }] });
    expect(n.noActiveRules).toBe(true);
    expect(n.uncoveredMethods).toHaveLength(5);
  });

  it('modes gratuits, règles par mode et tarifs plats sont exclus de la liste', () => {
    const n = fallbackNotice({
      ...base, freeMethods: ['wallet'], rules: [{ isActive: true, payoutMethod: 'CASH_PICKUP' }], flatMethods: ['mobile_money', null],
    });
    expect(n.noActiveRules).toBe(false);
    expect(n.uncoveredMethods).toEqual(['BANK_DEPOSIT', 'IBAN_TRANSFER']);
  });
});
