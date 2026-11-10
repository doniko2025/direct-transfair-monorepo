// apps/direct-transfair-mobile/utils/motifs.ts
// Motifs d'un transfert. `value` est le texte FRANÇAIS envoyé au serveur (champ « note » de la transaction, relu par les
// reçus et l'historique) : il ne change jamais avec la langue. Seul l'affichage est traduit (`motifLabel`).
import { tr } from "../i18n/runtime";
import type { MessageKey } from "../i18n/catalog";

export const MOTIFS: ReadonlyArray<{ icon: string; value: string; key: MessageKey }> = [
  { icon: "👨‍👩‍👧", value: "Assistance familiale",       key: "motif.family" },
  { icon: "🪙",    value: "Épargne / Investissements",  key: "motif.savings" },
  { icon: "💗",    value: "Oeuvre caritative / Don",    key: "motif.charity" },
  { icon: "🛒",    value: "Paiement de marchandises",   key: "motif.goods" },
  { icon: "✈️",    value: "Frais de voyage",            key: "motif.travel" },
  { icon: "📚",    value: "Frais scolaires",            key: "motif.school" },
  { icon: "🏠",    value: "Loyer / Hypothèque",         key: "motif.rent" },
  { icon: "🏥",    value: "Assistance médicale",        key: "motif.medical" },
  { icon: "💳",    value: "Paiement de taxes",          key: "motif.taxes" },
];

/** Motif stocké (français) → texte dans la langue courante ; un texte libre ou inconnu est rendu tel quel. */
export function motifLabel(value?: string | null): string {
  if (!value) return "";
  const m = MOTIFS.find((x) => x.value === value);
  return m ? tr(m.key) : value;
}
