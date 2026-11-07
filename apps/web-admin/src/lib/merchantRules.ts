// src/lib/merchantRules.ts
// Marchands (lot 11) : adaptation des réponses du serveur aux listes paginées, tons et libellés.

import type {
  MerchantListItem,
  MerchantPaged,
  MerchantPayoutAdmin,
  MerchantPayoutStatus,
  MerchantStatus,
  Page,
  PaymentRequestStatus,
} from '@direct-transfair/shared';

type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger';

export const MERCHANT_TONE: Record<MerchantStatus, Tone> = { ACTIVE: 'ok', SUSPENDED: 'danger' };
export const PAYOUT_TONE: Record<MerchantPayoutStatus, Tone> = { PENDING: 'warn', PAID: 'ok', REJECTED: 'danger', FAILED: 'danger' };
export const PAYMENT_TONE: Record<PaymentRequestStatus, Tone> = { PENDING: 'warn', PAID: 'ok', DECLINED: 'danger', EXPIRED: 'neutral', CANCELLED: 'neutral' };

/** Réponse du serveur → page attendue par usePagedList (qui exige un `id` par ligne). */
export function toMerchantPage(r: MerchantPaged<MerchantListItem>): Page<MerchantListItem & { id: string }> {
  return {
    data: r.data.map((m) => ({ ...m, id: m.userId })),
    meta: { total: r.meta.total, page: r.meta.page, limit: r.meta.limit, totalPages: r.meta.pages },
  };
}

export function toPayoutPage(r: MerchantPaged<MerchantPayoutAdmin>): Page<MerchantPayoutAdmin> {
  return { data: r.data, meta: { total: r.meta.total, page: r.meta.page, limit: r.meta.limit, totalPages: r.meta.pages } };
}

export const ownerName = (o: { firstName: string | null; lastName: string | null; email: string }): string =>
  [o.firstName, o.lastName].filter(Boolean).join(' ').trim() || o.email;

/** « 10 000 XOF · 3 paiements » */
export function salesLine(sales: { currency: string; count: number; gross: number }[], format: (n: number, c: string) => string): string {
  if (sales.length === 0) return 'Aucun encaissement';
  return sales.map((s) => `${format(s.gross, s.currency)} · ${s.count} paiement${s.count > 1 ? 's' : ''}`).join(' — ');
}
