// apps/backend/src/transactions/pickup-rules.spec.ts
// Règles des codes de retrait : validité 5 mois, pays de paiement.
import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { addMonths, assertPayableInCountry, destinationCountryOf, isPickupExpired, pickupExpiryFrom, pickupValidityMonths } from './pickup-rules';

describe('pickup-rules — expiration', () => {
  afterEach(() => { delete process.env.PICKUP_CODE_VALIDITY_MONTHS; });

  it('5 mois par défaut ; PICKUP_CODE_VALIDITY_MONTHS le règle ; une valeur absurde retombe sur 5', () => {
    expect(pickupValidityMonths()).toBe(5);
    process.env.PICKUP_CODE_VALIDITY_MONTHS = '3';
    expect(pickupValidityMonths()).toBe(3);
    process.env.PICKUP_CODE_VALIDITY_MONTHS = '0';
    expect(pickupValidityMonths()).toBe(5);
    process.env.PICKUP_CODE_VALIDITY_MONTHS = 'abc';
    expect(pickupValidityMonths()).toBe(5);
  });

  it('addMonths ne déborde pas : 31 août + 6 mois = fin février', () => {
    const d = addMonths(new Date(2026, 7, 31), 6);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(28);
  });

  it('pickupExpiryFrom = création + 5 mois', () => {
    const from = new Date(2026, 0, 15);
    const e = pickupExpiryFrom(from);
    expect(e.getFullYear()).toBe(2026);
    expect(e.getMonth()).toBe(5);
    expect(e.getDate()).toBe(15);
  });

  it('isPickupExpired : pickupExpiry explicite prioritaire, sinon création + 5 mois (anciens envois)', () => {
    const now = new Date(2026, 9, 23);
    expect(isPickupExpired({ pickupExpiry: new Date(2026, 9, 22), createdAt: now }, now)).toBe(true);
    expect(isPickupExpired({ pickupExpiry: new Date(2026, 9, 24), createdAt: new Date(2020, 0, 1) }, now)).toBe(false);
    expect(isPickupExpired({ createdAt: new Date(2026, 3, 1) }, now)).toBe(true);   // 6 mois
    expect(isPickupExpired({ createdAt: new Date(2026, 6, 1) }, now)).toBe(false);  // 3 mois
  });
});

describe('pickup-rules — pays de paiement', () => {
  const ok = (p: Partial<Parameters<typeof assertPayableInCountry>[0]>) =>
    assertPayableInCountry({ destinationCountry: 'GN', payerCountry: 'GN', payoutCurrency: 'GNF', payerCurrency: 'GNF', ...p });

  it('même pays → autorisé', () => { expect(() => ok({})).not.toThrow(); });

  it('Guinée (GNF) payé au Sénégal (XOF) → refusé, message qui nomme la Guinée', () => {
    expect(() => ok({ payerCountry: 'SN', payerCurrency: 'XOF' })).toThrow(ForbiddenException);
    expect(() => ok({ payerCountry: 'SN', payerCurrency: 'XOF' })).toThrow(/Guinée/);
  });

  it('XOF partagé : un code Côte d\'Ivoire ne se paie ni au Sénégal ni au Mali', () => {
    for (const payer of ['SN', 'ML', 'BF', 'TG']) {
      expect(() => ok({ destinationCountry: 'CI', payoutCurrency: 'XOF', payerCountry: payer, payerCurrency: 'XOF' })).toThrow(/Côte d'Ivoire/);
    }
    expect(() => ok({ destinationCountry: 'CI', payoutCurrency: 'XOF', payerCountry: 'CI', payerCurrency: 'XOF' })).not.toThrow();
  });

  it('agence sans pays + destination connue → refus (on ne devine pas)', () => {
    expect(() => ok({ payerCountry: null })).toThrow(/pays de votre agence/);
  });

  it('destination inconnue (ancien envoi) : repli sur la devise', () => {
    expect(() => ok({ destinationCountry: null, payerCountry: 'SN', payerCurrency: 'XOF' })).toThrow(/GNF/);
    expect(() => ok({ destinationCountry: null, payerCountry: 'GN', payerCurrency: 'GNF' })).not.toThrow();
  });

  it('destinationCountryOf : receiveCountry d\'abord, sinon pays du bénéficiaire, sinon null', () => {
    expect(destinationCountryOf({ receiveCountry: 'GN', beneficiary: { country: 'Sénégal' } })).toBe('GN');
    expect(destinationCountryOf({ receiveCountry: null, beneficiary: { country: 'Guinée' } })).toBe('GN');
    expect(destinationCountryOf({ receiveCountry: null, beneficiary: null })).toBeNull();
  });
});
