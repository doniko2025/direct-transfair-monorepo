// apps/direct-transfair-mobile/components/wallet/walletTheme.ts
// =========================================================
// THÈME DES ÉCRANS WALLET v1.1 — Direct Transf'air
// v1.1 : useWalletTheme() synchronise aussi la marque dynamique (brand.ts)
//        pour les écrans qui portent encore une palette héritée.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Une seule source pour les couleurs, formats d'argent et de date, et la
// lecture d'une transaction (sens, libellé, statut) de tous les écrans du
// wallet : accueil, activité, contacts, compte, envoi, recharge, taux.
// La palette dérive de la couleur de marque du tenant (white-label).
// =========================================================

import { useMemo } from 'react';
import { fmtDate, fmtTime, getLocale, tr } from '../../i18n/runtime';
import type { MessageKey } from '../../i18n/catalog';
import { useTenant } from '../../providers/TenantProvider';
import { setBrandPrimary } from './brand';
import {
  buildPalette, N, FONT, RADIUS, SHADOW, alpha, darken, lighten, type AuthPalette,
} from '../auth/authTheme';

export { N, FONT, RADIUS, SHADOW, alpha, darken, lighten };
export type WalletPalette = AuthPalette;

/** Espace à réserver en bas des écrans pour la barre d'onglets flottante. */
export const TAB_BAR_SPACE = 112;

export function useWalletTheme() {
  const { branding } = useTenant();
  // v1.1 — synchronise la marque pour les écrans « themed()/brand() »
  setBrandPrimary(branding.primaryColor);
  const P = useMemo(() => buildPalette(branding.primaryColor, branding.secondaryColor), [branding.primaryColor, branding.secondaryColor]);
  return { P, N, FONT, RADIUS, SHADOW, brandName: branding.name, logoUrl: branding.logoUrl };
}

// ─── Argent ──────────────────────────────────────────────
export function toNum(v: unknown): number {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === 'function') return (v as any).toNumber();
  return 0;
}

const ZERO_DECIMALS = new Set(['XOF', 'XAF', 'GNF', 'JPY']);

