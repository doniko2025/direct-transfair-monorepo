// apps/backend/src/kyc/counter-rules.ts
// =========================================================
// COUNTER RULES v1.0 — envois « au comptoir » : un agent encaisse du cash pour un client de passage (sans compte).
// Règle : l'agent contrôle une pièce d'identité en cours de validité et en enregistre les références. Pas de pièce, pas d'envoi.
// Fonctions pures : validation de la saisie de l'agent et comparaison d'identités.
// =========================================================
import { IDENTITY_TYPES, ageInYears, isExpired, normalizeIdNumber, parseDate, type KycDocType } from './kyc-rules';

export interface CounterSenderInput {
  senderFirstName?: string;
  senderLastName?: string;
  senderPhone?: string;
  senderBirthDate?: string;
  senderIdType?: string;
  senderIdNumber?: string;
  senderIdExpiry?: string;
  senderIdCountry?: string;
}

export interface CounterSender {
  firstName: string;
  lastName: string;
  phone: string;
  birthDate: Date;
  idType: KycDocType;
  idNumber: string; // normalisé
  idExpiry: Date;
  idCountry: string | null;
}

export const MIN_SENDER_AGE = 18;
export const MAX_SENDER_AGE = 110;

const clean = (s: unknown): string => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ') : '');

/** Nom comparable : minuscules, sans accents ni ponctuation. */
export const normalizeName = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Valide la saisie de l'agent. Renvoie la liste des problèmes (vide = valide) et l'expéditeur normalisé.
 * Les messages sont destinés à l'agent, un par champ à corriger.
 */
export function parseCounterSender(input: CounterSenderInput, now = new Date()): { errors: string[]; sender: CounterSender | null } {
  const errors: string[] = [];
  const firstName = clean(input.senderFirstName);
  const lastName = clean(input.senderLastName);
  const phone = clean(input.senderPhone).replace(/[^\d+]/g, '');
  if (firstName.length < 2) errors.push("Prénom de l'expéditeur manquant.");
  if (lastName.length < 2) errors.push("Nom de l'expéditeur manquant.");
  if (phone.replace(/\D/g, '').length < 8) errors.push("Téléphone de l'expéditeur manquant ou trop court.");

  const birth = parseDate(clean(input.senderBirthDate));
  if (!birth) errors.push("Date de naissance de l'expéditeur manquante (AAAA-MM-JJ).");
  else {
    const age = ageInYears(birth, now);
    if (age < MIN_SENDER_AGE) errors.push(`L'expéditeur doit avoir au moins ${MIN_SENDER_AGE} ans.`);
    else if (age > MAX_SENDER_AGE) errors.push('Date de naissance invalide.');
  }

  const idType = clean(input.senderIdType).toUpperCase();
  if (!(IDENTITY_TYPES as readonly string[]).includes(idType)) errors.push("Type de pièce d'identité manquant (carte, passeport, permis, titre de séjour).");
  const idNumber = normalizeIdNumber(clean(input.senderIdNumber));
  if (idNumber.length < 4 || idNumber.length > 40) errors.push("Numéro de la pièce d'identité manquant ou invalide.");
  const expiry = parseDate(clean(input.senderIdExpiry));
  if (!expiry) errors.push("Date d'expiration de la pièce manquante (AAAA-MM-JJ).");
  else if (isExpired(expiry, now)) errors.push('La pièce d\'identité est expirée : elle ne peut pas être acceptée.');

  if (errors.length || !birth || !expiry) return { errors, sender: null };
  return {
    errors,
    sender: {
      firstName, lastName, phone, birthDate: birth, idType: idType as KycDocType, idNumber, idExpiry: expiry,
      idCountry: clean(input.senderIdCountry) || null,
    },
  };
}

/** Une fiche existante désigne-t-elle la MÊME personne que la saisie ? (nom de famille + date de naissance). */
export function sameIdentity(existing: { lastName: string; birthDate: Date }, s: CounterSender): boolean {
  return normalizeName(existing.lastName) === normalizeName(s.lastName) && existing.birthDate.toISOString().slice(0, 10) === s.birthDate.toISOString().slice(0, 10);
}
