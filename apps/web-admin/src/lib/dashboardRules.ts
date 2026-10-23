// apps/web-admin/src/lib/dashboardRules.ts
// v1.0 — Calculs du tableau de bord : fonctions pures, sans React ni réseau.

import type { Transaction } from '@direct-transfair/shared';
import { formatAmount } from './companyRules';
import { volumeByCurrency } from './transactionRules';

export function greeting(now: Date = new Date()): string {
  return now.getHours() < 18 ? 'Bonjour' : 'Bonsoir';
}

/** « Vendredi 23 octobre ». */
export function longDate(now: Date = new Date()): string {
  const text = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function isToday(iso: string, now: Date = new Date()): boolean {
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.toDateString() === now.toDateString();
}

/** Statuts qui n'ont plus d'effet : ils ne comptent ni dans l'activité du jour ni dans « à traiter ». */
const CLOSED = new Set<string>(['CANCELLED', 'FAILED', 'EXPIRED', 'REFUNDED']);

export interface DaySummary {
  /** Opérations du jour, hors annulées / échouées / expirées / remboursées. */
  count: number;
  /** Volume des envois du jour, par devise (« 1 250 000 GNF », « 3 400 € »). */
  volume: string[];
}

export function todaySummary(txs: readonly Transaction[], now: Date = new Date()): DaySummary {
  const today = txs.filter((t) => isToday(t.createdAt, now) && !CLOSED.has(t.status));
  return { count: today.length, volume: volumeByCurrency(today.filter((t) => t.type === 'TRANSFER')) };
}

/** Une opération attend une décision : en attente, bloquée, ou signalée par la conformité. */
export function needsAttention(tx: Transaction): boolean {
  if (tx.status === 'PENDING' || tx.status === 'ON_HOLD') return true;
  return Boolean(tx.isFlagged) && !CLOSED.has(tx.status);
}

/** Les plus récentes d'abord (ne suppose pas l'ordre renvoyé par le serveur). */
export function newestFirst(txs: readonly Transaction[]): Transaction[] {
  return [...txs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** « À l'instant », « Il y a 5 min », « Il y a 3 h », « Hier », puis la date. */
export function when(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "À l'instant";
  if (diff < 3_600_000) return `Il y a ${Math.round(diff / 60_000)} min`;
  if (isToday(iso, now)) return `Il y a ${Math.round(diff / 3_600_000)} h`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

/** « 1 250 € », « 3 400 000 GNF » — un montant par devise, les plus gros d'abord. */
export function amountsLabel(totals: readonly { currency: string; total: number }[]): string[] {
  return [...totals]
    .filter((t) => Number.isFinite(t.total) && t.total !== 0)
    .sort((a, b) => b.total - a.total)
    .map((t) => formatAmount(t.total, t.currency));
}
