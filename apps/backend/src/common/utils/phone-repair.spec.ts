// apps/backend/src/common/utils/phone-repair.spec.ts
import { repairDoubledDialCode } from './phone-repair';

const fixed = (raw: string) => {
  const r = repairDoubledDialCode(raw);
  return r.status === 'fixed' ? r.after : r.status;
};

describe('repairDoubledDialCode', () => {
  it('retire un indicatif doublé (Sénégal, Guinée, France)', () => {
    expect(fixed('+221221776676677')).toBe('+221776676677');
    expect(fixed('+224224622123456')).toBe('+224622123456');
    expect(fixed('+3333612345678')).toBe('+33612345678');
  });

  it('accepte les formes sans « + », en « 00 », avec espaces et avec un « + » au milieu', () => {
    expect(fixed('221221776676677')).toBe('+221776676677');
    expect(fixed('00224224622123456')).toBe('+224622123456');
    expect(fixed('+224 224 622 12 34 56')).toBe('+224622123456');
    expect(fixed('+224+224622123456')).toBe('+224622123456');
  });

  it('retire un indicatif triplé', () => {
    expect(fixed('+224224224622123456')).toBe('+224622123456');
  });

  it('ne touche pas un numéro correct', () => {
    expect(repairDoubledDialCode('+224622123456').status).toBe('ok');
    expect(repairDoubledDialCode('+221776676677').status).toBe('ok');
    expect(repairDoubledDialCode('+33612345678').status).toBe('ok');
  });

  it('ne touche pas un numéro national qui commence légitimement comme l\'indicatif', () => {
    // France : +33 33… (9 chiffres nationaux) — longueur correcte, pas un doublon
    expect(repairDoubledDialCode('+33331234567').status).toBe('ok');
    // Sénégal : national commençant par 221… mais 9 chiffres au total
    expect(repairDoubledDialCode('+221221776677').status).toBe('ok');
  });

  it('signale sans réparer quand le pays n\'a pas de règle de longueur', () => {
    const r = repairDoubledDialCode('+212212612345678');
    expect(r.status).toBe('suspect');
    expect(repairDoubledDialCode('+212612345678').status).toBe('ok');
  });

  it('signale sans réparer quand la longueur reste inattendue', () => {
    // Guinée : indicatif répété mais 12 chiffres restants qui ne se réduisent pas à 9
    expect(repairDoubledDialCode('+22422462212345678').status).toBe('suspect');
  });

  it('gère les entrées vides ou trop courtes', () => {
    expect(repairDoubledDialCode(null).status).toBe('ok');
    expect(repairDoubledDialCode('').status).toBe('ok');
    expect(repairDoubledDialCode('+224').status).toBe('ok');
  });

  it('est idempotent : relancer sur le résultat ne change plus rien', () => {
    const first = repairDoubledDialCode('+221221776676677');
    expect(first.status).toBe('fixed');
    if (first.status === 'fixed') expect(repairDoubledDialCode(first.after).status).toBe('ok');
  });
});
