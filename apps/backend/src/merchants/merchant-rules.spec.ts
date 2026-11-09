import { BadRequestException } from '@nestjs/common';

import {
  assertBic,
  assertIban,
  assertOrangePhone,
  assertOrangePhoneForCurrency,
  availablePayoutMethods as availableMethodsFor,
  isOrangePhoneConsistent,
  normalizeProfileInput as normalizeInput,
  normalizeRccm,
  assertValidAmount,
  assertWithinBounds,
  availablePayoutMethods,
  buildQrPayload,
  computeExpiry,
  computeFee,
  effectivePayoutMode,
  generateQrToken,
  generateReference,
  isExpired,
  maskIban,
  maskPhone,
  parseQrPayload,
  payoutCooldown,
  roundForCurrency,
  secondsLeft,
} from './merchant-rules';

describe('merchant-rules', () => {
  describe('commission', () => {
    it('XOF : entier, arrondi demi vers le haut', () => {
      expect(computeFee(10_000, 1, 'XOF')).toEqual({ fee: 100, net: 9_900 });
      expect(computeFee(150, 1, 'XOF')).toEqual({ fee: 2, net: 148 });
    });
    it('EUR : deux décimales', () => {
      expect(computeFee(19.99, 1.5, 'EUR')).toEqual({ fee: 0.3, net: 19.69 });
    });
    it('0 % ou pourcentage absurde : aucune commission', () => {
      expect(computeFee(500, 0, 'XOF')).toEqual({ fee: 0, net: 500 });
      expect(computeFee(500, -3, 'XOF')).toEqual({ fee: 0, net: 500 });
      expect(computeFee(500, NaN, 'XOF')).toEqual({ fee: 0, net: 500 });
    });
    it('la commission ne dépasse jamais le montant', () => {
      expect(computeFee(1, 10, 'EUR').fee).toBeLessThanOrEqual(1);
      expect(computeFee(100, 10, 'XOF')).toEqual({ fee: 10, net: 90 });
    });
    it('commission + net = montant, toujours', () => {
      for (const amount of [1, 7, 99, 101, 1234, 99_999]) {
        const { fee, net } = computeFee(amount, 1.75, 'XOF');
        expect(fee + net).toBe(amount);
      }
    });
    it('roundForCurrency', () => {
      expect(roundForCurrency(1.005, 'EUR')).toBe(1.01);
      expect(roundForCurrency(2.5, 'GNF')).toBe(3);
    });
  });

  describe('montants', () => {
    it('refuse zéro, négatif, texte, NaN, Infinity', () => {
      for (const bad of [0, -5, 'abc', NaN, Infinity, null, undefined]) {
        expect(() => assertValidAmount(bad, 'XOF')).toThrow(BadRequestException);
      }
    });
    it('XOF / GNF : pas de centimes', () => {
      expect(() => assertValidAmount(10.5, 'XOF')).toThrow(BadRequestException);
      expect(assertValidAmount('1500', 'GNF')).toBe(1500);
    });
    it('EUR : deux décimales au plus', () => {
      expect(assertValidAmount(10.25, 'EUR')).toBe(10.25);
      expect(() => assertValidAmount(10.255, 'EUR')).toThrow(BadRequestException);
    });
    it('bornes', () => {
      expect(() => assertWithinBounds(50, 'XOF', { min: 100 })).toThrow(/minimum/);
      expect(() => assertWithinBounds(5_000_000, 'XOF', { max: 2_000_000 })).toThrow(/maximum/);
      expect(() => assertWithinBounds(100, 'XOF', { min: 100, max: 2_000_000 })).not.toThrow();
      expect(() => assertWithinBounds(100, 'XOF', {})).not.toThrow();
    });
  });

  describe('expiration', () => {
    const now = new Date('2026-11-07T10:00:00Z');
    const merchant = { qrValidityMinutes: 5, phoneRequestValidityMinutes: 30 };
    it('QR : 5 minutes ; téléphone : 30 minutes', () => {
      expect(computeExpiry('QR', merchant, now).toISOString()).toBe('2026-11-07T10:05:00.000Z');
      expect(computeExpiry('PHONE', merchant, now).toISOString()).toBe('2026-11-07T10:30:00.000Z');
    });
    it('isExpired / secondsLeft', () => {
      const exp = new Date('2026-11-07T10:05:00Z');
      expect(isExpired(exp, now)).toBe(false);
      expect(isExpired(exp, new Date('2026-11-07T10:05:00Z'))).toBe(true);
      expect(secondsLeft(exp, now)).toBe(300);
      expect(secondsLeft(exp, new Date('2026-11-07T11:00:00Z'))).toBe(0);
    });
  });

  describe('QR code', () => {
    it('jeton : 32 caractères base64url, différent à chaque fois', () => {
      const a = generateQrToken();
      expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(generateQrToken()).not.toBe(a);
    });
    it('lien aller-retour', () => {
      const t = generateQrToken();
      expect(parseQrPayload(buildQrPayload(t))).toBe(t);
      expect(parseQrPayload(`  ${t}  `)).toBe(t);
    });
    it('refuse les contenus étrangers', () => {
      expect(parseQrPayload('https://evil.example/merchant-pay/' + generateQrToken())).toBeNull();
      expect(parseQrPayload('directtransfair://pay/abc')).toBeNull();
      expect(parseQrPayload('court')).toBeNull();
      expect(parseQrPayload(42)).toBeNull();
      expect(parseQrPayload(null)).toBeNull();
    });
  });

  describe('références', () => {
    it('préfixes et unicité', () => {
      const a = generateReference('PAYMENT');
      expect(a).toMatch(/^MP-[0-9A-Z]+-[0-9A-F]{6}$/);
      expect(generateReference('PAYOUT')).toMatch(/^MR-/);
      expect(generateReference('PAYMENT')).not.toBe(a);
    });
  });

  describe('destination', () => {
    it('numéro Orange : indicatif obligatoire', () => {
      expect(assertOrangePhone('+224 620 00 00 00')).toBe('+224620000000');
      expect(() => assertOrangePhone('0620000000')).toThrow(BadRequestException);
      expect(() => assertOrangePhone('')).toThrow(BadRequestException);
      expect(() => assertOrangePhone(undefined)).toThrow(BadRequestException);
    });
    it('numéro Orange ↔ devise : GNF = mobile guinéen, XOF = zone CFA, EUR = jamais d\'Orange Money', () => {
      expect(assertOrangePhoneForCurrency('+224 620 00 00 00', 'GNF')).toBe('+224620000000');
      // un compte guinéen n'accepte ni un numéro étranger, ni un fixe guinéen
      expect(() => assertOrangePhoneForCurrency('+33 7 51 24 47 22', 'GNF')).toThrow(/guinéen/);
      expect(() => assertOrangePhoneForCurrency('+224 320 00 00 00', 'GNF')).toThrow(/guinéen/);
      expect(() => assertOrangePhoneForCurrency('+221 77 000 00 01', 'GNF')).toThrow(/guinéen/);
      // XOF : zone CFA seulement (pas la Guinée)
      expect(assertOrangePhoneForCurrency('+221 77 000 00 01', 'XOF')).toBe('+221770000001');
      expect(() => assertOrangePhoneForCurrency('+224 620 00 00 00', 'XOF')).toThrow(/zone CFA/);
      // EUR : le blocage demandé — un compte en euros ne peut pas enregistrer un numéro Orange guinéen
      try { assertOrangePhoneForCurrency('+224 620 00 00 00', 'EUR'); fail('doit refuser'); } catch (e: any) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.getResponse()).toMatchObject({ code: 'ORANGE_NOT_AVAILABLE' });
      }
      expect(() => assertOrangePhoneForCurrency('+33 7 51 24 47 22', 'EUR')).toThrow(BadRequestException);
    });
    it('fiche du commerce : numéro exigé en GNF / XOF, refusé en EUR (la fiche naît alors sans Orange Money)', () => {
      expect(normalizeInput({ businessName: 'Chez Awa', address: 'Rue KA-023', city: 'Conakry', rccm: 'GN.TCC.2019.B.12345', orangeMoneyPhone: '+224 620 00 00 01' }, 'GNF').orangeMoneyPhone).toBe('+224620000001');
      expect(() => normalizeInput({ businessName: 'Chez Awa', address: 'Rue KA-023', city: 'Conakry', rccm: 'GN.TCC.2019.B.12345', orangeMoneyPhone: '+33751244722' }, 'GNF')).toThrow(/guinéen/);
      expect(() => normalizeInput({ businessName: 'Chez Awa', address: 'Rue KA-023', city: 'Conakry', rccm: 'GN.TCC.2019.B.12345' }, 'GNF')).toThrow(BadRequestException);
      expect(() => normalizeInput({ businessName: 'Chez Awa', address: 'Rue KA-023', city: 'Conakry', rccm: 'GN.TCC.2019.B.12345', orangeMoneyPhone: '+224620000001' }, 'EUR')).toThrow(/n'est pas disponible/);
      expect(normalizeInput({ businessName: 'Chez Awa', address: 'Rue KA-023', city: 'Conakry', rccm: 'GN.TCC.2019.B.12345' }, 'EUR').orangeMoneyPhone).toBeNull();
      expect(normalizeInput({ businessName: 'Chez Awa', address: 'Rue KA-023', city: 'Conakry', rccm: 'GN.TCC.2019.B.12345', orangeMoneyPhone: '   ' }, 'EUR').orangeMoneyPhone).toBeNull();
    });
    it('RCCM : obligatoire, normalisé en majuscules, formats variables acceptés, forme absurde refusée', () => {
      expect(normalizeRccm('  gn.tcc.2019.b.12345 ')).toBe('GN.TCC.2019.B.12345');
      expect(normalizeRccm('SN DKR 2015  B 1234')).toBe('SN DKR 2015 B 1234');
      expect(normalizeRccm('CI-ABJ-2018-B-12345')).toBe('CI-ABJ-2018-B-12345');
      for (const bad of [undefined, null, '', '   ', 'GN', 'ABCDE', '<script>1</script>', 'A'.repeat(41) + '1']) {
        expect(() => normalizeRccm(bad)).toThrow(BadRequestException);
      }
      expect(() => normalizeRccm(undefined)).toThrow(/obligatoire/);
      // la fiche entière est refusée sans RCCM, même si le reste est valide
      expect(() => normalizeInput({ businessName: 'Chez Awa' }, 'EUR')).toThrow(/RCCM/);
      expect(normalizeInput({ businessName: 'Chez Awa', address: 'Rue KA-023', city: 'Conakry', rccm: 'sn dkr 2015 b 1234' }, 'EUR').rccm).toBe('SN DKR 2015 B 1234');
    });
    it('anciens comptes : un numéro incohérent avec la devise n\'est plus proposé comme moyen de retrait', () => {
      expect(isOrangePhoneConsistent('+224620000001', 'EUR')).toBe(false);
      expect(isOrangePhoneConsistent('+224620000001', 'GNF')).toBe(true);
      expect(isOrangePhoneConsistent(null, 'EUR')).toBe(true);
      const profile = { orangeMoneyPhone: '+224620000001', bankIban: 'FR1420041010050500013M02606' };
      expect(availableMethodsFor(['ORANGE_MONEY', 'BANK_TRANSFER'], profile, 'EUR')).toEqual(['BANK_TRANSFER']);
      expect(availableMethodsFor(['ORANGE_MONEY', 'BANK_TRANSFER'], profile, 'GNF')).toEqual(['ORANGE_MONEY', 'BANK_TRANSFER']);
      expect(availableMethodsFor(['ORANGE_MONEY'], profile)).toEqual(['ORANGE_MONEY']);
    });
    it('IBAN : clé de contrôle et longueur', () => {
      expect(assertIban('FR14 2004 1010 0505 0001 3M02 606')).toBe('FR1420041010050500013M02606');
      expect(() => assertIban('FR14 2004 1010 0505 0001 3M02 607')).toThrow(/clé de contrôle/);
      expect(() => assertIban('FR1420041010050500013M0260')).toThrow(BadRequestException);
      expect(() => assertIban('1234')).toThrow(BadRequestException);
    });
    it('BIC optionnel', () => {
      expect(assertBic('')).toBeNull();
      expect(assertBic('bnpafrpp')).toBe('BNPAFRPP');
      expect(() => assertBic('XX')).toThrow(BadRequestException);
    });
    it('masquage', () => {
      expect(maskPhone('+224620000000')).toBe('+224 ••• ••000');
      expect(maskPhone(null)).toBe('');
      expect(maskIban('FR1420041010050500013M02606')).toBe('FR14 •••• 2606');
    });
  });

  describe('délai de sécurité', () => {
    const now = new Date('2026-11-07T12:00:00Z');
    it('aucun changement ou délai 0 : libre', () => {
      expect(payoutCooldown(null, 24, now).active).toBe(false);
      expect(payoutCooldown(new Date('2026-11-07T11:59:00Z'), 0, now).active).toBe(false);
    });
    it('actif puis levé', () => {
      const c = payoutCooldown(new Date('2026-11-07T00:00:00Z'), 24, now);
      expect(c.active).toBe(true);
      expect(c.until?.toISOString()).toBe('2026-11-08T00:00:00.000Z');
      expect(payoutCooldown(new Date('2026-11-05T00:00:00Z'), 24, now).active).toBe(false);
    });
  });

  describe('moyens de retrait', () => {
    it('ne propose que les moyens ouverts ET renseignés', () => {
      expect(availablePayoutMethods(['ORANGE_MONEY', 'BANK_TRANSFER'], { orangeMoneyPhone: '+224620000000' })).toEqual(['ORANGE_MONEY']);
      expect(availablePayoutMethods(['BANK_TRANSFER'], { orangeMoneyPhone: '+224620000000' })).toEqual([]);
      expect(availablePayoutMethods(['ORANGE_MONEY', 'BANK_TRANSFER'], { orangeMoneyPhone: '+1', bankIban: 'FR1' })).toEqual(['ORANGE_MONEY', 'BANK_TRANSFER']);
    });
    it('SANDBOX jamais en production sans autorisation explicite', () => {
      expect(effectivePayoutMode('MANUAL', {} as NodeJS.ProcessEnv)).toBe('MANUAL');
      expect(effectivePayoutMode('SANDBOX', { NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe('SANDBOX');
      expect(effectivePayoutMode('SANDBOX', { NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe('MANUAL');
      expect(effectivePayoutMode('SANDBOX', { NODE_ENV: 'production', ALLOW_SANDBOX_PAYOUTS: 'true' } as NodeJS.ProcessEnv)).toBe('SANDBOX');
    });
  });
});
