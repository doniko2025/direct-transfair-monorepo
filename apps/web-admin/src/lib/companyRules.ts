// src/lib/companyRules.ts
// Règles de saisie d'une société. Le backend les applique à la création (CreateClientDto)
// mais PAS à la mise à jour (PATCH /clients/:id accepte n'importe quoi) : le web les vérifie
// donc dans les deux cas.

import type { SubscriptionStatus, SubscriptionType } from '@direct-transfair/shared';

export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
export const SUBDOMAIN = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
export const DOMAIN = /^(www\.)?[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/;
export const COMPANY_CODE = /^[A-Z0-9]{3,12}$/;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Propose un code (A-Z, 0-9, 12 max) à partir du nom de la société. */
export function suggestCode(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
}

export const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  ACTIVE: 'Active',
  TRIAL: 'Période d’essai',
  INACTIVE: 'Inactive',
  SUSPENDED: 'Suspendue',
  EXPIRED: 'Expirée',
};

export type StatusTone = 'ok' | 'brand' | 'warn' | 'neutral';

export const STATUS_TONE: Record<SubscriptionStatus, StatusTone> = {
  ACTIVE: 'ok',
  TRIAL: 'brand',
  INACTIVE: 'neutral',
  SUSPENDED: 'warn',
  EXPIRED: 'warn',
};

export const TYPE_LABEL: Record<SubscriptionType, string> = {
  RENTAL: 'Location',
  PURCHASE: 'Achat',
};

export function statusLabel(status: string | null | undefined): string {
  return status && status in STATUS_LABEL ? STATUS_LABEL[status as SubscriptionStatus] : 'Inconnu';
}

export function statusTone(status: string | null | undefined): StatusTone {
  return status && status in STATUS_TONE ? STATUS_TONE[status as SubscriptionStatus] : 'neutral';
}

/** Statuts qui coupent l'accès : la société est « à surveiller » dans les compteurs. */
export function isActiveStatus(status: string | null | undefined): boolean {
  return status === 'ACTIVE' || status === 'TRIAL';
}

export function formatAmount(value: string | number, currency: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return `— ${currency}`;
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'GNF' || currency === 'XOF' ? 0 : 2,
    }).format(n);
  } catch {
    return `${n.toLocaleString('fr-FR')} ${currency}`;
  }
}

export function formatDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Couleur sûre à injecter dans un style : jamais autre chose qu'un hex valide. */
export function safeColor(value: string | null | undefined, fallback: string): string {
  return value && HEX_COLOR.test(value) ? value : fallback;
}
