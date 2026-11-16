// src/lib/billRules.ts
// Paiement de factures (lot 14) : tons des pastilles, adaptation des listes paginées, lecture des nombres saisis.

import type { BillerStatus, BillPartnership, BillPaymentAdmin, BillPaymentStatus, BillsPaged, Page } from '@direct-transfair/shared';

type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger';

export const BILLER_TONE: Record<BillerStatus, Tone> = { DRAFT: 'neutral', ACTIVE: 'ok', SUSPENDED: 'danger' };
export const PARTNERSHIP_TONE: Record<BillPartnership, Tone> = { NONE: 'neutral', NEGOTIATING: 'warn', SIGNED: 'ok' };
export const BILL_STATUS_TONE: Record<BillPaymentStatus, Tone> = { SUBMITTED: 'warn', PROCESSING: 'brand', COMPLETED: 'ok', REFUNDED: 'danger' };

export function toBillPage(r: BillsPaged<BillPaymentAdmin>): Page<BillPaymentAdmin> {
  return { data: r.data, meta: { total: r.meta.total, page: r.meta.page, limit: r.meta.limit, totalPages: r.meta.pages } };
}

/** Saisie « 1 500,5 » → nombre ; null si vide ; NaN si invalide. */
export function readNumber(text: string): number | null {
  const t = text.replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN;
}

/** « ELECTRICITY » → « Électricité » ; une catégorie propre à la société s'affiche lisiblement. */
export function categoryName(code: string, known: Record<string, string>): string {
  const label = known[code];
  if (label) return label;
  const nice = code.toLowerCase().replace(/_/g, ' ');
  return nice.charAt(0).toUpperCase() + nice.slice(1);
}
