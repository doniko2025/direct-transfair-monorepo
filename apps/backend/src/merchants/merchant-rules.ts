// apps/backend/src/merchants/merchant-rules.ts
// =========================================================
// RÈGLES PURES DU COMPTE MARCHAND (lot 11) — aucune lecture en base, entièrement testables.
//   commission · montants et plafonds par devise · expiration · jeton et lien du QR code · références
//   délai de sécurité après changement de destination · validation Orange Money / IBAN · masquage
// =========================================================

import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

import { normalizePhoneStrict, PHONE_INVALID_MESSAGE } from '../common/utils/phone.util';

/** Devises sans centimes : les montants et commissions y sont des entiers. */
export const ZERO_DECIMAL_CURRENCIES = ['XOF', 'GNF'];

export const QR_LINK_PREFIX = 'directtransfair://merchant-pay/';
/** Longueur du jeton : 24 octets aléatoires en base64url = 32 caractères (192 bits). */
const TOKEN_BYTES = 24;
const TOKEN_REGEX = /^[A-Za-z0-9_-]{32}$/;

/** Nombre maximum de demandes en attente par marchand (garde-fou contre l'inondation de demandes / de QR). */
export const MAX_PENDING_PER_MERCHANT = 20;
/** Plafond de demandes en attente reçues par un même client (harcèlement). */
export const MAX_PENDING_PER_PAYER = 10;

export const DEFAULT_CATEGORIES = [
  'Boutique / commerce',
  'Alimentation',
  'Restaurant / café',
  'Pharmacie / santé',
  'Mode / beauté',
  'Transport',
  'Services',
  'Autre',
] as const;

export const isZeroDecimal = (currency: string): boolean => ZERO_DECIMAL_CURRENCIES.includes(currency);

/** Arrondi demi vers le haut sur les décimales de la devise (entier pour XOF / GNF, 2 décimales sinon). */
export function roundForCurrency(value: number, currency: string): number {
  const digits = isZeroDecimal(currency) ? 0 : 2;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Commission et net du marchand. La commission n'est jamais supérieure au montant ni négative. */
export function computeFee(amount: number, pct: number, currency: string): { fee: number; net: number } {
  const safePct = Number.isFinite(pct) && pct > 0 ? pct : 0;
  const fee = Math.min(amount, roundForCurrency((amount * safePct) / 100, currency));
  return { fee, net: roundForCurrency(amount - fee, currency) };
}

/** Un montant est valable s'il est positif, fini, sans décimales superflues pour la devise. */
export function assertValidAmount(amount: unknown, currency: string): number {
  const n = typeof amount === 'string' ? Number(amount) : (amount as number);
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) throw new BadRequestException('Montant invalide.');
  if (isZeroDecimal(currency) && !Number.isInteger(n)) {
    throw new BadRequestException(`En ${currency}, le montant doit être un nombre entier (pas de centimes).`);
  }
  if (!isZeroDecimal(currency) && Math.round(n * 100) / 100 !== n) {
    throw new BadRequestException('Deux décimales au maximum.');
  }
  return n;
}

export interface AmountBounds {
  min?: number;
  max?: number;
}

export function assertWithinBounds(amount: number, currency: string, bounds: AmountBounds, what = 'paiement'): void {
  if (bounds.min !== undefined && amount < bounds.min) {
    throw new BadRequestException(`Le ${what} minimum est de ${bounds.min} ${currency}.`);
  }
  if (bounds.max !== undefined && amount > bounds.max) {
    throw new BadRequestException(`Le ${what} maximum est de ${bounds.max} ${currency}.`);
  }
}

// ── Expiration ─────────────────────────────────────────

export function computeExpiry(method: 'PHONE' | 'QR', merchant: { qrValidityMinutes: number; phoneRequestValidityMinutes: number }, now: Date): Date {
  const minutes = method === 'QR' ? merchant.qrValidityMinutes : merchant.phoneRequestValidityMinutes;
  return new Date(now.getTime() + minutes * 60_000);
}

export const isExpired = (expiresAt: Date, now: Date): boolean => expiresAt.getTime() <= now.getTime();

/** Secondes restantes (jamais négatives) — pour le compte à rebours de l'application. */
export const secondsLeft = (expiresAt: Date, now: Date): number => Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));

// ── QR code ────────────────────────────────────────────

export const generateQrToken = (): string => crypto.randomBytes(TOKEN_BYTES).toString('base64url');

export const buildQrPayload = (token: string): string => `${QR_LINK_PREFIX}${token}`;

/**
 * Extrait le jeton d'un contenu scanné. Accepte le lien complet de l'application ou le jeton seul.
 * Tout autre contenu (URL externe, texte quelconque) est rejeté : l'application ne suit jamais un lien inconnu.
 */
export function parseQrPayload(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  const token = text.startsWith(QR_LINK_PREFIX) ? text.slice(QR_LINK_PREFIX.length) : text;
  return TOKEN_REGEX.test(token) ? token : null;
}

// ── Références ─────────────────────────────────────────

