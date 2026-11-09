// apps/backend/src/transactions/recall-rules.ts
// =========================================================
// RAPPEL D'UN ENVOI WALLET → WALLET v1.0 — fonctions pures, testées sans base de données.
//
// Un envoi vers un portefeuille est crédité tout de suite (statut PAID) : l'annulation classique ne s'applique pas. Le service client
// peut cependant le RAPPELER (erreur de destinataire, fraude…) selon la même règle des quatre yeux que les remboursements :
//   • seul un envoi (TRANSFER / SCHEDULED) payé sur un PORTEFEUILLE (WALLET / MOBILE_MONEY) se rappelle ; un envoi cash retiré en agence
//     est sorti du circuit (traité hors plateforme) ;
//   • dans le délai réglé par la société (Réglages › Remboursements, 30 jours par défaut ; 0 = rappel fermé) ;
//   • le rappel reprend la somme créditée au destinataire (il doit encore l'avoir : sinon 409, dossier hors plateforme) et la rend à
//     l'expéditeur ; les frais sont rendus ou non selon le réglage de la société.
// =========================================================

export const RECALLABLE_TYPES = ['TRANSFER', 'SCHEDULED'];
export const RECALLABLE_METHODS = ['WALLET', 'MOBILE_MONEY'];
const DAY_MS = 86_400_000;

export interface RecallCandidate {
  type: string;
  status: string;
  payoutMethod: string | null;
  recipientId?: string | null;
  paidAt?: Date | string | null;
  createdAt: Date | string;
  amount: unknown;
  fees: unknown;
  total: unknown;
}

export type RecallAssessment = { ok: true; refundAmount: number; refundsFees: boolean } | { ok: false; reason: string };

export function assessRecall(
  tx: RecallCandidate,
  opts: { windowDays: number; returnFees: boolean; now?: Date },
): RecallAssessment {
  if (!RECALLABLE_TYPES.includes(String(tx.type))) {
    return { ok: false, reason: "Ce type d'opération ne se rembourse pas depuis la plateforme." };
  }
  if (tx.status !== 'PAID') {
    return { ok: false, reason: `Cette opération est déjà « ${tx.status} » : rien à rappeler.` };
  }
  if (!RECALLABLE_METHODS.includes(String(tx.payoutMethod)) || !tx.recipientId) {
    return { ok: false, reason: "Le bénéficiaire a déjà retiré l'argent : ce remboursement doit être traité hors plateforme." };
  }
  if (!(opts.windowDays > 0)) {
    return { ok: false, reason: "Le rappel d'un envoi vers un portefeuille est fermé pour cette société (Réglages › Remboursements)." };
  }
  const paid = new Date(tx.paidAt ?? tx.createdAt).getTime();
  const now = (opts.now ?? new Date()).getTime();
  if (now - paid > opts.windowDays * DAY_MS) {
    return { ok: false, reason: `Le délai de rappel (${opts.windowDays} jours) est dépassé : ce dossier se traite hors plateforme.` };
  }
  const refundAmount = Number(opts.returnFees ? tx.total : tx.amount);
  return { ok: true, refundAmount, refundsFees: opts.returnFees };
}
