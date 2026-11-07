// src/lib/counterSenderRules.ts
// Envoi au comptoir : contrôles de saisie de l'identité du client de passage (mêmes règles que le serveur :
// apps/backend/src/kyc/counter-rules.ts — le serveur reste juge, ceci évite seulement un aller-retour inutile).

export const MIN_SENDER_AGE = 18;

/** AAAA-MM-JJ valide (calendrier réel). */
export function parseDay(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? d : null;
}

export function ageOn(birth: Date, now: Date = new Date()): number {
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function birthDateError(value: string, now: Date = new Date()): string | null {
  if (!value.trim()) return null; // affiché seulement une fois le champ touché
  const d = parseDay(value);
  if (!d) return 'Date invalide.';
  const age = ageOn(d, now);
  if (age < MIN_SENDER_AGE) return `Le client doit avoir au moins ${MIN_SENDER_AGE} ans.`;
  if (age > 110) return 'Date de naissance invalide.';
  return null;
}

export function idExpiryError(value: string, now: Date = new Date()): string | null {
  if (!value.trim()) return null;
  const d = parseDay(value);
  if (!d) return 'Date invalide.';
  const endOfDay = new Date(d.getTime() + 86_400_000 - 1);
  if (endOfDay.getTime() < now.getTime()) return "La pièce est expirée : elle ne peut pas être acceptée.";
  if (d.getUTCFullYear() > now.getUTCFullYear() + 25) return "Date d'expiration invraisemblable.";
  return null;
}

/** Numéro de pièce : au moins 4 caractères alphanumériques. */
export function idNumberError(value: string): string | null {
  if (!value.trim()) return null;
  return value.replace(/[^A-Za-z0-9]/g, '').length < 4 ? 'Numéro trop court.' : null;
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Pièces dont le verso doit aussi être photographié (mêmes règles que le serveur). */
export function idNeedsBack(type: string): boolean {
  return type === 'NATIONAL_ID' || type === 'DRIVER_LICENSE' || type === 'RESIDENCE_PERMIT';
}
