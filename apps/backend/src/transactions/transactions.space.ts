// apps/backend/src/transactions/transactions.space.ts
// Comptes séparés : filtre « compte client » / « compte marchand » de l'historique d'un utilisateur (GET /transactions?space=…).
//   • merchant = paiements encaissés (MERCHANT_PAYMENT dont il est le destinataire) + retraits du commerce (MERCHANT_PAYOUT dont il est l'expéditeur)
//                + remboursements faits à ses clients (MERCHANT_REFUND dont il est l'expéditeur) ;
//   • client   = tout le reste : ses envois, recharges, ses propres paiements chez d'autres marchands, et les remboursements qu'on lui fait.
// Sans `space` (ou valeur inconnue) : aucun filtre, comportement d'origine (portail, anciennes versions de l'application).

import type { Prisma } from '@prisma/client';

export type TransactionSpace = 'client' | 'merchant';

export const parseSpace = (v: unknown): TransactionSpace | undefined => (v === 'merchant' || v === 'client' ? v : undefined);

export function merchantSideWhere(userId: string): Prisma.TransactionWhereInput {
  return {
    OR: [
      { type: 'MERCHANT_PAYMENT', recipientId: userId },
      { type: 'MERCHANT_PAYOUT', senderId: userId },
      { type: 'MERCHANT_REFUND', senderId: userId },
    ],
  };
}

/** Condition à ajouter (AND) au filtre de base, ou null quand aucun filtrage par compte n'est demandé. */
export function spaceWhere(space: TransactionSpace | undefined, userId: string): Prisma.TransactionWhereInput | null {
  if (!space) return null;
  const merchantSide = merchantSideWhere(userId);
  return space === 'merchant' ? merchantSide : { NOT: merchantSide };
}
