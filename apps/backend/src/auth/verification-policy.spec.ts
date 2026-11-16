import {
  isFullyVerified,
  phonePending,
  phoneVerificationRequired,
} from './verification-policy';

describe('verification-policy', () => {
  const OLD = process.env.PHONE_VERIFICATION_REQUIRED;
  afterEach(() => {
    if (OLD === undefined) delete process.env.PHONE_VERIFICATION_REQUIRED;
    else process.env.PHONE_VERIFICATION_REQUIRED = OLD;
  });

  const withPhoneUnverified = { isEmailVerified: true, isPhoneVerified: false, phone: '+33612345678' };

  it('par défaut (variable absente) : le téléphone n’est pas exigé', () => {
    delete process.env.PHONE_VERIFICATION_REQUIRED;
    expect(phoneVerificationRequired()).toBe(false);
    expect(phonePending(withPhoneUnverified)).toBe(false);
    expect(isFullyVerified(withPhoneUnverified)).toBe(true);
  });

  it('false / valeur inconnue : téléphone non exigé', () => {
    process.env.PHONE_VERIFICATION_REQUIRED = 'false';
    expect(phoneVerificationRequired()).toBe(false);
    process.env.PHONE_VERIFICATION_REQUIRED = 'oui';
    expect(phoneVerificationRequired()).toBe(false);
  });

  it.each(['true', 'TRUE', ' 1 '])('« %s » active l’exigence du téléphone', (v) => {
    process.env.PHONE_VERIFICATION_REQUIRED = v;
    expect(phoneVerificationRequired()).toBe(true);
    expect(phonePending(withPhoneUnverified)).toBe(true);
    expect(isFullyVerified(withPhoneUnverified)).toBe(false);
  });

  it('exigé : un compte sans téléphone ou au téléphone vérifié est complet', () => {
    process.env.PHONE_VERIFICATION_REQUIRED = 'true';
    expect(isFullyVerified({ isEmailVerified: true, phone: null })).toBe(true);
    expect(isFullyVerified({ ...withPhoneUnverified, isPhoneVerified: true })).toBe(true);
  });

  it('l’email non vérifié bloque toujours, quel que soit le réglage', () => {
    delete process.env.PHONE_VERIFICATION_REQUIRED;
    expect(isFullyVerified({ isEmailVerified: false, phone: null })).toBe(false);
    process.env.PHONE_VERIFICATION_REQUIRED = 'true';
    expect(isFullyVerified({ isEmailVerified: false, isPhoneVerified: true, phone: '+33612345678' })).toBe(false);
  });
});
