// apps/web-admin/src/lib/passwordRules.ts
// v1.0 — Règles du formulaire « Changer mon mot de passe » (page Mon compte).
// Fonctions pures, sans React ni réseau : faciles à tester et à ajuster.
//
// Le backend (PATCH /auth/change-password) n'exige que 6 caractères, car la même
// route sert aussi l'application mobile (code secret). Le back-office pilote des
// comptes sensibles (super administrateur, administrateur de société) : on y est
// donc plus strict, côté interface uniquement, sans toucher au backend de production.

/** Longueur minimale d'un nouveau mot de passe dans le back-office. */
export const PASSWORD_MIN_LENGTH = 10;

/**
 * Longueur maximale : bcrypt ignore tout ce qui dépasse 72 octets. Au-delà, deux mots
 * de passe différents donneraient le même hash — on refuse plutôt que de tronquer en silence.
 */
export const PASSWORD_MAX_LENGTH = 72;

export interface PasswordFormErrors {
  current?: string;
  next?: string;
  confirm?: string;
}

/** Vrai si le texte tient dans la limite de 72 octets de bcrypt (UTF-8). */
function fitsBcrypt(value: string): boolean {
  return new TextEncoder().encode(value).length <= PASSWORD_MAX_LENGTH;
}

/**
 * Valide les trois champs. Un objet vide = formulaire valide.
 * Les mots de passe ne sont jamais « trimés » : un espace fait partie du secret.
 */
export function validatePasswordChange(
  current: string,
  next: string,
  confirm: string,
): PasswordFormErrors {
  const errors: PasswordFormErrors = {};

  if (!current) {
    errors.current = 'Saisissez votre mot de passe actuel.';
  }

  if (next.length < PASSWORD_MIN_LENGTH) {
    errors.next = `Au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  } else if (!fitsBcrypt(next)) {
    errors.next = `Trop long : ${PASSWORD_MAX_LENGTH} caractères au maximum.`;
  } else if (!/\p{L}/u.test(next) || !/\d/.test(next)) {
    errors.next = 'Mélangez des lettres et des chiffres.';
  } else if (current && next === current) {
    errors.next = "Le nouveau mot de passe doit être différent de l'actuel.";
  }

  // La confirmation n'est jugée que si le nouveau mot de passe est lui-même valide :
  // une erreur à la fois, la plus utile d'abord.
  if (!errors.next) {
    if (!confirm) {
      errors.confirm = 'Confirmez le nouveau mot de passe.';
    } else if (confirm !== next) {
      errors.confirm = 'Les deux saisies ne correspondent pas.';
    }
  }

  return errors;
}

export function hasErrors(errors: PasswordFormErrors): boolean {
  return Boolean(errors.current || errors.next || errors.confirm);
}

// ─── Robustesse (indicateur visuel, purement informatif) ───

export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

export interface PasswordStrength {
  level: StrengthLevel;
  label: string;
}

/**
 * 0 = champ vide, 1 = trop court, 2 = correct, 3 = bon, 4 = excellent.
 * Au-delà de la longueur minimale, chaque famille de caractères et une longueur
 * confortable (14+) font monter le niveau.
 */
export function passwordStrength(value: string): PasswordStrength {
  if (!value) return { level: 0, label: '' };
  if (value.length < PASSWORD_MIN_LENGTH) return { level: 1, label: 'Trop court' };

  const points =
    (/\p{Ll}/u.test(value) && /\p{Lu}/u.test(value) ? 1 : 0) +
    (/\d/.test(value) ? 1 : 0) +
    (/[^\p{L}\d]/u.test(value) ? 1 : 0) +
    (value.length >= 14 ? 1 : 0);

  if (points <= 1) return { level: 2, label: 'Correct' };
  if (points <= 3) return { level: 3, label: 'Bon' };
  return { level: 4, label: 'Excellent' };
}

// ─── Réinitialisation (« Mot de passe oublié », page de connexion) ───

export interface NewPasswordErrors {
  next?: string;
  confirm?: string;
}

/** Même exigence que le changement de mot de passe, sans « mot de passe actuel » (on ne l'a plus). */
export function validateNewPassword(next: string, confirm: string): NewPasswordErrors {
  const errors: NewPasswordErrors = {};

  if (next.length < PASSWORD_MIN_LENGTH) {
    errors.next = `Au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  } else if (!fitsBcrypt(next)) {
    errors.next = `Trop long : ${PASSWORD_MAX_LENGTH} caractères au maximum.`;
  } else if (!/\p{L}/u.test(next) || !/\d/.test(next)) {
    errors.next = 'Mélangez des lettres et des chiffres.';
  }

  if (!errors.next) {
    if (!confirm) errors.confirm = 'Confirmez le nouveau mot de passe.';
    else if (confirm !== next) errors.confirm = 'Les deux saisies ne correspondent pas.';
  }

  return errors;
}
