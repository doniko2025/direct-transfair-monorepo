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

// ── Numéro Orange Money ↔ devise du compte ─────────────
// Le numéro qui reçoit les retraits doit être du pays où la devise du compte circule :
//   • GNF (franc guinéen)    → numéro mobile GUINÉEN obligatoire (+224 suivi de 9 chiffres, commençant par 6) ;
//   • XOF (franc CFA)        → numéro d'un pays de la zone UEMOA (Sénégal, Mali, Côte d'Ivoire, Burkina, Niger, Togo, Bénin, Guinée-Bissau) ;
//   • toute autre devise (EUR, USD, GBP…) → Orange Money n'est pas proposé : retraits par compte bancaire (IBAN) uniquement.
// Un compte en euros ne peut donc jamais enregistrer un numéro Orange guinéen, et un compte guinéen ne peut pas enregistrer un numéro étranger.
// (Le préfixe de l'opérateur n'est pas contrôlé : les plages changent et les numéros sont portables.)

export const ORANGE_COUNTRY_MISMATCH_CODE = 'ORANGE_COUNTRY_MISMATCH';
export const ORANGE_NOT_AVAILABLE_CODE = 'ORANGE_NOT_AVAILABLE';

/** Indicatifs (sans « + ») de la zone UEMOA, où circule le franc CFA (XOF). */
const UEMOA_DIAL_CODES = ['221', '223', '225', '226', '227', '228', '229', '245'];

/** Orange Money est-il proposé pour les retraits d'un compte dans cette devise ? */
export const isOrangeMoneyCurrency = (currency: string | null | undefined): boolean => currency === 'GNF' || currency === 'XOF';

/** Numéro mobile guinéen : +224 puis 9 chiffres commençant par 6 (le fixe commence par 3). */
export const isGuineanMobile = (e164: string): boolean => /^\+2246\d{8}$/.test(e164);

/**
 * Numéro Orange Money accepté pour un compte dans cette devise (E.164) — ou erreur 400 explicite (avec un `code`).
 * Fonction pure.
 */
export function assertOrangePhoneForCurrency(raw: unknown, currency: string): string {
  if (!isOrangeMoneyCurrency(currency)) {
    throw new BadRequestException({
      statusCode: 400,
      code: ORANGE_NOT_AVAILABLE_CODE,
      message: `Orange Money n'est pas disponible pour un compte en ${currency}. Les retraits d'un compte en ${currency} se font par compte bancaire (IBAN).`,
    });
  }
  const phone = assertOrangePhone(raw);
  if (currency === 'GNF' && !isGuineanMobile(phone)) {
    throw new BadRequestException({
      statusCode: 400,
      code: ORANGE_COUNTRY_MISMATCH_CODE,
      message: 'Un compte en franc guinéen (GNF) exige un numéro Orange Money guinéen : +224 suivi de 9 chiffres commençant par 6 (ex. +224 620 00 00 00).',
    });
  }
  if (currency === 'XOF' && !UEMOA_DIAL_CODES.some((d) => phone.startsWith(`+${d}`))) {
    throw new BadRequestException({
      statusCode: 400,
      code: ORANGE_COUNTRY_MISMATCH_CODE,
      message: 'Un compte en franc CFA (XOF) exige un numéro Orange Money d\'un pays de la zone CFA (Sénégal, Mali, Côte d\'Ivoire, Burkina Faso, Niger, Togo, Bénin, Guinée-Bissau).',
    });
  }
  return phone;
}

/** Vrai si un numéro déjà enregistré est incompatible avec la devise (anciens comptes créés avant cette règle). */
export function isOrangePhoneConsistent(phone: string | null | undefined, currency: string): boolean {
  if (!phone) return true;
  try {
    assertOrangePhoneForCurrency(phone, currency);
    return true;
  } catch {
    return false;
  }
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
  /** Devise du compte : un numéro Orange Money d'un autre pays (ancien compte) n'est plus proposé. */
  currency?: string | null,
): string[] {
  return enabled.filter((m) => {
    if (m === 'ORANGE_MONEY') return !!profile.orangeMoneyPhone && (!currency || isOrangePhoneConsistent(profile.orangeMoneyPhone, currency));
    if (m === 'BANK_TRANSFER') return !!profile.bankIban;
    return false;
  });
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
  /** Obligatoire pour un compte GNF / XOF ; refusé pour les autres devises (retraits par IBAN). */
  orangeMoneyPhone?: string | null;
}

const cleanText = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  return s ? s : null;
};

/**
 * Valide et normalise la fiche saisie à l'inscription ou à l'activation. Fonction pure.
 * `currency` = devise du compte : le numéro Orange Money doit alors correspondre à cette devise (voir ci-dessus) ; pour une devise sans
 * Orange Money (EUR…), aucun numéro n'est accepté et la fiche naît sans destination (l'IBAN se renseigne ensuite dans les réglages).
 * Sans `currency`, comportement historique : numéro valide obligatoire.
 */
export function normalizeProfileInput(raw: Partial<MerchantProfileInput>, currency?: string): {
  businessName: string;
  orangeMoneyPhone: string | null;
  category: string | null;
  address: string | null;
  city: string | null;
} {
  const businessName = cleanText(raw.businessName);
  if (!businessName || businessName.length < 2) throw new BadRequestException('Indiquez le nom de votre commerce (2 caractères minimum).');
  let orangeMoneyPhone: string | null;
  if (!currency) orangeMoneyPhone = assertOrangePhone(raw.orangeMoneyPhone);
  else if (!isOrangeMoneyCurrency(currency)) {
    if (cleanText(raw.orangeMoneyPhone)) assertOrangePhoneForCurrency(raw.orangeMoneyPhone, currency); // lève ORANGE_NOT_AVAILABLE
    orangeMoneyPhone = null;
  } else orangeMoneyPhone = assertOrangePhoneForCurrency(raw.orangeMoneyPhone, currency);
  return {
    businessName: businessName.slice(0, 80),
    category: cleanText(raw.category)?.slice(0, 60) ?? null,
    address: cleanText(raw.address)?.slice(0, 160) ?? null,
    city: cleanText(raw.city)?.slice(0, 80) ?? null,
    orangeMoneyPhone,
  };
}
