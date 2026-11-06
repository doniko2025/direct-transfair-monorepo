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
}

// ─── Bornes ─────────────────────────────────────────────

export const LIMITS = {
  validityMonths: { min: 1, max: 36 },
  maxFailedChecks: { min: 1, max: 50 },
  lockMinutes: { min: 1, max: 1440 },
  phoneCheckDigits: { min: 3, max: 8 },
  lowBalance: { min: 0, max: 1_000_000_000_000 },
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
