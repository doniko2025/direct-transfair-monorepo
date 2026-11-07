// apps/direct-transfair-mobile/services/accountSpace.ts
// =========================================================
// COMPTES SÉPARÉS — à quel compte (client / marchand) appartient une opération ?
// Même règle que le serveur (apps/backend/src/transactions/transactions.service.ts › findForUser) :
//   • compte MARCHAND = paiements encaissés (MERCHANT_PAYMENT dont on est le destinataire) + retraits du commerce (MERCHANT_PAYOUT dont on est l'expéditeur) ;
//   • compte CLIENT   = tout le reste (envois, réceptions, recharges, et ses propres paiements chez d'autres marchands).
// Le serveur filtre déjà (?space=…). Ce second filtrage, fait sur l'appareil, garantit la séparation même si la réponse vient d'une
// ancienne version du serveur qui ignore ce paramètre : un écran ne montre JAMAIS les opérations de l'autre compte.
// =========================================================

import type { AccountSpace } from "../hooks/useAccountSpace";

type TxLike = { type?: unknown; senderId?: unknown; recipientId?: unknown };

export function isMerchantSide(tx: TxLike, userId: string): boolean {
  const type = String(tx?.type ?? "").toUpperCase();
  if (type === "MERCHANT_PAYMENT") return tx?.recipientId === userId;
  if (type === "MERCHANT_PAYOUT") return tx?.senderId === userId;
  return false;
}

export function belongsToSpace(tx: TxLike, space: AccountSpace, userId: string | null | undefined): boolean {
  if (!userId) return true; // sans identité on ne peut pas trancher : le filtrage du serveur fait foi
  return space === "merchant" ? isMerchantSide(tx, userId) : !isMerchantSide(tx, userId);
}

export function filterBySpace<T extends TxLike>(list: readonly T[], space: AccountSpace, userId: string | null | undefined): T[] {
  return list.filter((tx) => belongsToSpace(tx, space, userId));
}