export function formatMoney(n: number, currency = 'EUR'): string {
  const d = ZERO_DECIMALS.has(currency) ? 0 : 2;
  try {
    return new Intl.NumberFormat(getLocale(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  } catch { return n.toFixed(d); }
}

const SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', XOF: 'F CFA', XAF: 'F CFA', GNF: 'GNF' };
export function currencySymbol(currency: string): string { return SYMBOLS[currency] ?? currency; }

// ─── Dates ───────────────────────────────────────────────
export function formatDay(iso: string): string {
  const d = new Date(iso), now = new Date();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return tr('date.today');
  if (d.toDateString() === yest.toDateString()) return tr('date.yesterday');
  return fmtDate(d, { day: '2-digit', month: 'long', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}
export function formatTime(iso: string): string {
  return fmtTime(iso);
}
export function formatShortDate(iso: string): string {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return formatTime(iso);
  return fmtDate(d, { day: '2-digit', month: 'short' });
}

// ─── Identité visuelle d'un contact ──────────────────────
const TONES = [
  { bg: '#E6F4EA', fg: '#1E6B3A' }, { bg: '#E3EEFB', fg: '#1D4F91' },
  { bg: '#FDF1D8', fg: '#8A5A0B' }, { bg: '#F0E6FA', fg: '#6B2FA3' },
  { bg: '#FBE4E8', fg: '#A3203B' }, { bg: '#DDF4F0', fg: '#0F6B5E' },
];
export function avatarTone(name: string) { return TONES[(name?.charCodeAt(0) ?? 0) % TONES.length]; }
export function initialsOf(name: string): string {
  const parts = (name || '?').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '')).toUpperCase();
}

// ─── Statuts de transaction ──────────────────────────────
export type StatusTone = { fg: string; bg: string; bd: string; label: string; labelIncoming: string; icon: string };

const TONE = {
  ok:      { fg: N.ok,       bg: N.okBg,    bd: N.okBd },
  warn:    { fg: N.warn,     bg: N.warnBg,  bd: N.warnBd },
  danger:  { fg: N.danger,   bg: N.dangerBg, bd: N.dangerBd },
  info:    { fg: '#175CD3',  bg: '#EFF8FF', bd: '#B2DDFF' },
  neutral: { fg: '#475467',  bg: '#F2F4F7', bd: '#E4E7EC' },
  violet:  { fg: '#6941C6',  bg: '#F9F5FF', bd: '#E9D7FE' },
};

/** Teinte + icône + libellés (lus dans la langue COURANTE à chaque accès : `label` et `labelIncoming` sont des accesseurs). */
const statusTone = (tone: { fg: string; bg: string; bd: string }, out: MessageKey, inc: MessageKey, icon: string): StatusTone => ({
  ...tone,
  get label() { return tr(out); },
  get labelIncoming() { return tr(inc); },
  icon,
});

export const TX_STATUS: Record<string, StatusTone> = {
  PENDING:    statusTone(TONE.warn,    'txs.pending',   'txs.pending',   'time-outline'),
  VALIDATED:  statusTone(TONE.info,    'txs.validated', 'txs.available', 'shield-checkmark-outline'),
  PAID:       statusTone(TONE.ok,      'txs.paid',      'txs.received',  'checkmark-circle-outline'),
  PROCESSING: statusTone(TONE.violet,  'txs.processing', 'txs.processing', 'sync-outline'),
  CANCELLED:  statusTone(TONE.neutral, 'txs.cancelled', 'txs.cancelled', 'close-circle-outline'),
  FAILED:     statusTone(TONE.danger,  'txs.failed',    'txs.failed',    'alert-circle-outline'),
  REFUNDED:   statusTone(TONE.violet,  'txs.refunded',  'txs.refunded',  'return-down-back-outline'),
  EXPIRED:    statusTone(TONE.neutral, 'txs.expiredRefunded', 'txs.expired', 'timer-outline'),
};
export function statusOf(status: string): StatusTone {
  return TX_STATUS[status] ?? { ...TONE.neutral, label: status || '—', labelIncoming: status || '—', icon: 'help-circle-outline' };
}

// ─── Lecture d'une transaction du point de vue du client ─
export type TxView = {
  incoming: boolean;
  title: string;
  counterpart: string;
  amount: number;
  currency: string;
  converted: { amount: number; currency: string } | null;
  status: StatusTone;
  statusLabel: string;
  icon: string;
};

export function describeTx(tx: any, userId?: string): TxView {
  const type = String(tx?.type ?? '').toUpperCase();
  const isDeposit = type === 'DEPOSIT' || type === 'TOP_UP';
  // Lot 11 : paiement marchand (QR / téléphone) et retrait marchand — le sens se lit sur l'expéditeur / le destinataire.
  const isMerchantPayment = type === 'MERCHANT_PAYMENT';
  const isMerchantPayout = type === 'MERCHANT_PAYOUT';
  // Lot 13 : remboursement d'un paiement — reçu par le client, versé par le commerce.
  const isMerchantRefund = type === 'MERCHANT_REFUND';
  const incoming = isMerchantPayout
    ? false
    : isMerchantPayment
      ? tx?.recipientId === userId
      : isDeposit || tx?.recipientId === userId || (tx?.senderId !== userId && !tx?.beneficiaryId);

  const hasConversion =
    !!tx?.targetCurrency && tx.targetCurrency !== tx.currency && toNum(tx.receivedAmount) > 0;

  const amount = incoming && hasConversion ? toNum(tx.receivedAmount) : toNum(tx?.amount);
  const currency = String(incoming && hasConversion ? tx.targetCurrency : tx?.currency ?? '');

  const sender = tx?.sender?.firstName
    ? `${tx.sender.firstName} ${tx.sender.lastName ?? ''}`.trim()
    : tx?.senderFirstName ? `${tx.senderFirstName} ${tx.senderLastName ?? ''}`.trim() : '';
  const counterpart = isMerchantPayout
    ? tr('txt.payout')
    : incoming
      ? sender
      : (tx?.beneficiary?.fullName ?? tx?.recipient?.firstName ?? tx?.beneficiary?.phone ?? '');

  const status = statusOf(String(tx?.status ?? ''));
  return {
    incoming,
    title: isMerchantPayout
      ? tr('txt.payout')
      : isMerchantRefund
        ? (incoming ? tr('txt.refundIn') : tr('txt.refundOut'))
        : isMerchantPayment
        ? (incoming ? tr('txt.payIn') : tr('txt.payOut'))
        : incoming ? (isDeposit ? tr('txt.deposit') : tr('txt.moneyIn')) : tr('txt.moneyOut'),
    counterpart,
    amount,
    currency,
    converted: !incoming && hasConversion ? { amount: toNum(tx.receivedAmount), currency: String(tx.targetCurrency) } : null,
    status,
    statusLabel: incoming ? status.labelIncoming : status.label,
    icon: isMerchantPayout ? 'cash-outline' : isMerchantRefund ? 'return-down-back-outline' : isMerchantPayment ? 'storefront-outline' : incoming ? 'arrow-down' : 'arrow-up',
  };
}
