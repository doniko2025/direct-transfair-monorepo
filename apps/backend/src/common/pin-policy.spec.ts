// apps/backend/src/common/pin-policy.spec.ts
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { assertValidPin, isPinAcceptable, pinIssues } from './pin-policy';

const NOW = new Date('2026-11-07T00:00:00Z');
const ok = (pin: string, ctx = {}) => isPinAcceptable(pin, { now: NOW, ...ctx });
const issues = (pin: string, ctx = {}) => pinIssues(pin, { now: NOW, ...ctx });

describe('pin-policy', () => {
  it('exige exactement 6 chiffres', () => {
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 456', '12345a']) {
      expect(issues(bad)).toEqual(['NOT_SIX_DIGITS']);
    }
  });

  it('refuse les chiffres identiques et les codes à 2 chiffres', () => {
    expect(issues('000000')).toContain('ALL_SAME');
    expect(issues('777777')).toContain('ALL_SAME');
    expect(issues('112211')).toContain('FEW_DIGITS');
    expect(issues('505050')).toContain('FEW_DIGITS');
  });

  it('refuse les suites, y compris en boucle', () => {
    for (const p of ['123456', '234567', '654321', '987654', '890123', '321098']) expect(issues(p)).toContain('SEQUENCE');
  });

  it('refuse 4 chiffres qui se suivent', () => {
    expect(issues('123490')).toContain('PARTIAL_SEQUENCE');
    expect(issues('905678')).toContain('PARTIAL_SEQUENCE');
    expect(issues('408765')).toContain('PARTIAL_SEQUENCE');
    expect(ok('135792')).toBe(true);
  });

  it('refuse répétitions, paires, miroirs et séries de 4 identiques', () => {
    expect(issues('121212')).toContain('REPEATED_PATTERN');
    expect(issues('482482')).toContain('REPEATED_PATTERN');
    expect(issues('775599')).toContain('PAIRS');
    expect(issues('482284')).toContain('MIRROR');
    expect(issues('555582')).toContain('LONG_RUN');
  });

  it('refuse les codes courants et le pavé numérique', () => {
    for (const p of ['147258', '159753', '258369', '696969', '520520']) expect(issues(p)).toContain('COMMON');
  });

  it('refuse une date plausible (de 1930 à aujourd\'hui)', () => {
    for (const p of ['120590', '051290', '900512', '051990', '199005', '010100', '311299']) expect(issues(p)).toContain('DATE');
    expect(issues('320590')).not.toContain('DATE'); // 32e jour : pas une date
    expect(issues('991399')).not.toContain('DATE'); // aucun mois valide
  });

  it('refuse la date de naissance connue, sous toutes ses formes', () => {
    const ctx = { birthDate: '1987-03-24' };
    for (const p of ['240387', '032487', '870324', '032024', '198703', '031987', '872403']) {
      expect(issues(p, ctx)).toEqual(expect.arrayContaining([expect.stringMatching(/BIRTHDATE|DATE/)]));
    }
    expect(issues('872403', ctx)).toContain('BIRTHDATE');
    expect(issues('240387', { birthDate: '24/03/1987' })).toContain('BIRTHDATE');
    expect(issues('240387', { birthDate: '24.03.1987' })).toContain('BIRTHDATE');
    expect(issues('240387', { birthDate: 'n\'importe quoi' })).not.toContain('BIRTHDATE');
  });

  it('refuse un morceau du téléphone', () => {
    expect(issues('738291', { phone: '+33 6 73 82 91 04' })).toContain('PHONE');
    expect(issues('738290', { phone: '+33 6 73 82 91 04' })).not.toContain('PHONE');
  });

  it('accepte de bons codes', () => {
    for (const p of ['739204', '486213', '905371', '276840']) expect(ok(p, { phone: '+224620000000' })).toBe(true);
  });

  it('laisse un choix large (au moins 70 % des 1 000 000 de codes)', () => {
    let good = 0;
    for (let i = 0; i < 1_000_000; i++) if (ok(String(i).padStart(6, '0'))) good++;
    expect(good).toBeGreaterThan(700_000);
  });

  it('assertValidPin lève 400 PIN_WEAK avec un message clair', () => {
    try {
      assertValidPin('123456');
      throw new Error('aurait dû échouer');
    } catch (e: any) {
      expect(e.getStatus()).toBe(400);
      expect(e.getResponse()).toMatchObject({ code: 'PIN_WEAK', message: expect.stringContaining('chiffres qui se suivent') });
    }
    expect(assertValidPin('739204')).toBe('739204');
  });

  it('la règle du mobile est identique à celle du serveur', () => {
    const mobile = join(__dirname, '../../../direct-transfair-mobile/components/auth/pinRules.ts');
    if (!existsSync(mobile)) return; // dépôt partiel : rien à comparer
    const block = (s: string) => s.slice(s.indexOf('// ─── BEGIN PIN POLICY'), s.indexOf('// ─── END PIN POLICY'));
    expect(block(readFileSync(mobile, 'utf8'))).toBe(block(readFileSync(join(__dirname, 'pin-policy.ts'), 'utf8')));
  });
});
