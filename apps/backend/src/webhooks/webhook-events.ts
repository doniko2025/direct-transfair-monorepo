// apps/backend/src/webhooks/webhook-events.ts
// =========================================================
// ÉVÉNEMENTS DES WEBHOOKS (lot 17) — fonctions pures.
// Les événements « transaction.* » sont déduits du statut courant d'une transaction (relève périodique, voir webhooks.worker.ts) :
// aucun des nombreux points du code qui changent un statut n'a besoin d'être modifié, et un envoi n'est jamais retardé par un webhook.
// ⚠️ ON_HOLD (blocage par la conformité) n'émet RIEN : un blocage ne doit jamais être divulgué à un tiers.
// =========================================================

export const WEBHOOK_EVENTS = [
  { name: 'transaction.created',    label: 'Envoi créé (en attente)' },
  { name: 'transaction.validated',  label: 'Envoi validé' },
  { name: 'transaction.processing', label: 'Envoi en cours de traitement' },
  { name: 'transaction.paid',       label: 'Envoi payé' },
  { name: 'transaction.cancelled',  label: 'Envoi annulé' },
  { name: 'transaction.failed',     label: 'Envoi en échec' },
  { name: 'transaction.expired',    label: 'Code de retrait expiré' },
  { name: 'transaction.refunded',   label: 'Envoi remboursé' },
] as const;

export type WebhookEventName = (typeof WEBHOOK_EVENTS)[number]['name'];
export const WEBHOOK_EVENT_NAMES: string[] = WEBHOOK_EVENTS.map((e) => e.name);
export const PING_EVENT = 'ping';

const BY_STATUS: Record<string, WebhookEventName | undefined> = {
  PENDING: 'transaction.created',
  VALIDATED: 'transaction.validated',
  PROCESSING: 'transaction.processing',
  PAID: 'transaction.paid',
  CANCELLED: 'transaction.cancelled',
  FAILED: 'transaction.failed',
  EXPIRED: 'transaction.expired',
  REFUNDED: 'transaction.refunded',
  // ON_HOLD : volontairement absent.
};

export function eventForStatus(status: string): WebhookEventName | null {
  return BY_STATUS[status] ?? null;
}

/** Clé d'unicité d'un changement d'état pour un point de réception : jamais deux envois du même état. */
export function eventKeyFor(transactionId: string, status: string): string {
  return `transaction:${transactionId}:${status}`;
}

/** Un point de réception qui ne liste aucun événement les reçoit tous. */
export function isSubscribed(subscribed: string[], event: string): boolean {
  return subscribed.length === 0 || subscribed.includes(event) || subscribed.includes('*');
}

export interface TxLike {
  id: string; reference: string; type: unknown; status: unknown;
  amount: unknown; fees: unknown; total: unknown; currency: unknown; targetCurrency?: unknown; receivedAmount?: unknown;
  payoutMethod?: unknown; createdAt: Date; paidAt?: Date | null; cancelledAt?: Date | null; updatedAt: Date;
}

/** Contenu minimal : aucune donnée personnelle (ni nom, ni téléphone) ; le destinataire interroge notre API s'il lui en faut plus. */
export function buildTransactionPayload(event: string, tx: TxLike, now: Date = new Date()) {
  return {
    event,
    createdAt: now.toISOString(),
    data: {
      id: tx.id,
      reference: tx.reference,
      type: String(tx.type),
      status: String(tx.status),
      amount: Number(tx.amount),
      fees: Number(tx.fees),
      total: Number(tx.total),
      currency: String(tx.currency),
      targetCurrency: tx.targetCurrency ? String(tx.targetCurrency) : null,
      receivedAmount: tx.receivedAmount === null || tx.receivedAmount === undefined ? null : Number(tx.receivedAmount),
      payoutMethod: tx.payoutMethod ? String(tx.payoutMethod) : null,
      createdAt: tx.createdAt.toISOString(),
      paidAt: tx.paidAt ? tx.paidAt.toISOString() : null,
      cancelledAt: tx.cancelledAt ? tx.cancelledAt.toISOString() : null,
    },
  };
}