/** `MP-` encaissement, `MR-` retrait : horodatage base 36 + 6 hex aléatoires. */
export function generateReference(kind: 'PAYMENT' | 'PAYOUT', now = new Date()): string {
  const prefix = kind === 'PAYMENT' ? 'MP' : 'MR';
  return `${prefix}-${now.getTime().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

// ── Destination des retraits ───────────────────────────

export function assertOrangePhone(raw: unknown): string {
  const phone = normalizePhoneStrict(typeof raw === 'string' ? raw : null);
  if (!phone) throw new BadRequestException(PHONE_INVALID_MESSAGE);
  return phone;
}

const IBAN_LENGTHS: Record<string, number> = { FR: 27, BE: 16, DE: 22, ES: 24, IT: 27, GB: 22, PT: 25, NL: 18, LU: 20, CH: 21, SN: 28, CI: 28, ML: 28, BF: 28, BJ: 28, TG: 28, NE: 28, MA: 28 };

/** Clé de contrôle ISO 7064 (mod 97). Retourne l'IBAN compacté en majuscules ou lève une erreur. */
export function assertIban(raw: unknown): string {
  const iban = String(raw ?? '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) throw new BadRequestException('IBAN invalide.');
  const expected = IBAN_LENGTHS[iban.slice(0, 2)];
  if (expected && iban.length !== expected) throw new BadRequestException('IBAN invalide : longueur incorrecte pour ce pays.');
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const v = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const digit of v) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  if (remainder !== 1) throw new BadRequestException('IBAN invalide : clé de contrôle incorrecte.');
  return iban;
}

export function assertBic(raw: unknown): string | null {
  const bic = String(raw ?? '').replace(/\s+/g, '').toUpperCase();
  if (!bic) return null;
  if (!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) throw new BadRequestException('Code BIC invalide.');
  return bic;
}

export const maskPhone = (phone: string | null | undefined): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 6) return '•••' + digits.slice(-2);
  return `+${digits.slice(0, 3)} ••• ••${digits.slice(-3)}`;
};

export const maskIban = (iban: string | null | undefined): string => {
  if (!iban) return '';
  return `${iban.slice(0, 4)} •••• ${iban.slice(-4)}`;
};

// ── Délai de sécurité ──────────────────────────────────

/**
 * Après un changement de numéro Orange Money ou de compte bancaire, les retraits sont bloqués pendant `hours` heures :
 * un fraudeur qui aurait volé le téléphone ET le code ne vide pas le solde dans la minute. 0 = aucun délai.
 * La création initiale de la destination (inscription) ne déclenche pas de délai : `changedAt` est alors nul.
 */
export function payoutCooldown(changedAt: Date | null | undefined, hours: number, now: Date): { active: boolean; until: Date | null } {
  if (!changedAt || hours <= 0) return { active: false, until: null };
  const until = new Date(changedAt.getTime() + hours * 3_600_000);
  return until.getTime() > now.getTime() ? { active: true, until } : { active: false, until: null };
}

/** Seuls les moyens ouverts par la société ET dont la destination est renseignée sont proposés. */
export function availablePayoutMethods(
  enabled: string[],
  profile: { orangeMoneyPhone?: string | null; bankIban?: string | null },
): string[] {
  return enabled.filter((m) => (m === 'ORANGE_MONEY' ? !!profile.orangeMoneyPhone : m === 'BANK_TRANSFER' ? !!profile.bankIban : false));
}

/** Le mode SANDBOX (retraits payés automatiquement, sans argent réel) n'est jamais appliqué en production. */
export function effectivePayoutMode(configured: string, env: NodeJS.ProcessEnv = process.env): 'MANUAL' | 'SANDBOX' {
  if (configured !== 'SANDBOX') return 'MANUAL';
  const prod = String(env.NODE_ENV ?? '').toLowerCase() === 'production';
  const allowed = String(env.ALLOW_SANDBOX_PAYOUTS ?? '').toLowerCase() === 'true';
  return !prod || allowed ? 'SANDBOX' : 'MANUAL';
}

// ── Fiche du commerce ──────────────────────────────────

export interface MerchantProfileInput {
  businessName: string;
  category?: string | null;
  address?: string | null;
  city?: string | null;
  orangeMoneyPhone: string;
}

const cleanText = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  return s ? s : null;
};

/** Valide et normalise la fiche saisie à l'inscription ou à l'activation. Fonction pure. */
export function normalizeProfileInput(raw: Partial<MerchantProfileInput>): {
  businessName: string;
  orangeMoneyPhone: string;
  category: string | null;
  address: string | null;
  city: string | null;
} {
  const businessName = cleanText(raw.businessName);
  if (!businessName || businessName.length < 2) throw new BadRequestException('Indiquez le nom de votre commerce (2 caractères minimum).');
  return {
    businessName: businessName.slice(0, 80),
    category: cleanText(raw.category)?.slice(0, 60) ?? null,
    address: cleanText(raw.address)?.slice(0, 160) ?? null,
    city: cleanText(raw.city)?.slice(0, 80) ?? null,
    orangeMoneyPhone: assertOrangePhone(raw.orangeMoneyPhone),
  };
}
