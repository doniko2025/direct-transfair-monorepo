// apps/direct-transfair-mobile/utils/trackingSteps.ts
// =========================================================
// CHRONOLOGIE DU SUIVI (lot 19) — mêmes étapes que le suivi public du reçu (backend transactions/transfer-tracking.ts), avec des libellés
// courts pour tenir sur une ligne :
//   Envoi cash       : Enregistré → Validé → À retirer → Payé
//   Mobile / banque  : Enregistré → Validé → En cours → Versé
//   Wallet → wallet  : Enregistré → Reçu
// Un échec (annulé, échoué, expiré, remboursé) remplace l'étape où l'envoi s'est arrêté ; la suite reste grisée.
// Fonction pure : aucune dépendance à l'écran.
// =========================================================

import { tr } from "../i18n/runtime";
import type { MessageKey } from "../i18n/catalog";

export type StepState = "done" | "current" | "todo" | "failed";
export interface TrackStep { key: string; label: string; state: StepState }
export interface Tracking { steps: TrackStep[]; hint: string; final: boolean }

type Kind = "CASH" | "WALLET" | "OUT"; // OUT = mobile money / banque

export const FINAL_STATUSES = ["PAID", "CANCELLED", "FAILED", "EXPIRED", "REFUNDED"];
const FAILURES = ["CANCELLED", "FAILED", "EXPIRED", "REFUNDED"];

function kindOf(type: string, payoutMethod: string): Kind | null {
  if (type !== "TRANSFER" && type !== "SCHEDULED") return null;
  if (payoutMethod === "WALLET") return "WALLET";
  if (payoutMethod === "MOBILE_MONEY" || payoutMethod === "BANK_DEPOSIT" || payoutMethod === "IBAN_TRANSFER") return "OUT";
  return "CASH";
}

export interface TrackingTx {
  type?: string; payoutMethod?: string; status?: string; validatedAt?: string | null;
}

/** Étapes + phrase d'état, ou null quand le suivi n'a pas de sens (dépôt, recharge, paiement…). */
export function buildTracking(tx: TrackingTx, recipientFirstName: string): Tracking | null {
  const kind = kindOf(String(tx.type ?? "").toUpperCase(), String(tx.payoutMethod ?? "").toUpperCase());
  if (!kind) return null;
  const status = String(tx.status ?? "PENDING").toUpperCase();

  const labels: MessageKey[] =
    kind === "WALLET" ? ["trk.s.sent", "trk.s.received"]
    : kind === "CASH" ? ["trk.s.sent", "trk.s.validated", "trk.s.ready", "trk.s.paid"]
    : ["trk.s.sent", "trk.s.validated", "trk.s.processing", "trk.s.sentOut"];
  const last = labels.length - 1;
  const failed = FAILURES.includes(status);

  // Où l'envoi en est (ou s'est arrêté, pour un échec : on le déduit de la validation, le statut seul ne le dit plus).
  const stoppedAt = kind === "WALLET" ? 0 : tx.validatedAt ? (kind === "CASH" ? 2 : 1) : 0;
  const position = (() => {
    if (kind === "WALLET") return status === "PAID" ? 1 : 0;
    switch (status) {
      case "VALIDATED": return kind === "CASH" ? 2 : 1;
      case "PROCESSING": return 2;
      case "PAID": return 3;
      default: return 0;
    }
  })();
  const pos = Math.min(failed ? stoppedAt : position, last);
  const done = status === "PAID";

  const steps: TrackStep[] = labels.map((key, i) => ({
    key: String(i),
    label: tr(key),
    state: done ? "done" : i < pos ? "done" : i === pos ? "current" : "todo",
  }));
  if (failed) {
    steps[pos] = { key: String(pos), label: tr(`trk.f.${status}` as MessageKey), state: "failed" };
    for (let i = pos + 1; i <= last; i++) steps[i] = { ...steps[i]!, state: "todo" };
  }

  const name = recipientFirstName || "—";
  const hint = failed
    ? tr(`trk.h.${status}` as MessageKey)
    : done
      ? tr(kind === "WALLET" ? "trk.h.received" : "trk.h.paid", { name })
      : status === "PROCESSING" || (kind === "OUT" && status === "VALIDATED")
        ? tr("trk.h.processing")
        : status === "VALIDATED" && kind === "CASH"
          ? tr("trk.h.ready", { name })
          : tr("trk.h.pending");
  return { steps, hint, final: FINAL_STATUSES.includes(status) };
}
