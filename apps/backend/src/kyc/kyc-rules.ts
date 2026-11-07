// apps/backend/src/kyc/kyc-rules.ts
// =========================================================
// KYC RULES v1.0 — règles pures (sans base de données) de la vérification d'identité.
//
//   • quelles pièces il faut fournir, et lesquelles ouvrent quel niveau KYC ;
//   • contrôle d'un fichier envoyé (taille, type RÉEL lu dans les premiers octets, pas la déclaration du client) ;
//   • calcul du niveau KYC à partir des pièces VALIDÉES et non expirées ;
//   • statut global affiché au client (non envoyé / en cours / validé / refusé / expiré) et pièces manquantes ;
//   • calendrier des rappels.
//
// Niveaux : LEVEL_0 aucune vérification (aucune opération sortante) → LEVEL_1 pièce d'identité + selfie validés
//           → LEVEL_2 + justificatif de domicile validé → LEVEL_3 attribué à la main (aucune règle automatique).
// =========================================================

import { createHash } from 'crypto';

export type KycDocType =
  | 'NATIONAL_ID'
  | 'PASSPORT'
  | 'DRIVER_LICENSE'
  | 'RESIDENCE_PERMIT'
  | 'SELFIE'
  | 'PROOF_OF_ADDRESS'
  | 'BANK_STATEMENT';

export type KycStatusName = 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export type KycLevelName = 'LEVEL_0' | 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';

/** Pièces qui prouvent l'identité (une seule suffit, avec le selfie). */
export const IDENTITY_TYPES: readonly KycDocType[] = ['NATIONAL_ID', 'PASSPORT', 'DRIVER_LICENSE', 'RESIDENCE_PERMIT'];
/** Justificatifs de domicile (un seul suffit pour le niveau 2). */
export const ADDRESS_TYPES: readonly KycDocType[] = ['PROOF_OF_ADDRESS', 'BANK_STATEMENT'];
/** Pièces avec un verso à photographier. */
export const NEEDS_BACK: readonly KycDocType[] = ['NATIONAL_ID', 'DRIVER_LICENSE', 'RESIDENCE_PERMIT'];
/** Pièces qui ont une date d'expiration (obligatoire à l'envoi). */
export const NEEDS_EXPIRY: readonly KycDocType[] = ['NATIONAL_ID', 'PASSPORT', 'DRIVER_LICENSE', 'RESIDENCE_PERMIT'];

export const ALL_DOC_TYPES: readonly KycDocType[] = [...IDENTITY_TYPES, 'SELFIE', ...ADDRESS_TYPES];

export const DOC_LABEL: Record<KycDocType, string> = {
  NATIONAL_ID: "Carte nationale d'identité",
  PASSPORT: 'Passeport',
  DRIVER_LICENSE: 'Permis de conduire',
  RESIDENCE_PERMIT: 'Titre de séjour',
  SELFIE: "Selfie avec la pièce d'identité",
  PROOF_OF_ADDRESS: 'Justificatif de domicile',
  BANK_STATEMENT: 'Relevé bancaire',
};

export const isDocType = (v: unknown): v is KycDocType => typeof v === 'string' && (ALL_DOC_TYPES as readonly string[]).includes(v);

// ── Fichiers ─────────────────────────────────────────────
export const MAX_FILE_BYTES = 6 * 1024 * 1024; // 6 Mo par fichier
export const MIN_FILE_BYTES = 8 * 1024; // en dessous, ce n'est pas une photo lisible de pièce
export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];

/** Type réel d'un fichier d'après ses premiers octets (« magic bytes »). null si non reconnu. */
export function sniffMime(buf: Buffer): AllowedMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  return null;
}

export class KycFileError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export interface DecodedFile {
  buffer: Buffer;
  mimeType: AllowedMime;
  sizeBytes: number;
  sha256: string;
}

