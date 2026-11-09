// apps/backend/src/company-settings/company-settings.logic.ts
// =========================================================
// PARAMÈTRES D'UNE SOCIÉTÉ v1.0 — valeurs par défaut, fusion et validation (fonctions pures, testables sans base).
//
// Principe : la base ne stocke que ce que l'admin de la société a modifié ("surcharges"). La valeur appliquée est
//   défaut du serveur  ←  surcharge de la société
// Rien de métier n'est écrit en dur dans les services : ils lisent CompanySettingsService.forClient(clientId).
//
// Les défauts ci-dessous reprennent les anciennes valeurs codées en dur, SAUF une décision produit : seul l'envoi
// wallet → wallet est gratuit (avant : Mobile Money l'était aussi). L'admin peut changer chacune de ces valeurs.
// =========================================================

import { CurrencyCode } from '@prisma/client';

import { DEFAULT_PAYER_SHARE, DEFAULT_PLATFORM_SHARE, DEFAULT_SENDER_SHARE } from '../commission-rules/commission-rule-defaults';
import { DEFAULT_FEE_RATE, FEE_METHOD_KEYS, MAX_FEE_RATE } from '../fees-admin/fee-rules';
import { pickupValidityMonths } from '../transactions/pickup-rules';

// ─── Types ──────────────────────────────────────────────

export interface SplitSettings {
  /** % des frais pour l'agence qui paie le cash. */
  payerShare: number;
  /** % des frais pour l'agence d'envoi. */
  senderShare: number;
  /** % des frais pour la société (le reste : payeur + envoi + société = 100). */
  platformShare: number;
}

/** Moyens de recharge du wallet que la société peut ouvrir à ses clients. */
export const RECHARGE_METHODS = ['CARD', 'ORANGE_MONEY', 'SENDWAVE'] as const;

/** Moyens de retrait ouverts aux marchands. */
export const MERCHANT_PAYOUT_METHODS = ['ORANGE_MONEY', 'BANK_TRANSFER'] as const;
/** MANUAL : l'administrateur confirme chaque retrait après l'avoir payé. SANDBOX : essai, payé automatiquement (jamais en production). */
export const MERCHANT_PAYOUT_MODES = ['MANUAL', 'SANDBOX'] as const;

export interface MerchantSettings {
  /** Les comptes marchands et les encaissements sont-ils ouverts dans cette société ? */
  enabled: boolean;
  /** Commission (%) retenue sur chaque encaissement, à la charge du marchand. */
  paymentFeePct: number;
  /** Durée de validité d'un QR code d'encaissement, en minutes. */
  qrValidityMinutes: number;
  /** Durée de validité d'une demande envoyée à un numéro de téléphone, en minutes. */
  phoneRequestValidityMinutes: number;
  /** Commission (%) retenue sur chaque retrait. */
  payoutFeePct: number;
  /** Moyens de retrait ouverts (ORANGE_MONEY, BANK_TRANSFER). */
  payoutMethods: string[];
  payoutMode: string;
  /** Délai de sécurité (heures) avant le premier retrait vers un numéro / compte qui vient d'être modifié. 0 = aucun. */
  payoutCooldownHours: number;
  /** Par devise : plus petit et plus grand paiement, plus petit retrait. */
  minPayment: Record<string, number>;
  maxPayment: Record<string, number>;
  minPayout: Record<string, number>;
}

/** Remboursements : ce que la société rend, ou non, quand une opération est annulée ou rappelée. */
export interface RefundSettings {
  /** Remboursement d'un paiement marchand : la commission d'encaissement est rendue au marchand (prélevée sur le wallet de la société). */
  returnMerchantCommission: boolean;
  /** Rappel d'un envoi wallet → wallet décidé par le service client : les frais sont rendus à l'expéditeur. */
  returnFeesOnRecall: boolean;
  /** Délai (jours) pendant lequel un envoi wallet → wallet déjà crédité peut être rappelé. 0 = rappel fermé. */
  recallWindowDays: number;
}

