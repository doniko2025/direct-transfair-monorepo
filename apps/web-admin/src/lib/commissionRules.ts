// src/lib/commissionRules.ts
// Commissions gagnées : périodes, libellés et regroupements d'affichage.

import type { CommissionPeriod, CurrencyTotal } from '@direct-transfair/shared';
import { money } from './feeScheduleRules';

export const PERIODS: readonly { id: CommissionPeriod; label: string; phrase: string }[] = [
  { id: 'day', label: 'Aujourd’hui', phrase: 'aujourd’hui' },
  { id: 'week', label: 'Cette semaine', phrase: 'cette semaine' },
  { id: 'month', label: 'Ce mois', phrase: 'ce mois-ci' },
  { id: 'quarter', label: 'Ce trimestre', phrase: 'ce trimestre' },
  { id: 'year', label: 'Cette année', phrase: 'cette année' },
  { id: 'all', label: 'Depuis le début', phrase: 'depuis le début' },
];

export function periodPhrase(id: CommissionPeriod): string {
  return PERIODS.find((p) => p.id === id)?.phrase ?? '';
}

/** Totaux triés par montant décroissant (la devise principale d'abord). */
export function sortTotals(totals: readonly CurrencyTotal[]): CurrencyTotal[] {
  return [...totals].sort((a, b) => b.total - a.total || a.currency.localeCompare(b.currency));
}

export function totalsLine(totals: readonly CurrencyTotal[]): string {
  if (totals.length === 0) return 'Rien';
  return sortTotals(totals)
    .map((t) => money(t.total, t.currency))
    .join(' · ');
}

/** Suffixe « (3 commissions) ». */
export function countLabel(n: number): string {
  if (n === 0) return 'Aucune commission';
  return n === 1 ? '1 commission' : `${n} commissions`;
}

/** Retire le préfixe « Commission » du libellé enregistré par le serveur, sans toucher au reste. */
export function entryTitle(description: string | null): string {
  const d = (description ?? '').trim();
  if (!d) return 'Commission';
  return d;
}
