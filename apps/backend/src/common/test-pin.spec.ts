import { Role } from '@prisma/client';
import { matchesTestPin, TEST_PIN } from './test-pin';

describe('code de test (lot 13)', () => {
  const save = process.env.TEST_PIN_ENABLED;
  afterEach(() => { if (save === undefined) delete process.env.TEST_PIN_ENABLED; else process.env.TEST_PIN_ENABLED = save; });

  it('désactivé par défaut : 000000 est refusé', () => {
    delete process.env.TEST_PIN_ENABLED;
    expect(matchesTestPin({ id: 'u', role: Role.USER }, TEST_PIN)).toBe(false);
  });

  it('activé : accepté pour un client / marchand (Role.USER) seulement', () => {
    process.env.TEST_PIN_ENABLED = 'true';
    expect(matchesTestPin({ id: 'u', role: Role.USER }, TEST_PIN)).toBe(true);
    for (const role of [Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.AGENT]) {
      expect(matchesTestPin({ id: 'a', role }, TEST_PIN)).toBe(false);
    }
  });

  it('activé : tout autre code, ou une valeur non texte, reste refusé', () => {
    process.env.TEST_PIN_ENABLED = 'true';
    expect(matchesTestPin({ id: 'u', role: Role.USER }, '111111')).toBe(false);
    expect(matchesTestPin({ id: 'u', role: Role.USER }, 0 as any)).toBe(false);
    expect(matchesTestPin(null, TEST_PIN)).toBe(false);
  });

  it('la variable doit valoir exactement « true »', () => {
    process.env.TEST_PIN_ENABLED = '1';
    expect(matchesTestPin({ id: 'u', role: Role.USER }, TEST_PIN)).toBe(false);
  });
});