export interface CompanySettings {
  fees: {
    /** Modes d'envoi sans frais (clés de FEE_METHOD_KEYS). Par défaut : uniquement WALLET (wallet → wallet). */
    freeMethods: string[];
    /** Taux (%) appliqué quand ni barème ni tarif du mode ne s'applique à un envoi payant. */
    fallbackFeeRatePct: number;
  };
  commissions: {
    /** Répartition des frais tant qu'aucune règle n'est enregistrée pour la combinaison expéditeur / agence payeuse. */
    defaultSplit: SplitSettings;
  };
  pickup: {
    /** Durée de validité d'un code de retrait, en mois (appliquée aux NOUVEAUX codes). */
    validityMonths: number;
    /** Vérifications de code échouées (par agent) avant blocage temporaire. */
    maxFailedChecks: number;
    /** Durée du blocage (et fenêtre de comptage des échecs), en minutes. */
    lockMinutes: number;
    /** L'agent doit saisir les derniers chiffres du téléphone du bénéficiaire pour payer. */
    requireBeneficiaryPhoneCheck: boolean;
    /** Nombre de chiffres demandés. */
    phoneCheckDigits: number;
  };
  alerts: {
    /** Seuil d'alerte « caisse basse » par devise ; 0 = pas d'alerte pour cette devise. */
    lowBalance: Record<string, number>;
  };
  recharge: {
    /** Moyens de recharge ouverts aux clients de la société (clés de RECHARGE_METHODS). Liste vide = recharge fermée. */
    enabledMethods: string[];
  };
  /** Lot 11 — comptes marchands. */
  merchant: MerchantSettings;
  /** Remboursements et rappels. */
  refunds: RefundSettings;
}

/** Surcharges enregistrées : même forme, tout est optionnel. */
export interface CompanySettingsPatch {
  fees?: { freeMethods?: string[]; fallbackFeeRatePct?: number };
  commissions?: { defaultSplit?: { payerShare: number; senderShare: number } };
  pickup?: {
    validityMonths?: number;
    maxFailedChecks?: number;
    lockMinutes?: number;
    requireBeneficiaryPhoneCheck?: boolean;
    phoneCheckDigits?: number;
  };
  /** Une valeur `null` retire la surcharge de la devise (retour au défaut). */
  alerts?: { lowBalance?: Record<string, number | null> };
  recharge?: { enabledMethods?: string[] };
  merchant?: {
    enabled?: boolean;
    paymentFeePct?: number;
    qrValidityMinutes?: number;
    phoneRequestValidityMinutes?: number;
    payoutFeePct?: number;
    payoutMethods?: string[];
    payoutMode?: string;
    payoutCooldownHours?: number;
    /** Une valeur `null` retire la surcharge de la devise (retour au défaut). */
    minPayment?: Record<string, number | null>;
    maxPayment?: Record<string, number | null>;
    minPayout?: Record<string, number | null>;
  };
  refunds?: { returnMerchantCommission?: boolean; returnFeesOnRecall?: boolean; recallWindowDays?: number };
}

// ─── Bornes ─────────────────────────────────────────────

export const LIMITS = {
  validityMonths: { min: 1, max: 36 },
  maxFailedChecks: { min: 1, max: 50 },
  lockMinutes: { min: 1, max: 1440 },
  phoneCheckDigits: { min: 3, max: 8 },
  lowBalance: { min: 0, max: 1_000_000_000_000 },
  merchantFeePct: { min: 0, max: 10 },
  qrValidityMinutes: { min: 1, max: 60 },
  phoneRequestValidityMinutes: { min: 1, max: 1440 },
  payoutCooldownHours: { min: 0, max: 168 },
  merchantAmount: { min: 0, max: 1_000_000_000_000 },
  recallWindowDays: { min: 0, max: 365 },
} as const;

export const CURRENCIES = Object.values(CurrencyCode) as string[];

// ─── Défauts ────────────────────────────────────────────

/** Durée de validité par défaut : variable d'environnement PICKUP_CODE_VALIDITY_MONTHS (1–36), sinon 5 mois. */
export const defaultValidityMonths = pickupValidityMonths;

