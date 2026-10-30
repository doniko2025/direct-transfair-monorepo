// apps/backend/src/common/utils/phone-strict.spec.ts
// Audit — normalisation stricte à l'écriture : un numéro local sans indicatif n'est plus enregistré.
import { normalizePhoneE164, normalizePhoneStrict } from './phone.util';

describe('normalizePhoneStrict', () => {
  it('accepte un numéro international, avec +, 00 ou indicatif nu', () => {
    expect(normalizePhoneStrict('+224 620 00 00 00')).toBe('+224620000000');
    expect(normalizePhoneStrict('00224620000000')).toBe('+224620000000');
    expect(normalizePhoneStrict('224620000000')).toBe('+224620000000');
  });
  it('refuse un numéro local commençant par 0 (indicatif manquant)', () => {
    expect(normalizePhoneStrict('0766736226')).toBeNull();
    expect(normalizePhoneStrict('+0766736226')).toBeNull();
  });
  it('refuse vide / trop court', () => {
    expect(normalizePhoneStrict('')).toBeNull();
    expect(normalizePhoneStrict('123')).toBeNull();
  });
  it('normalizePhoneE164 reste tolérante (retrouver les anciens comptes)', () => {
    expect(normalizePhoneE164('0766736226')).toBe('+0766736226');
  });
});
