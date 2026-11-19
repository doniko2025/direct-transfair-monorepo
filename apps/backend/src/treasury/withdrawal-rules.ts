// apps/backend/src/treasury/withdrawal-rules.ts
// =========================================================
// RÈGLES DE LA DOUBLE VALIDATION (audit argent I4) — pures, testées à part.
//   • la demande est faite par un COMPANY_ADMIN de la société ;
//   • elle est approuvée ou refusée par UN AUTRE administrateur de la même société, ou par le SUPER_ADMIN ;
//   • le demandeur peut seulement l'annuler ;
//   • une demande non traitée expire (48 h) : un retrait oublié ne doit pas pouvoir être validé des semaines plus tard.
// =========================================================

export const WITHDRAWAL_TTL_HOURS = 48;

export type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';

export interface Actor { id: string; role?: string; clientId?: number }
export interface RequestView { clientId: number; requestedBy: string; status: string; expiresAt: Date }

export type DenyReason = 'FOREIGN_COMPANY' | 'OWN_REQUEST' | 'NOT_PENDING' | 'EXPIRED' | 'ROLE';

export function expiryFrom(now: Date, hours = WITHDRAWAL_TTL_HOURS): Date {
  return new Date(now.getTime() + hours * 3_600_000);
}

/** Qui peut approuver / refuser ? null = autorisé. */
export function whyCannotDecide(actor: Actor, r: RequestView, now = new Date()): DenyReason | null {
  const isSuper = actor.role === 'SUPER_ADMIN';
  if (!isSuper && actor.role !== 'COMPANY_ADMIN') return 'ROLE';
  if (!isSuper && actor.clientId !== r.clientId) return 'FOREIGN_COMPANY';
  if (r.requestedBy === actor.id) return 'OWN_REQUEST';
  if (r.status !== 'PENDING') return 'NOT_PENDING';
  if (r.expiresAt.getTime() <= now.getTime()) return 'EXPIRED';
  return null;
}

/** Qui peut annuler ? Seulement le demandeur, tant que la demande attend. */
export function whyCannotCancel(actor: Actor, r: RequestView): DenyReason | null {
  if (actor.role !== 'COMPANY_ADMIN' && actor.role !== 'SUPER_ADMIN') return 'ROLE';
  if (r.requestedBy !== actor.id) return 'ROLE';
  if (r.status !== 'PENDING') return 'NOT_PENDING';
  return null;
}

export const DENY_MESSAGE: Record<DenyReason, string> = {
  FOREIGN_COMPANY: 'Demande introuvable.',
  OWN_REQUEST: 'Vous ne pouvez pas valider votre propre demande : un autre administrateur doit le faire.',
  NOT_PENDING: 'Cette demande a déjà été traitée.',
  EXPIRED: 'Cette demande a expiré. Faites-en une nouvelle.',
  ROLE: 'Action non autorisée.',
};