export function defaultSettings(): CompanySettings {
  return {
    fees: {
      freeMethods: ['WALLET'],
      fallbackFeeRatePct: DEFAULT_FEE_RATE,
    },
    commissions: {
      defaultSplit: { payerShare: DEFAULT_PAYER_SHARE, senderShare: DEFAULT_SENDER_SHARE, platformShare: DEFAULT_PLATFORM_SHARE },
    },
    pickup: {
      validityMonths: defaultValidityMonths(),
      maxFailedChecks: 5,
      lockMinutes: 15,
      requireBeneficiaryPhoneCheck: false,
      phoneCheckDigits: 4,
    },
    alerts: {
      lowBalance: { XOF: 50_000, GNF: 500_000, EUR: 100, USD: 100, GBP: 100 },
    },
    // Comportement actuel conservé : les trois moyens sont ouverts (l'interrupteur global BLOCK_SIMULATED_RECHARGES reste prioritaire).
    recharge: { enabledMethods: [...RECHARGE_METHODS] },
    merchant: {
      enabled: true,
      paymentFeePct: 1,
      qrValidityMinutes: 5,
      phoneRequestValidityMinutes: 30,
      payoutFeePct: 0,
      payoutMethods: [...MERCHANT_PAYOUT_METHODS],
      payoutMode: 'MANUAL',
      payoutCooldownHours: 24,
      minPayment: { XOF: 100, GNF: 1_000, EUR: 1, USD: 1, GBP: 1 },
      maxPayment: { XOF: 2_000_000, GNF: 20_000_000, EUR: 3_000, USD: 3_000, GBP: 3_000 },
      minPayout: { XOF: 1_000, GNF: 10_000, EUR: 10, USD: 10, GBP: 10 },
    },
    // Comportement actuel conservé pour la commission marchand (non rendue). Le rappel d'un envoi wallet est ouvert 30 jours,
    // frais rendus : il n'a lieu que sur décision d'un deuxième membre du service client (règle des quatre yeux).
    refunds: { returnMerchantCommission: false, returnFeesOnRecall: true, recallWindowDays: 30 },
  };
}

// ─── Utilitaires ────────────────────────────────────────

const round2 = (n: number): number => Math.round(n * 100) / 100;
const hasAtMostTwoDecimals = (n: number): boolean => round2(n) === n;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isIntIn = (v: unknown, r: { min: number; max: number }): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= r.min && v <= r.max;

/**
 * Valeur appliquée = défaut + surcharges enregistrées. Une surcharge invalide (base modifiée à la main, bornes qui ont
 * changé) est ignorée champ par champ : elle ne bloque jamais un envoi, le défaut reprend la main.
 */
