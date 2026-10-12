// src/lib/walletClientRules.ts
// Règles d'affichage des clients wallet (comptes de rôle USER) et des mouvements de caisse des agences.

import type { Transaction, UserSummary } from '@direct-transfair/shared';
import { formatAmount } from './companyRules';
import { accountState } from './userRules';

export type ClientTab = 'all' | 'active' | 'blocked' | 'review';

export const CLIENT_TABS: readonly { id: ClientTab; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'active', label: 'Actifs' },
  { id: 'blocked', label: 'Suspendus ou désactivés' },
  { id: 'review', label: 'À vérifier' },
];

/** Un client est « à vérifier » quand sa conformité n'est pas au vert. */
export function needsReview(u: Pick<UserSummary, 'complianceStatus'>): boolean {
  return u.complianceStatus === 'REVIEW' || u.complianceStatus === 'BLOCKED';
}

export function inTab(u: UserSummary, tab: ClientTab): boolean {
  switch (tab) {
    case 'active':
      return accountState(u) === 'active';
    case 'blocked':
      return accountState(u) !== 'active';
    case 'review':
      return needsReview(u);
    default:
      return true;
  }
}

export function clientMatches(u: UserSummary, q: string): boolean {
  if (!q) return true;
  const hay = [u.firstName, u.lastName, u.email, u.phone, u.city, u.country].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q);
}

/** Fonds détenus par les clients, par devise, du plus gros total au plus petit. */
export function heldFunds(clients: readonly UserSummary[]): string[] {
  const totals = new Map<string, number>();
  for (const c of clients) {
    for (const w of c.wallets ?? []) totals.set(w.currency, (totals.get(w.currency) ?? 0) + Number(w.balance));
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([cur, sum]) => formatAmount(sum, cur));
}

/** Opérations où le client est expéditeur ou destinataire, de la plus récente à la plus ancienne. */
export function clientOperations(txs: readonly Transaction[], clientId: string): Transaction[] {
  return txs
    .filter((t) => String(t.senderId) === clientId || (t.recipientId != null && String(t.recipientId) === clientId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ─── Mouvements de caisse des agences ────────────────────
export type CashTab = 'all' | 'AGENCY_COLLECTION' | 'AGENCY_REMITTANCE' | 'AGENCY_REFILL';

export const CASH_TABS: readonly { id: CashTab; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'AGENCY_COLLECTION', label: 'Retraits' },
  { id: 'AGENCY_REMITTANCE', label: 'Remises des agents' },
  { id: 'AGENCY_REFILL', label: 'Recharges' },
];

const CASH_TYPES = new Set<string>(['AGENCY_COLLECTION', 'AGENCY_REMITTANCE', 'AGENCY_REFILL']);

export function cashMovements(txs: readonly Transaction[]): Transaction[] {
  return txs
    .filter((t) => CASH_TYPES.has(t.type))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
