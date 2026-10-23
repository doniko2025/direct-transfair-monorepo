// apps/backend/src/transactions/pickup-rules.ts
// =========================================================
// RÈGLES DES CODES DE RETRAIT v1.0 — Direct Transf'air
//
// 1. EXPIRATION : un code de retrait non utilisé expire après PICKUP_CODE_VALIDITY_MONTHS mois (5 par défaut). Passé ce
//    délai l'envoi est annulé (statut EXPIRED) et l'expéditeur remboursé (PickupExpiryService, cron quotidien). Un code
//    expiré n'est plus vérifiable ni payable, même avant le passage du cron.
// 2. PAYS DE PAIEMENT : un code ne se paie que dans le pays de destination de l'envoi (Transaction.receiveCountry, ISO-2).
//    Un code envoyé en Côte d'Ivoire ne se paie qu'en Côte d'Ivoire ; un code envoyé en Guinée (GNF) ne se paie ni au
//    Sénégal (XOF) ni ailleurs. Le contrôle compare le PAYS de l'agence qui paie (pas seulement sa devise : le XOF est
//    partagé par huit pays).
// Fonctions pures : testées sans base de données.
// =========================================================

import { ForbiddenException } from '@nestjs/common';
import { FEE_COUNTRIES, toIso2 } from '../fee-schedule/countries';

/** Durée de validité d'un code de retrait, en mois (PICKUP_CODE_VALIDITY_MONTHS, 5 par défaut). */
export function pickupValidityMonths(): number {
  const raw = Number(process.env.PICKUP_CODE_VALIDITY_MONTHS);
  return Number.isInteger(raw) && raw >= 1 && raw <= 36 ? raw : 5;
}

/** Ajoute des mois sans déborder (31 août + 6 mois → 28/29 février, pas le 3 mars). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

/** Date d'expiration d'un code créé à `from`. */
export function pickupExpiryFrom(from: Date = new Date()): Date {
  return addMonths(from, pickupValidityMonths());
}

/**
 * Le code est-il expiré ? Pour les envois antérieurs à cette règle (pickupExpiry absent), l'échéance se calcule depuis
 * la date de création.
 */
export function isPickupExpired(
  tx: { pickupExpiry?: Date | null; createdAt: Date },
  now: Date = new Date(),
): boolean {
  const expiry = tx.pickupExpiry ?? pickupExpiryFrom(tx.createdAt);
  return expiry.getTime() <= now.getTime();
}

/** Nom lisible d'un pays à partir de son code ISO-2 (le code lui-même s'il est inconnu). */
export function countryName(iso: string | null | undefined): string {
  if (!iso) return 'inconnu';
  return FEE_COUNTRIES[iso] ?? iso;
}

/** Pays de destination d'un envoi : celui stocké à la création, sinon celui de son bénéficiaire (anciens envois). */
export function destinationCountryOf(tx: {
  receiveCountry?: string | null;
  beneficiary?: { country?: string | null } | null;
}): string | null {
  return toIso2(tx.receiveCountry ?? null) ?? toIso2(tx.beneficiary?.country ?? null);
}

/**
 * Refuse le paiement d'un code dans un autre pays que celui de destination.
 *   - pays de destination connu : l'agence doit avoir exactement ce pays ; une agence sans pays renseigné est refusée
 *     (on ne devine pas) ;
 *   - pays de destination inconnu (anciens envois) : repli sur la devise — la devise de l'agence doit être celle du paiement.
 */
export function assertPayableInCountry(params: {
  destinationCountry: string | null;
  payerCountry: string | null;
  payoutCurrency: string;
  payerCurrency: string | null;
}): void {
  const { destinationCountry, payerCountry, payoutCurrency, payerCurrency } = params;

  if (destinationCountry) {
    if (!payerCountry) {
      throw new ForbiddenException(
        `Ce code doit être payé en ${countryName(destinationCountry)}. Le pays de votre agence n'est pas renseigné : ` +
        `demandez à l'administrateur de le définir avant tout paiement.`,
      );
    }
    if (payerCountry !== destinationCountry) {
      throw new ForbiddenException(
        `Ce code ne peut pas être payé ici. Pays de destination du transfert : ${countryName(destinationCountry)}. ` +
        `Pays de votre agence : ${countryName(payerCountry)}. Le bénéficiaire doit se présenter dans une agence en ` +
        `${countryName(destinationCountry)}.`,
      );
    }
    return;
  }

  if (payerCurrency && payerCurrency !== payoutCurrency) {
    throw new ForbiddenException(
      `Ce code doit être payé en ${payoutCurrency}. Votre agence travaille en ${payerCurrency} : ` +
      `le bénéficiaire doit se présenter dans une agence du pays de destination.`,
    );
  }
}
