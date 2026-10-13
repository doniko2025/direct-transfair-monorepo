// apps/backend/src/commission-rules/commission-split.spec.ts
import { splitFees } from './commission-split';

const shares = { payerShare: 40, senderShare: 20, platformShare: 40 };
const sum = (r: { payer: number; sender: number; platform: number }) => r.payer + r.sender + r.platform;

describe('splitFees', () => {
  it('40 / 20 / 40 sur 1000 XOF', () => {
    expect(splitFees({ fees: 1000, currency: 'XOF', shares, senderIsClient: false, sameAgency: false })).toEqual({ payer: 400, sender: 200, platform: 400 });
  });

  it('XOF : la somme égale toujours les frais (la société prend le reste)', () => {
    for (const fees of [1, 7, 333, 999, 1001, 12_345]) {
      const r = splitFees({ fees, currency: 'XOF', shares: { payerShare: 33.33, senderShare: 33.33, platformShare: 33.34 }, senderIsClient: false, sameAgency: false });
      expect(sum(r)).toBe(fees);
      expect(Number.isInteger(r.payer) && Number.isInteger(r.sender) && Number.isInteger(r.platform)).toBe(true);
    }
  });

  it('EUR : arrondi au centime, somme exacte', () => {
    const r = splitFees({ fees: 3.33, currency: 'EUR', shares, senderIsClient: false, sameAgency: false });
    expect(Math.round(sum(r) * 100)).toBe(333);
  });

  it('client expéditeur : la part d\'envoi revient à la société', () => {
    expect(splitFees({ fees: 1000, currency: 'XOF', shares, senderIsClient: true, sameAgency: false })).toEqual({ payer: 400, sender: 0, platform: 600 });
  });

  it('même agence : la part d\'envoi s\'ajoute à l\'agence payeuse', () => {
    expect(splitFees({ fees: 1000, currency: 'XOF', shares, senderIsClient: false, sameAgency: true })).toEqual({ payer: 600, sender: 0, platform: 400 });
  });

  it('frais nuls, négatifs ou NaN → rien à répartir', () => {
    for (const fees of [0, -5, NaN]) {
      expect(splitFees({ fees, currency: 'XOF', shares, senderIsClient: false, sameAgency: false })).toEqual({ payer: 0, sender: 0, platform: 0 });
    }
  });

  it('parts incohérentes (> 100 %) : jamais de part négative, somme = frais', () => {
    const r = splitFees({ fees: 1000, currency: 'XOF', shares: { payerShare: 80, senderShare: 80, platformShare: 0 }, senderIsClient: false, sameAgency: false });
    expect(r.platform).toBeGreaterThanOrEqual(0);
    expect(r.sender).toBeGreaterThanOrEqual(0);
    expect(sum(r)).toBe(1000);
  });
});