export function mergeSettings(raw: unknown): CompanySettings {
  const out = defaultSettings();
  if (!isRecord(raw)) return out;

  if (isRecord(raw.fees)) {
    const f = raw.fees;
    if (Array.isArray(f.freeMethods) && f.freeMethods.every((m) => typeof m === 'string' && FEE_METHOD_KEYS.includes(m))) {
      out.fees.freeMethods = [...new Set(f.freeMethods as string[])];
    }
    if (isNum(f.fallbackFeeRatePct) && f.fallbackFeeRatePct >= 0 && f.fallbackFeeRatePct <= MAX_FEE_RATE) {
      out.fees.fallbackFeeRatePct = f.fallbackFeeRatePct;
    }
  }

  if (isRecord(raw.commissions) && isRecord(raw.commissions.defaultSplit)) {
    const s = raw.commissions.defaultSplit;
    if (isNum(s.payerShare) && isNum(s.senderShare) && s.payerShare >= 0 && s.senderShare >= 0 && s.payerShare + s.senderShare <= 100) {
      out.commissions.defaultSplit = {
        payerShare: s.payerShare,
        senderShare: s.senderShare,
        platformShare: round2(100 - s.payerShare - s.senderShare),
      };
    }
  }

  if (isRecord(raw.pickup)) {
    const p = raw.pickup;
    if (isIntIn(p.validityMonths, LIMITS.validityMonths)) out.pickup.validityMonths = p.validityMonths;
    if (isIntIn(p.maxFailedChecks, LIMITS.maxFailedChecks)) out.pickup.maxFailedChecks = p.maxFailedChecks;
    if (isIntIn(p.lockMinutes, LIMITS.lockMinutes)) out.pickup.lockMinutes = p.lockMinutes;
    if (typeof p.requireBeneficiaryPhoneCheck === 'boolean') out.pickup.requireBeneficiaryPhoneCheck = p.requireBeneficiaryPhoneCheck;
    if (isIntIn(p.phoneCheckDigits, LIMITS.phoneCheckDigits)) out.pickup.phoneCheckDigits = p.phoneCheckDigits;
  }

  if (isRecord(raw.alerts) && isRecord(raw.alerts.lowBalance)) {
    for (const [cur, v] of Object.entries(raw.alerts.lowBalance)) {
      if (CURRENCIES.includes(cur) && isNum(v) && v >= LIMITS.lowBalance.min && v <= LIMITS.lowBalance.max) {
        out.alerts.lowBalance[cur] = v;
      }
    }
  }

  if (isRecord(raw.recharge) && Array.isArray(raw.recharge.enabledMethods)
      && raw.recharge.enabledMethods.every((m) => typeof m === 'string' && (RECHARGE_METHODS as readonly string[]).includes(m))) {
    out.recharge.enabledMethods = [...new Set(raw.recharge.enabledMethods as string[])];
  }

  if (isRecord(raw.merchant)) {
    const m = raw.merchant;
    if (typeof m.enabled === 'boolean') out.merchant.enabled = m.enabled;
    if (isNum(m.paymentFeePct) && m.paymentFeePct >= LIMITS.merchantFeePct.min && m.paymentFeePct <= LIMITS.merchantFeePct.max) out.merchant.paymentFeePct = m.paymentFeePct;
    if (isNum(m.payoutFeePct) && m.payoutFeePct >= LIMITS.merchantFeePct.min && m.payoutFeePct <= LIMITS.merchantFeePct.max) out.merchant.payoutFeePct = m.payoutFeePct;
    if (isIntIn(m.qrValidityMinutes, LIMITS.qrValidityMinutes)) out.merchant.qrValidityMinutes = m.qrValidityMinutes;
    if (isIntIn(m.phoneRequestValidityMinutes, LIMITS.phoneRequestValidityMinutes)) out.merchant.phoneRequestValidityMinutes = m.phoneRequestValidityMinutes;
    if (isIntIn(m.payoutCooldownHours, LIMITS.payoutCooldownHours)) out.merchant.payoutCooldownHours = m.payoutCooldownHours;
    if (Array.isArray(m.payoutMethods) && m.payoutMethods.every((x) => typeof x === 'string' && (MERCHANT_PAYOUT_METHODS as readonly string[]).includes(x))) {
      out.merchant.payoutMethods = [...new Set(m.payoutMethods as string[])];
    }
    if (typeof m.payoutMode === 'string' && (MERCHANT_PAYOUT_MODES as readonly string[]).includes(m.payoutMode)) out.merchant.payoutMode = m.payoutMode;
    for (const key of ['minPayment', 'maxPayment', 'minPayout'] as const) {
      const map = m[key];
      if (!isRecord(map)) continue;
      for (const [cur, v] of Object.entries(map)) {
        if (CURRENCIES.includes(cur) && isNum(v) && v >= LIMITS.merchantAmount.min && v <= LIMITS.merchantAmount.max) out.merchant[key][cur] = v;
      }
    }
  }

  if (isRecord(raw.refunds)) {
    const r = raw.refunds;
    if (typeof r.returnMerchantCommission === 'boolean') out.refunds.returnMerchantCommission = r.returnMerchantCommission;
    if (typeof r.returnFeesOnRecall === 'boolean') out.refunds.returnFeesOnRecall = r.returnFeesOnRecall;
    if (isIntIn(r.recallWindowDays, LIMITS.recallWindowDays)) out.refunds.recallWindowDays = r.recallWindowDays;
  }
  return out;
}

/** Erreur de validation lisible (le service la convertit en 400). */
export class SettingsValidationError extends Error {}

/**
 * Valide une modification envoyée par l'admin (strict : toute valeur invalide est refusée avec un message clair) et
 * renvoie la forme à enregistrer. `stored` = surcharges déjà enregistrées ; le résultat les fusionne avec la
 * modification (sections et champs absents de la modification restent inchangés).
 */