/** Décode et contrôle un fichier reçu en base64 (avec ou sans préfixe « data:...;base64, »). Lève KycFileError. */
export function decodeUpload(raw: unknown, label = 'Le fichier'): DecodedFile {
  if (typeof raw !== 'string' || raw.length === 0) throw new KycFileError(`${label} est manquant.`);
  const base64 = raw.replace(/^data:[^;,]*;base64,/i, '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new KycFileError(`${label} est illisible (base64 invalide).`);
  // Garde avant décodage : on ne décode pas un contenu manifestement trop grand.
  if (base64.length > Math.ceil((MAX_FILE_BYTES * 4) / 3) + 8) {
    throw new KycFileError(`${label} dépasse ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} Mo.`);
  }
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > MAX_FILE_BYTES) throw new KycFileError(`${label} dépasse ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} Mo.`);
  if (buffer.length < MIN_FILE_BYTES) throw new KycFileError(`${label} est trop petit pour être une photo lisible. Reprenez-la.`);
  const mimeType = sniffMime(buffer);
  if (!mimeType) throw new KycFileError(`${label} doit être une image JPEG, PNG, WEBP ou un PDF.`);
  return { buffer, mimeType, sizeBytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') };
}

// ── Dates ────────────────────────────────────────────────
/** Interprète une date « AAAA-MM-JJ » (ou ISO). null si invalide. */
export function parseDate(raw: unknown): Date | null {
  if (typeof raw !== 'string' && !(raw instanceof Date)) return null;
  const d = raw instanceof Date ? raw : new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const startOfDayUtc = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Une pièce est valable jusqu'à la fin de son jour d'expiration. */
export function isExpired(expiry: Date | null | undefined, now: Date): boolean {
  if (!expiry) return false;
  return startOfDayUtc(expiry).getTime() + 86_400_000 <= now.getTime();
}

export function ageInYears(birth: Date, now: Date): number {
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const m = now.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

// ── Niveau et statut ─────────────────────────────────────
export interface DocLike {
  id?: string;
  type: string;
  status: string;
  expiryDate?: Date | null;
  rejectionReason?: string | null;
  createdAt?: Date;
}

const valid = (d: DocLike, now: Date) => d.status === 'APPROVED' && !isExpired(d.expiryDate ?? null, now);

/** Niveau que les pièces VALIDÉES et non expirées permettent d'atteindre (jamais LEVEL_3 : décision manuelle). */
export function levelFromDocs(docs: readonly DocLike[], now: Date): KycLevelName {
  const identity = docs.some((d) => (IDENTITY_TYPES as readonly string[]).includes(d.type) && valid(d, now));
  const selfie = docs.some((d) => d.type === 'SELFIE' && valid(d, now));
  if (!identity || !selfie) return 'LEVEL_0';
  const address = docs.some((d) => (ADDRESS_TYPES as readonly string[]).includes(d.type) && valid(d, now));
  return address ? 'LEVEL_2' : 'LEVEL_1';
}

export const LEVEL_ORDER: readonly KycLevelName[] = ['LEVEL_0', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3'];
export const levelRank = (l: string): number => Math.max(0, LEVEL_ORDER.indexOf(l as KycLevelName));
export const maxLevel = (a: string, b: string): KycLevelName => (levelRank(a) >= levelRank(b) ? (a as KycLevelName) : (b as KycLevelName));

/** Pièces encore à fournir pour atteindre LEVEL_1 (vérification de base). */
export function missingForBasic(docs: readonly DocLike[], now: Date): KycDocType[] {
  const missing: KycDocType[] = [];
  const hasIdentity = docs.some((d) => (IDENTITY_TYPES as readonly string[]).includes(d.type) && ['PENDING', 'APPROVED'].includes(d.status) && !isExpired(d.expiryDate ?? null, now));
  const hasSelfie = docs.some((d) => d.type === 'SELFIE' && ['PENDING', 'APPROVED'].includes(d.status));
  if (!hasIdentity) missing.push('NATIONAL_ID');
  if (!hasSelfie) missing.push('SELFIE');
  return missing;
}

/**
 * Statut global du dossier d'un client :
 *  APPROVED      le niveau est au moins LEVEL_1 ;
 *  PENDING       au moins une pièce attend la validation de l'administrateur ;
 *  REJECTED      aucune pièce en attente et la dernière décision est un refus ;
 *  EXPIRED       une pièce validée est expirée et plus rien ne prouve l'identité ;
 *  NOT_SUBMITTED rien n'a été envoyé.
 */
export function overallStatus(level: string, docs: readonly DocLike[], now: Date): KycStatusName {
  // lot 8 — le niveau ne suffit plus : si la pièce d'identité est expirée et qu'aucune autre ne la remplace, le client n'est plus vérifié,
  // même avant le passage de la tâche de nuit qui ramène son niveau à 0.
  if (levelRank(level) >= 1) return identityLapsed(docs, now) ? 'EXPIRED' : 'APPROVED';
  if (docs.some((d) => d.status === 'PENDING')) return 'PENDING';
  const expiredApproved = docs.some((d) => d.status === 'APPROVED' && isExpired(d.expiryDate ?? null, now));
  if (expiredApproved) return 'EXPIRED';
  if (docs.some((d) => d.status === 'REJECTED')) return 'REJECTED';
  return 'NOT_SUBMITTED';
}


// ── Expiration de la pièce d'identité (lot 8) ────────────
const DAY = 86_400_000;
const isIdentity = (d: DocLike) => (IDENTITY_TYPES as readonly string[]).includes(d.type);

/** Jours restants avant la fin de validité (jour d'expiration compris) : 1 le dernier jour, 0 ou moins une fois expirée. */
export function daysUntilExpiry(expiry: Date, now: Date): number {
  return Math.ceil((startOfDayUtc(expiry).getTime() + DAY - now.getTime()) / DAY);
}

export interface IdentityExpiry {
  type: string;
  expiryDate: Date;
  /** Jours restants ; 0 quand la pièce est déjà expirée. */
  daysLeft: number;
  expired: boolean;
}

/**
 * Où en est la preuve d'identité du client ?
 *  • une pièce d'identité validée et valable existe → on retient celle qui dure le plus longtemps ; renvoyée seulement si elle expire dans
 *    `horizonDays` jours ou moins (sinon null : rien à signaler) ;
 *  • aucune pièce valable mais une pièce validée est arrivée à expiration → `expired: true` ;
 *  • sinon null (jamais vérifié, ou pièce refusée : un autre statut s'en charge).
 */
export function identityExpiry(docs: readonly DocLike[], now: Date, horizonDays = 30): IdentityExpiry | null {
  const live = docs.filter((d) => isIdentity(d) && valid(d, now));
  if (live.length > 0) {
    const dated = live.filter((d) => d.expiryDate);
    if (dated.length < live.length) return null; // une pièce sans date d'expiration ne peut pas expirer
    const best = dated.reduce((a, b) => ((a.expiryDate as Date) >= (b.expiryDate as Date) ? a : b));
    const daysLeft = daysUntilExpiry(best.expiryDate as Date, now);
    return daysLeft <= horizonDays ? { type: best.type, expiryDate: best.expiryDate as Date, daysLeft, expired: false } : null;
  }
  const lapsed = docs.filter((d) => isIdentity(d) && d.expiryDate && (d.status === 'EXPIRED' || (d.status === 'APPROVED' && isExpired(d.expiryDate, now))));
  if (lapsed.length === 0) return null;
  const last = lapsed.reduce((a, b) => ((a.expiryDate as Date) >= (b.expiryDate as Date) ? a : b));
  return { type: last.type, expiryDate: last.expiryDate as Date, daysLeft: 0, expired: true };
}

/** La pièce d'identité du client est expirée et rien ne la remplace : opérations sensibles refusées. */
export function identityLapsed(docs: readonly DocLike[], now: Date): boolean {
  return identityExpiry(docs, now, 0)?.expired === true;
}

/** Fenêtre de renouvellement : dans les 30 jours avant l'échéance, le client peut envoyer une pièce de remplacement. */
export const EXPIRY_RENEWAL_DAYS = 30;

/** Seuils (en jours avant l'expiration) auxquels le client est prévenu. */
export const EXPIRY_NOTICE_DAYS: readonly number[] = [30, 7];

/**
 * Seuil d'alerte à envoyer maintenant, ou null. `sentDays` = dernier seuil déjà envoyé pour cette pièce (null = aucun).
 * Un seuil n'est envoyé qu'une fois ; si le client n'a rien reçu jusque-là (pièce validée à 5 jours de l'expiration), on envoie le seuil
 * le plus proche, pas tous.
 */
export function expiryNoticeDue(expiry: Date, sentDays: number | null, now: Date): number | null {
  const left = daysUntilExpiry(expiry, now);
  if (left < 1) return null; // expirée : c'est la tâche d'expiration qui prévient
  const threshold = [...EXPIRY_NOTICE_DAYS].sort((a, b) => a - b).find((t) => left <= t);
  if (threshold === undefined) return null;
  if (sentDays !== null && sentDays <= threshold) return null;
  return threshold;
}

// ── Garde des opérations ─────────────────────────────────
/** Un client (rôle USER) sans aucune vérification ne peut ni envoyer, ni retirer, ni programmer de virement. */
export function mustBeVerified(user: { role: string; kycLevel: string }): boolean {
  return user.role === 'USER' && levelRank(user.kycLevel) < 1;
}

/** KYC_ENFORCEMENT=off désactive le blocage (déploiement progressif / recette). Tout autre valeur : actif. */
export function enforcementEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.KYC_ENFORCEMENT ?? 'on').trim().toLowerCase() !== 'off';
}

// ── Rappels ──────────────────────────────────────────────
/** Délai (en jours) à attendre avant le rappel numéro `sentCount + 1` : 1, 3, 7 puis chaque semaine. */
export const REMINDER_DAYS_SCHEDULE: readonly number[] = [1, 2, 4];
export const REMINDER_WEEKLY_DAYS = 7;
export const MAX_REMINDERS = 12;
const DAY_MS = 86_400_000;

/**
 * Un rappel est-il dû ?
 *   • premier rappel : 1 jour après la création du compte ;
 *   • suivants : 2 jours, 4 jours puis 7 jours après le précédent (rappels aux jours 1, 3, 7, 14, 21…) ;
 *   • au plus MAX_REMINDERS rappels, puis arrêt (l'administrateur voit toujours la liste des comptes non vérifiés).
 */
export function reminderDue(p: { count: number; lastAt: Date | null; createdAt: Date; now: Date }): boolean {
  if (p.count >= MAX_REMINDERS) return false;
  if (!p.lastAt) return p.now.getTime() - p.createdAt.getTime() >= DAY_MS;
  const wait = REMINDER_DAYS_SCHEDULE[p.count] ?? REMINDER_WEEKLY_DAYS;
  return p.now.getTime() - p.lastAt.getTime() >= wait * DAY_MS;
}

/** Normalise un numéro de pièce pour la comparaison (majuscules, sans espace ni tiret). */
export const normalizeIdNumber = (s: string): string => s.toUpperCase().replace(/[\s\-./]/g, '');
