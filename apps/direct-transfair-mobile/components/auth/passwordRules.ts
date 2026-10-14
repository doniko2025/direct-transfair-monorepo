// apps/direct-transfair-mobile/components/auth/passwordRules.ts
// =========================================================
// RÈGLES DE MOT DE PASSE v1.0 — Direct Transf'air
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Source unique pour l'inscription ET la réinitialisation (avant, deux
// écrans appliquaient des règles différentes). Exigence : 10 à 35
// caractères (règle déjà en vigueur à l'inscription). Les autres critères
// alimentent le conseil de robustesse, sans bloquer.
// Le serveur n'impose que 6 caractères minimum : la règle plus stricte
// est une exigence de l'app, qui reste donc compatible avec l'existant.
// =========================================================

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 35;

export type PasswordReport = {
  lengthOk: boolean;
  hasLetter: boolean;
  hasDigit: boolean;
  hasMixCase: boolean;
  hasSymbol: boolean;
  /** 0 (vide) à 4 (excellent). */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
};

export function evaluatePassword(pw: string): PasswordReport {
  const lengthOk = pw.length >= PASSWORD_MIN && pw.length <= PASSWORD_MAX;
  const hasLetter = /\p{L}/u.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasMixCase = /\p{Ll}/u.test(pw) && /\p{Lu}/u.test(pw);
  const hasSymbol = /[^\p{L}\d\s]/u.test(pw);

  let score = 0;
  if (pw.length > 0) score = 1;
  if (lengthOk) {
    score = 2;
    let extras = 0;
    if (hasLetter && hasDigit) extras += 1;
    if (hasMixCase) extras += 1;
    if (hasSymbol || pw.length >= 16) extras += 1;
    score = Math.min(4, 2 + (extras >= 2 ? 2 : extras >= 1 ? 1 : 0));
  }
  const labels = ['', 'Trop court', 'Correct', 'Solide', 'Excellent'];
  return { lengthOk, hasLetter, hasDigit, hasMixCase, hasSymbol, score: score as PasswordReport['score'], label: labels[score]! };
}

/** Mot de passe acceptable pour créer / réinitialiser un compte. */
export function isPasswordAcceptable(pw: string): boolean {
  return pw.length >= PASSWORD_MIN && pw.length <= PASSWORD_MAX;
}
