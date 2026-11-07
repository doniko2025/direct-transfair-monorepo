// src/lib/kycRules.ts
// Règles d'affichage de la vérification d'identité (file de validation et dossier d'un client).

import type { KycDocStatus, KycOverallStatus, KycQueueFilter } from '@direct-transfair/shared';

export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger';

export const KYC_TABS: readonly { id: KycQueueFilter; label: string }[] = [
  { id: 'PENDING', label: 'À valider' },
  { id: 'REJECTED', label: 'Refusés' },
  { id: 'NOT_SUBMITTED', label: 'Rien envoyé' },
  { id: 'APPROVED', label: 'Vérifiés' },
  { id: 'ALL', label: 'Tous' },
];

export const OVERALL_TONE: Record<KycOverallStatus, Tone> = {
  NOT_SUBMITTED: 'warn',
  PENDING: 'brand',
  PARTIAL: 'warn',
  REJECTED: 'danger',
  EXPIRED: 'danger',
  VERIFIED: 'ok',
};

export const DOC_TONE: Record<KycDocStatus, Tone> = {
  PENDING: 'brand',
  APPROVED: 'ok',
  REJECTED: 'danger',
  EXPIRED: 'danger',
};

const HOUR = 3_600_000;

/** « 3 h », « 2 j 4 h », « moins d'une heure » — depuis quand un dossier attend. */
export function waitingLabel(fromIso: string | null | undefined, now: number = Date.now()): string | null {
  if (!fromIso) return null;
  const t = new Date(fromIso).getTime();
  if (Number.isNaN(t)) return null;
  const hours = Math.max(0, Math.floor((now - t) / HOUR));
  if (hours < 1) return "moins d'une heure";
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest > 0 && days < 7 ? `${days} j ${rest} h` : `${days} j`;
}

/** Plus de 24 h d'attente : à traiter en priorité ; plus de 48 h : en retard. */
export function waitingTone(fromIso: string | null | undefined, now: number = Date.now()): Tone {
  if (!fromIso) return 'neutral';
  const t = new Date(fromIso).getTime();
  if (Number.isNaN(t)) return 'neutral';
  const h = (now - t) / HOUR;
  return h >= 48 ? 'danger' : h >= 24 ? 'warn' : 'neutral';
}

/** AAAA-MM-JJ → « 5 juin 2031 » (pas de décalage de fuseau : la date est lue telle quelle). */
export function formatDay(day: string | null | undefined): string | null {
  if (!day) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** La date d'expiration tombe dans les 30 jours (ou est dépassée). */
export function expiresSoon(day: string | null | undefined, now: number = Date.now()): boolean {
  if (!day) return false;
  const t = new Date(`${day.slice(0, 10)}T23:59:59Z`).getTime();
  return !Number.isNaN(t) && t - now < 30 * 24 * HOUR;
}

/** Chaîne de saisie comparée sans accents ni casse (nom du profil vs nom lu sur la pièce). */
export function normalizeText(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
