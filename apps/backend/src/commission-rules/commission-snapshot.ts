// apps/backend/src/commission-rules/commission-snapshot.ts
// =========================================================
// COMMISSION SNAPSHOT v1 — la répartition des frais d'un envoi cash est FIGÉE à l'envoi.
//
// Pourquoi : un code de retrait reste payable jusqu'à 5 mois. Si l'administrateur modifie les règles de répartition entre
// l'envoi et le paiement, le client avait pourtant été facturé (et l'agence d'envoi informée) selon l'ancienne règle.
// Le snapshot garde les parts qui s'appliquaient à l'instant de l'envoi ; au paiement, on les relit sans les recalculer.
//
// Ce qui est connu à l'envoi : le type de l'agence d'envoi (sourceType). Ce qui ne l'est pas : l'agence qui paiera (destType).
// On enregistre donc les parts pour CHAQUE type d'agence payeuse possible.
//
// Fonctions pures : aucune dépendance base de données, testées dans commission-snapshot.spec.ts.
// =========================================================

import type { DestType, Shares, SourceType } from './commission-rule-defaults';
import { DEST_TYPES, SOURCE_TYPES } from './commission-rule-defaults';

export const COMMISSION_SNAPSHOT_VERSION = 1;

export interface CommissionSnapshot {
  v: typeof COMMISSION_SNAPSHOT_VERSION;
  /** Type d'agence d'envoi à l'instant de l'envoi (WALLET = client sans agence). */
  source: SourceType;
  /** Parts (en %) selon le type de l'agence qui paiera. */
  shares: Record<DestType, Shares>;
  frozenAt: string;
}

export interface RuleLike {
  destType: string;
  payerShare: number;
  senderShare: number;
  platformShare: number;
}

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100;

const validShares = (s: unknown): s is Shares => {
  if (!s || typeof s !== 'object') return false;
  const x = s as Record<string, unknown>;
  return isNum(x.payerShare) && isNum(x.senderShare) && isNum(x.platformShare);
};

/**
 * Construit le snapshot : pour chaque type d'agence payeuse, la règle de l'administrateur si elle existe pour ce couple
 * (source → dest), sinon la répartition par défaut réglée par la société.
 * `rules` = les lignes CommissionConfig de CE sourceType (déjà filtrées : clientId, payoutMethod null, plus récentes d'abord).
 */
export function buildCommissionSnapshot(input: { source: SourceType; rules: RuleLike[]; fallback: Shares; now?: Date }): CommissionSnapshot {
  const pick = (dest: DestType): Shares => {
    const r = input.rules.find((x) => x.destType === dest); // la première = la plus récente (tri fait par l'appelant)
    return r
      ? { payerShare: r.payerShare, senderShare: r.senderShare, platformShare: r.platformShare }
      : { payerShare: input.fallback.payerShare, senderShare: input.fallback.senderShare, platformShare: input.fallback.platformShare };
  };
  return {
    v: COMMISSION_SNAPSHOT_VERSION,
    source: input.source,
    shares: { SUBSIDIARY: pick('SUBSIDIARY'), PARTNER: pick('PARTNER') },
    frozenAt: (input.now ?? new Date()).toISOString(),
  };
}

/** Relit un snapshot stocké (JSON libre en base). `null` si absent, d'une autre version ou abîmé : l'appelant retombe alors sur les règles actuelles. */
export function parseCommissionSnapshot(raw: unknown): CommissionSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, any>;
  if (r.v !== COMMISSION_SNAPSHOT_VERSION) return null;
  if (!SOURCE_TYPES.includes(r.source)) return null;
  if (!r.shares || !DEST_TYPES.every((d) => validShares(r.shares[d]))) return null;
  return r as CommissionSnapshot;
}

/**
 * Parts à appliquer au paiement. `sourceNow` = type d'agence d'envoi déduit au paiement (agence enregistrée sur l'envoi) ;
 * si le snapshot a été pris pour un autre type d'envoi (donnée incohérente), on ne s'en sert pas.
 */
export function sharesFromSnapshot(raw: unknown, sourceNow: SourceType, dest: DestType): Shares | null {
  const snap = parseCommissionSnapshot(raw);
  if (!snap || snap.source !== sourceNow) return null;
  const s = snap.shares[dest];
  return { payerShare: s.payerShare, senderShare: s.senderShare, platformShare: s.platformShare };
}
