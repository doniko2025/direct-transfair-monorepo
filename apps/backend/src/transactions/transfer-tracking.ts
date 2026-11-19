// apps/backend/src/transactions/transfer-tracking.ts
// =========================================================
// SUIVI D'UN TRANSFERT (lot 16) — frise d'étapes affichée sur la page publique ouverte par le QR / le lien du reçu.
// Fonctions pures, testées sans serveur (transfer-tracking.spec.ts). Aucune donnée personnelle : seulement des étapes et des dates.
//   Envoi cash       : Envoi enregistré → Validé → Disponible à retirer → Payé au bénéficiaire
//   Mobile / banque  : Envoi enregistré → Validé → En cours de versement → Versé
//   Wallet → wallet  : Envoi enregistré → Reçu par le bénéficiaire
// Un échec (annulé, échoué, expiré, remboursé) remplace l'étape en cours par une étape « failed » et fige la suite.
// =========================================================

import type { ReceiptKind } from './transfer-receipt';

export type StepState = 'done' | 'current' | 'todo' | 'failed';

export interface TrackingStep {
  key: string;
  label: string;
  state: StepState;
  /** Date ISO de l'étape quand elle est connue. */
  at: string | null;
}

export interface TrackingInput {
  kind: ReceiptKind;
  status: string;
  createdAt: Date;
  validatedAt?: Date | null;
  paidAt?: Date | null;
  cancelledAt?: Date | null;
  failedAt?: Date | null;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** Étape où l'on se trouve (index) : 0 = enregistré … dernière = terminé. -1 si le suivi n'a pas de sens (dépôt, retrait…). */
function position(kind: ReceiptKind, status: string): number {
  if (kind === 'WALLET_TRANSFER') return status === 'PAID' ? 1 : 0;
  switch (status) {
    case 'PENDING':
    case 'ON_HOLD': return 0;
    case 'VALIDATED': return kind === 'CASH_TRANSFER' ? 2 : 1;
    case 'PROCESSING': return 2;
    case 'PAID': return 3;
    default: return 0;
  }
}

const FAILURE_LABEL: Record<string, string> = {
  CANCELLED: 'Envoi annulé',
  FAILED: 'Envoi échoué',
  EXPIRED: 'Code expiré',
  REFUNDED: "Remboursé à l'expéditeur",
};

export function buildTrackingSteps(t: TrackingInput): TrackingStep[] {
  if (t.kind === 'DEPOSIT' || t.kind === 'WITHDRAWAL' || t.kind === 'OTHER') return [];

  const labels =
    t.kind === 'WALLET_TRANSFER'
      ? ['Envoi enregistré', 'Reçu par le bénéficiaire']
      : t.kind === 'CASH_TRANSFER'
        ? ['Envoi enregistré', 'Validé', 'Disponible à retirer', 'Payé au bénéficiaire']
        : ['Envoi enregistré', 'Validé', 'En cours de versement', 'Versé au bénéficiaire'];

  const dates: (Date | null | undefined)[] =
    t.kind === 'WALLET_TRANSFER' ? [t.createdAt, t.paidAt] : t.kind === 'CASH_TRANSFER' ? [t.createdAt, t.validatedAt, t.validatedAt, t.paidAt] : [t.createdAt, t.validatedAt, null, t.paidAt];

  const last = labels.length - 1;
  const failure = FAILURE_LABEL[t.status];
  // Un échec survient à l'étape où l'envoi s'était arrêté : on la déduit des dates (le statut seul ne le dit plus).
  const stoppedAt = t.kind === 'WALLET_TRANSFER' ? 0 : t.validatedAt ? (t.kind === 'CASH_TRANSFER' ? 2 : 1) : 0;
  const pos = Math.min(failure ? stoppedAt : position(t.kind, t.status), last);
  const done = t.status === 'PAID';

  const steps: TrackingStep[] = labels.map((label, i) => {
    let state: StepState = i < pos ? 'done' : i === pos ? 'current' : 'todo';
    if (done) state = 'done';
    if (state === 'done' && i === 0) return { key: String(i), label, state, at: iso(t.createdAt) };
    return { key: String(i), label, state, at: state === 'todo' ? null : iso(dates[i]) };
  });

  if (failure) {
    // L'étape en cours devient l'échec ; les suivantes restent à faire (grisées).
    const failedAt = t.status === 'CANCELLED' ? t.cancelledAt : t.failedAt;
    const idx = Math.min(pos, last);
    steps[idx] = { key: String(idx), label: failure, state: 'failed', at: iso(failedAt) ?? iso(t.createdAt) };
    for (let i = idx + 1; i <= last; i++) steps[i] = { ...steps[i]!, state: 'todo', at: null };
  }
  return steps;
}

/** Vrai quand le suivi n'évoluera plus (la page cesse alors de se rafraîchir). */
export function isFinalStatus(status: string): boolean {
  return ['PAID', 'CANCELLED', 'FAILED', 'EXPIRED', 'REFUNDED'].includes(status);
}