export function applyPatch(stored: unknown, patch: unknown): CompanySettingsPatch {
  if (!isRecord(patch)) throw new SettingsValidationError('Corps de requête invalide.');
  const next: CompanySettingsPatch = isRecord(stored) ? (JSON.parse(JSON.stringify(stored)) as CompanySettingsPatch) : {};

  if (patch.fees !== undefined) {
    if (!isRecord(patch.fees)) throw new SettingsValidationError('« fees » invalide.');
    const f = patch.fees;
    next.fees = { ...(next.fees ?? {}) };
    if (f.freeMethods !== undefined) {
      if (!Array.isArray(f.freeMethods) || !f.freeMethods.every((m) => typeof m === 'string')) {
        throw new SettingsValidationError('« Modes gratuits » : liste de modes attendue.');
      }
      const methods = [...new Set((f.freeMethods as string[]).map((m) => m.trim().toUpperCase()))];
      const unknown = methods.find((m) => !FEE_METHOD_KEYS.includes(m));
      if (unknown) throw new SettingsValidationError(`Mode d'envoi inconnu : « ${unknown} ».`);
      next.fees.freeMethods = methods;
    }
    if (f.fallbackFeeRatePct !== undefined) {
      const v = f.fallbackFeeRatePct;
      if (!isNum(v) || v < 0 || v > MAX_FEE_RATE) throw new SettingsValidationError(`Taux de repli : entre 0 et ${MAX_FEE_RATE} %.`);
      if (!hasAtMostTwoDecimals(v)) throw new SettingsValidationError('Taux de repli : deux décimales au maximum.');
      next.fees.fallbackFeeRatePct = v;
    }
  }

  if (patch.commissions !== undefined) {
    if (!isRecord(patch.commissions)) throw new SettingsValidationError('« commissions » invalide.');
    if (patch.commissions.defaultSplit !== undefined) {
      const s = patch.commissions.defaultSplit;
      if (!isRecord(s) || !isNum(s.payerShare) || !isNum(s.senderShare)) {
        throw new SettingsValidationError('Répartition par défaut : part du payeur et part de l\'envoi requises.');
      }
      if (s.payerShare < 0 || s.senderShare < 0 || s.payerShare > 100 || s.senderShare > 100) {
        throw new SettingsValidationError('Répartition par défaut : chaque part est comprise entre 0 et 100 %.');
      }
      if (!hasAtMostTwoDecimals(s.payerShare) || !hasAtMostTwoDecimals(s.senderShare)) {
        throw new SettingsValidationError('Répartition par défaut : deux décimales au maximum.');
      }
      if (round2(s.payerShare + s.senderShare) > 100) {
        throw new SettingsValidationError('Répartition par défaut : la somme des parts ne peut pas dépasser 100 %.');
      }
      next.commissions = { defaultSplit: { payerShare: s.payerShare, senderShare: s.senderShare } };
    }
  }

  if (patch.pickup !== undefined) {
    if (!isRecord(patch.pickup)) throw new SettingsValidationError('« pickup » invalide.');
    const p = patch.pickup;
    next.pickup = { ...(next.pickup ?? {}) };
    if (p.validityMonths !== undefined) {
      if (!isIntIn(p.validityMonths, LIMITS.validityMonths)) {
        throw new SettingsValidationError(`Validité du code : entre ${LIMITS.validityMonths.min} et ${LIMITS.validityMonths.max} mois.`);
      }
      next.pickup.validityMonths = p.validityMonths;
    }
    if (p.maxFailedChecks !== undefined) {
      if (!isIntIn(p.maxFailedChecks, LIMITS.maxFailedChecks)) {
        throw new SettingsValidationError(`Essais avant blocage : entre ${LIMITS.maxFailedChecks.min} et ${LIMITS.maxFailedChecks.max}.`);
      }
      next.pickup.maxFailedChecks = p.maxFailedChecks;
    }
    if (p.lockMinutes !== undefined) {
      if (!isIntIn(p.lockMinutes, LIMITS.lockMinutes)) {
        throw new SettingsValidationError(`Durée du blocage : entre ${LIMITS.lockMinutes.min} et ${LIMITS.lockMinutes.max} minutes.`);
      }
      next.pickup.lockMinutes = p.lockMinutes;
    }
    if (p.requireBeneficiaryPhoneCheck !== undefined) {
      if (typeof p.requireBeneficiaryPhoneCheck !== 'boolean') throw new SettingsValidationError('Contrôle du téléphone : oui ou non.');
      next.pickup.requireBeneficiaryPhoneCheck = p.requireBeneficiaryPhoneCheck;
    }
    if (p.phoneCheckDigits !== undefined) {
      if (!isIntIn(p.phoneCheckDigits, LIMITS.phoneCheckDigits)) {
        throw new SettingsValidationError(`Chiffres demandés : entre ${LIMITS.phoneCheckDigits.min} et ${LIMITS.phoneCheckDigits.max}.`);
      }
      next.pickup.phoneCheckDigits = p.phoneCheckDigits;
    }
  }

  if (patch.alerts !== undefined) {
    if (!isRecord(patch.alerts)) throw new SettingsValidationError('« alerts » invalide.');
    if (patch.alerts.lowBalance !== undefined) {
      if (!isRecord(patch.alerts.lowBalance)) throw new SettingsValidationError('Seuils de caisse basse invalides.');
      const current: Record<string, number | null> = { ...(next.alerts?.lowBalance ?? {}) };
      for (const [rawCur, v] of Object.entries(patch.alerts.lowBalance)) {
        const cur = rawCur.toUpperCase();
        if (!CURRENCIES.includes(cur)) throw new SettingsValidationError(`Devise inconnue : « ${rawCur} ».`);
        if (v === null) {
          delete current[cur];
          continue;
        }
        if (!isNum(v) || v < LIMITS.lowBalance.min || v > LIMITS.lowBalance.max) {
          throw new SettingsValidationError(`Seuil ${cur} : montant invalide.`);
        }
        if (!hasAtMostTwoDecimals(v)) throw new SettingsValidationError(`Seuil ${cur} : deux décimales au maximum.`);
        current[cur] = v;
      }
      next.alerts = { lowBalance: current };
    }
  }

  if (patch.recharge !== undefined) {
    if (!isRecord(patch.recharge)) throw new SettingsValidationError('« recharge » invalide.');
    if (patch.recharge.enabledMethods !== undefined) {
      const m = patch.recharge.enabledMethods;
      if (!Array.isArray(m) || !m.every((x) => typeof x === 'string')) {
        throw new SettingsValidationError('« Moyens de recharge » : liste attendue.');
      }
      const methods = [...new Set((m as string[]).map((x) => x.trim().toUpperCase()))];
      const unknown = methods.find((x) => !(RECHARGE_METHODS as readonly string[]).includes(x));
      if (unknown) throw new SettingsValidationError(`Moyen de recharge inconnu : « ${unknown} ».`);
      next.recharge = { enabledMethods: methods };
    }
  }

  if (patch.merchant !== undefined) {
    if (!isRecord(patch.merchant)) throw new SettingsValidationError('« merchant » invalide.');
    const m = patch.merchant;
    const cur: NonNullable<CompanySettingsPatch['merchant']> = { ...(next.merchant ?? {}) };
    if (m.enabled !== undefined) {
      if (typeof m.enabled !== 'boolean') throw new SettingsValidationError('Comptes marchands : ouvert ou fermé.');
      cur.enabled = m.enabled;
    }
    for (const [key, label] of [['paymentFeePct', "Commission d'encaissement"], ['payoutFeePct', 'Commission de retrait']] as const) {
      if (m[key] === undefined) continue;
      const v = m[key];
      if (!isNum(v) || v < LIMITS.merchantFeePct.min || v > LIMITS.merchantFeePct.max) {
        throw new SettingsValidationError(`${label} : entre ${LIMITS.merchantFeePct.min} et ${LIMITS.merchantFeePct.max} %.`);
      }
      if (!hasAtMostTwoDecimals(v)) throw new SettingsValidationError(`${label} : deux décimales au maximum.`);
      cur[key] = v;
    }
    if (m.qrValidityMinutes !== undefined) {
      if (!isIntIn(m.qrValidityMinutes, LIMITS.qrValidityMinutes)) {
        throw new SettingsValidationError(`Validité du QR code : entre ${LIMITS.qrValidityMinutes.min} et ${LIMITS.qrValidityMinutes.max} minutes.`);
      }
      cur.qrValidityMinutes = m.qrValidityMinutes;
    }
    if (m.phoneRequestValidityMinutes !== undefined) {
      if (!isIntIn(m.phoneRequestValidityMinutes, LIMITS.phoneRequestValidityMinutes)) {
        throw new SettingsValidationError(`Validité d'une demande par téléphone : entre ${LIMITS.phoneRequestValidityMinutes.min} et ${LIMITS.phoneRequestValidityMinutes.max} minutes.`);
      }
      cur.phoneRequestValidityMinutes = m.phoneRequestValidityMinutes;
    }
    if (m.payoutCooldownHours !== undefined) {
      if (!isIntIn(m.payoutCooldownHours, LIMITS.payoutCooldownHours)) {
        throw new SettingsValidationError(`Délai de sécurité : entre ${LIMITS.payoutCooldownHours.min} et ${LIMITS.payoutCooldownHours.max} heures.`);
      }
      cur.payoutCooldownHours = m.payoutCooldownHours;
    }
    if (m.payoutMethods !== undefined) {
      if (!Array.isArray(m.payoutMethods) || !m.payoutMethods.every((x) => typeof x === 'string')) {
        throw new SettingsValidationError('« Moyens de retrait » : liste attendue.');
      }
      const methods = [...new Set((m.payoutMethods as string[]).map((x) => x.trim().toUpperCase()))];
      const unknown = methods.find((x) => !(MERCHANT_PAYOUT_METHODS as readonly string[]).includes(x));
      if (unknown) throw new SettingsValidationError(`Moyen de retrait inconnu : « ${unknown} ».`);
      cur.payoutMethods = methods;
    }
    if (m.payoutMode !== undefined) {
      const mode = String(m.payoutMode).trim().toUpperCase();
      if (!(MERCHANT_PAYOUT_MODES as readonly string[]).includes(mode)) throw new SettingsValidationError('Mode de retrait : MANUAL ou SANDBOX.');
      cur.payoutMode = mode;
    }
    for (const [key, label] of [['minPayment', 'Paiement minimum'], ['maxPayment', 'Paiement maximum'], ['minPayout', 'Retrait minimum']] as const) {
      const map = m[key];
      if (map === undefined) continue;
      if (!isRecord(map)) throw new SettingsValidationError(`${label} : valeurs par devise attendues.`);
      const current: Record<string, number | null> = { ...(cur[key] ?? {}) };
      for (const [rawCur, v] of Object.entries(map)) {
        const code = rawCur.toUpperCase();
        if (!CURRENCIES.includes(code)) throw new SettingsValidationError(`Devise inconnue : « ${rawCur} ».`);
        if (v === null) {
          delete current[code];
          continue;
        }
        if (!isNum(v) || v < LIMITS.merchantAmount.min || v > LIMITS.merchantAmount.max) throw new SettingsValidationError(`${label} ${code} : montant invalide.`);
        if (!hasAtMostTwoDecimals(v)) throw new SettingsValidationError(`${label} ${code} : deux décimales au maximum.`);
        current[code] = v;
      }
      cur[key] = current;
    }
    // Cohérence minimum ≤ maximum, sur les valeurs qui seront réellement appliquées.
    const applied = mergeSettings({ merchant: cur }).merchant;
    for (const code of CURRENCIES) {
      if ((applied.minPayment[code] ?? 0) > (applied.maxPayment[code] ?? Infinity)) {
        throw new SettingsValidationError(`${code} : le paiement minimum dépasse le paiement maximum.`);
      }
    }
    next.merchant = cur;
  }

  if (patch.refunds !== undefined) {
    if (!isRecord(patch.refunds)) throw new SettingsValidationError('« refunds » invalide.');
    const r = patch.refunds;
    const cur: NonNullable<CompanySettingsPatch['refunds']> = { ...(next.refunds ?? {}) };
    if (r.returnMerchantCommission !== undefined) {
      if (typeof r.returnMerchantCommission !== 'boolean') throw new SettingsValidationError('Commission marchand rendue : oui ou non.');
      cur.returnMerchantCommission = r.returnMerchantCommission;
    }
    if (r.returnFeesOnRecall !== undefined) {
      if (typeof r.returnFeesOnRecall !== 'boolean') throw new SettingsValidationError('Frais rendus lors d\'un rappel : oui ou non.');
      cur.returnFeesOnRecall = r.returnFeesOnRecall;
    }
    if (r.recallWindowDays !== undefined) {
      if (!isIntIn(r.recallWindowDays, LIMITS.recallWindowDays)) {
        throw new SettingsValidationError(`Délai de rappel : entre ${LIMITS.recallWindowDays.min} et ${LIMITS.recallWindowDays.max} jours (0 = rappel fermé).`);
      }
      cur.recallWindowDays = r.recallWindowDays;
    }
    next.refunds = cur;
  }

  return next;
}

/** Est-ce que ce moyen de recharge est ouvert pour cette société ? */
export function isRechargeEnabled(settings: CompanySettings, method: string): boolean {
  return settings.recharge.enabledMethods.includes(String(method ?? '').toUpperCase());
}

/** Est-ce que ce mode d'envoi est gratuit pour cette société ? */
export function isFreeMethod(settings: CompanySettings, method: string): boolean {
  return settings.fees.freeMethods.includes(String(method ?? '').toUpperCase());
}
