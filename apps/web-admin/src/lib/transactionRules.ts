// src/lib/transactionRules.ts
// Libellés, tons et règles d'affichage des transactions.
// Les transitions de statut reprennent celles de assertTxTransition() côté serveur :
// le serveur reste l'autorité, ici on évite seulement de proposer une action qu'il refuserait.

import type {
  AdminTargetStatus,
  PaymentMethod,
  PayoutMethod,
  Transaction,
  TransactionStatus,
  TransactionType,
  WithdrawalStatus,
} from '@direct-transfair/shared';
import type { IconName } from '../components/Icon';
import { formatAmount } from './companyRules';
import { fullName } from './userRules';

export type TxTone = 'ok' | 'brand' | 'warn' | 'neutral' | 'danger';

// ─── Statuts ─────────────────────────────────────────────
export const STATUS_LABEL: Record<TransactionStatus, string> = {
  PENDING: 'En attente',
  VALIDATED: 'Validée',
  PROCESSING: 'En traitement',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
  FAILED: 'Échouée',
  REFUNDED: 'Remboursée',
  ON_HOLD: 'Bloquée',
  EXPIRED: 'Expirée',
};

export const STATUS_TONE: Record<TransactionStatus, TxTone> = {
  PENDING: 'warn',
  VALIDATED: 'brand',
  PROCESSING: 'brand',
  PAID: 'ok',
  CANCELLED: 'neutral',
  FAILED: 'danger',
  REFUNDED: 'neutral',
  ON_HOLD: 'warn',
  EXPIRED: 'neutral',
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status as TransactionStatus] ?? status;
}

export function statusTone(status: string): TxTone {
  return STATUS_TONE[status as TransactionStatus] ?? 'neutral';
}

/** Onglets de statut de la liste : un statut peut en regrouper plusieurs. */
export type StatusTab = 'all' | 'open' | 'paid' | 'closed';

export const STATUS_TABS: readonly { id: StatusTab; label: string; statuses: readonly TransactionStatus[] | null }[] = [
  { id: 'all', label: 'Toutes', statuses: null },
  { id: 'open', label: 'En cours', statuses: ['PENDING', 'VALIDATED', 'PROCESSING', 'ON_HOLD'] },
  { id: 'paid', label: 'Payées', statuses: ['PAID'] },
  { id: 'closed', label: 'Annulées ou échouées', statuses: ['CANCELLED', 'FAILED', 'REFUNDED', 'EXPIRED'] },
];

// ─── Types ───────────────────────────────────────────────
export const TYPE_LABEL: Record<TransactionType, string> = {
  TRANSFER: 'Transfert',
  DEPOSIT: 'Dépôt',
  WITHDRAWAL: 'Retrait',
  SERVICE_PAYMENT: 'Paiement B2B',
  INTERNAL_TRANSFER: 'Transfert interne',
  FEE_COLLECTION: 'Prélèvement de frais',
  EXCHANGE: 'Change',
  AGENCY_REFILL: 'Recharge de caisse',
  AGENCY_REMITTANCE: 'Remise à la société',
  AGENCY_COLLECTION: 'Collecte de caisse',
  REFUND: 'Remboursement',
  LOYALTY_CREDIT: 'Points fidélité',
  SCHEDULED: 'Virement programmé',
};

const TYPE_ICON: Record<TransactionType, IconName> = {
  TRANSFER: 'send',
  DEPOSIT: 'deposit',
  WITHDRAWAL: 'withdraw',
  SERVICE_PAYMENT: 'building',
  INTERNAL_TRANSFER: 'swap',
  FEE_COLLECTION: 'percent',
  EXCHANGE: 'swap',
  AGENCY_REFILL: 'vault',
  AGENCY_REMITTANCE: 'vault',
  AGENCY_COLLECTION: 'vault',
  REFUND: 'wallet',
  LOYALTY_CREDIT: 'wallet',
  SCHEDULED: 'list',
};

export function typeLabel(type: string): string {
  return TYPE_LABEL[type as TransactionType] ?? type;
}

export function typeIcon(type: string): IconName {
  return TYPE_ICON[type as TransactionType] ?? 'list';
}

export const PAYOUT_LABEL: Record<PayoutMethod, string> = {
  CASH_PICKUP: 'Retrait en espèces',
  BANK_DEPOSIT: 'Dépôt bancaire',
  MOBILE_MONEY: 'Mobile money',
  WALLET: 'Portefeuille',
  IBAN_TRANSFER: 'Virement IBAN',
  CRYPTO: 'Crypto',
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  WALLET: 'Portefeuille',
  ORANGE_MONEY: 'Orange Money',
  SENDWAVE: 'Sendwave',
  CARD: 'Carte bancaire',
  CASH: 'Espèces',
  BANK_TRANSFER: 'Virement bancaire',
  APPLE_PAY: 'Apple Pay',
  GOOGLE_PAY: 'Google Pay',
  PAYPAL: 'PayPal',
};

export const WITHDRAWAL_LABEL: Record<WithdrawalStatus, string> = {
  PENDING: 'En attente de retrait',
  APPROVED: 'Approuvé',
  PAID: 'Retiré',
  REJECTED: 'Refusé',
  FAILED: 'Échoué',
  CANCELLED: 'Annulé',
  EXPIRED: 'Expiré',
};

export const WITHDRAWAL_TONE: Record<WithdrawalStatus, TxTone> = {
  PENDING: 'warn',
  APPROVED: 'brand',
  PAID: 'ok',
  REJECTED: 'danger',
  FAILED: 'danger',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
};

// ─── Actions d'un administrateur ─────────────────────────
export interface AdminAction {
  status: AdminTargetStatus;
  label: string;
  variant: 'primary' | 'secondary' | 'danger';
  title: string;
  /** Conséquences affichées avant de confirmer. */
  consequence: string;
  confirmLabel: string;
}

const ACTIONS: Record<AdminTargetStatus, AdminAction> = {
  VALIDATED: {
    status: 'VALIDATED',
    label: 'Valider',
    variant: 'primary',
    title: 'Valider ce transfert ?',
    consequence: 'Le transfert passe à « Validée » : il peut ensuite être payé au bénéficiaire.',
    confirmLabel: 'Valider',
  },
  PAID: {
    status: 'PAID',
    label: 'Marquer comme payée',
    variant: 'primary',
    title: 'Marquer ce transfert comme payé ?',
    consequence:
      'Le transfert est clos comme « Payée ». À utiliser lorsque le bénéficiaire a bien reçu les fonds : la décision ne peut plus être modifiée.',
    confirmLabel: 'Marquer comme payée',
  },
  CANCELLED: {
    status: 'CANCELLED',
    label: 'Annuler et rembourser',
    variant: 'danger',
    title: 'Annuler ce transfert ?',
    consequence:
      'Le montant total débité (frais compris) est recrédité sur le portefeuille de l’expéditeur et le retrait associé est annulé. Cette décision est définitive.',
    confirmLabel: 'Annuler le transfert',
  },
  FAILED: {
    status: 'FAILED',
    label: 'Marquer comme échouée',
    variant: 'secondary',
    title: 'Marquer ce transfert comme échoué ?',
    consequence:
      'Attention : l’expéditeur n’est PAS remboursé automatiquement. Pour lui rendre ses fonds, annulez plutôt le transfert. Le statut « Échouée » est définitif.',
    confirmLabel: 'Marquer comme échouée',
  },
};

const NEXT: Partial<Record<TransactionStatus, readonly AdminTargetStatus[]>> = {
  PENDING: ['VALIDATED', 'CANCELLED', 'FAILED'],
  VALIDATED: ['PAID', 'CANCELLED', 'FAILED'],
  PROCESSING: ['PAID', 'CANCELLED', 'FAILED'],
};

/**
 * Le remboursement du serveur recrédite l'expéditeur du montant total, quel que soit
 * le type : proposer « Annuler » sur un dépôt ou une recharge de caisse créerait de la
 * monnaie. Le web ne propose donc le changement de statut que pour les transferts.
 */
export function adminActions(tx: Transaction): AdminAction[] {
  if (tx.type !== 'TRANSFER') return [];
  return (NEXT[tx.status] ?? []).map((s) => ACTIONS[s]);
}

/** Paiement B2B en attente : seul le super admin l'encaisse ou le refuse. */
export function isPendingB2B(tx: Transaction): boolean {
  return tx.type === 'SERVICE_PAYMENT' && tx.status === 'PENDING';
}

// ─── Perspective d'affichage ─────────────────────────────
export interface TxView {
  title: string;
  subtitle: string;
  icon: IconName;
  /** Sens de l'argent pour le lecteur (agent) : entrée, sortie, ou neutre pour un administrateur. */
  flow: 'in' | 'out' | 'neutral';
  amount: string;
  /** Montant converti ou devise de paiement, quand elle diffère. */
  amountNote: string | null;
}

function num(v: string | number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function partyName(p: { firstName: string | null; lastName: string | null } | null | undefined): string | null {
  if (!p) return null;
  const n = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
  return n || null;
}

export function senderName(tx: Transaction): string {
  const s = tx.sender;
  return s ? fullName({ firstName: s.firstName, lastName: s.lastName, email: s.email ?? '' }) || 'Expéditeur inconnu' : 'Expéditeur inconnu';
}

export function beneficiaryName(tx: Transaction): string | null {
  return tx.beneficiary?.fullName?.trim() || null;
}

/** Montant que touche le bénéficiaire quand il y a conversion, sinon null. */
export function convertedAmount(tx: Transaction): string | null {
  if (tx.targetCurrency && tx.targetCurrency !== tx.currency && num(tx.receivedAmount) > 0) {
    return formatAmount(num(tx.receivedAmount), tx.targetCurrency);
  }
  return null;
}

export function viewFor(tx: Transaction, viewer: { id: string | number; role: string }): TxView {
  const base = formatAmount(num(tx.amount), tx.currency);
  const converted = convertedAmount(tx);
  const from = senderName(tx);
  const to = beneficiaryName(tx);

  if (viewer.role !== 'AGENT') {
    return {
      title: typeLabel(tx.type),
      subtitle: to ? `${from} → ${to}` : from,
      icon: typeIcon(tx.type),
      flow: 'neutral',
      amount: base,
      amountNote: converted ? `${converted} reçus` : null,
    };
  }

  const me = String(viewer.id);
  const paidByMe = tx.withdrawal?.processedById != null && String(tx.withdrawal.processedById) === me;
  const fromMe = String(tx.senderId) === me;

  if (tx.type === 'AGENCY_REFILL') {
    return { title: 'Recharge de caisse', subtitle: `Envoyée par ${from}`, icon: 'vault', flow: 'in', amount: base, amountNote: null };
  }
  if (tx.type === 'AGENCY_REMITTANCE' || tx.type === 'AGENCY_COLLECTION') {
    return { title: typeLabel(tx.type), subtitle: 'Fonds remontés à la société', icon: 'vault', flow: 'out', amount: base, amountNote: null };
  }
  if (tx.type === 'DEPOSIT' && fromMe) {
    return { title: 'Dépôt client', subtitle: to ?? 'Client', icon: 'deposit', flow: 'out', amount: base, amountNote: null };
  }
  if (paidByMe) {
    return {
      title: 'Retrait payé',
      subtitle: to ?? from,
      icon: 'withdraw',
      flow: 'out',
      amount: converted ?? base,
      amountNote: null,
    };
  }
  if (fromMe) {
    return { title: "Envoi d'argent", subtitle: to ?? 'Bénéficiaire', icon: 'send', flow: 'out', amount: base, amountNote: converted ? `${converted} reçus` : null };
  }
  return {
    title: typeLabel(tx.type),
    subtitle: `De ${from}`,
    icon: typeIcon(tx.type),
    flow: 'in',
    amount: converted ?? base,
    amountNote: null,
  };
}

// ─── Recherche et filtres ────────────────────────────────
export function searchHaystack(tx: Transaction): string {
  return [
    tx.reference,
    partyName(tx.sender),
    tx.sender?.phone,
    tx.sender?.email,
    tx.beneficiary?.fullName,
    tx.beneficiary?.phone,
    tx.client?.name,
    tx.client?.code,
    typeLabel(tx.type),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export type Period = 'all' | 'today' | '7d' | '30d';

export const PERIODS: readonly { value: Period; label: string }[] = [
  { value: 'today', label: "Aujourd'hui" },
  { value: '7d', label: '7 derniers jours' },
  { value: '30d', label: '30 derniers jours' },
];

export function inPeriod(iso: string, period: Period, now: Date = new Date()): boolean {
  if (period === 'all') return true;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  if (period === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return t >= start.getTime();
  }
  const days = period === '7d' ? 7 : 30;
  return t >= now.getTime() - days * 86_400_000;
}

/** Volume par devise d'un ensemble de transactions, ex. « 1 250 000 GNF · 3 400 € ». */
export function volumeByCurrency(txs: readonly Transaction[]): string[] {
  const totals = new Map<string, number>();
  for (const t of txs) totals.set(t.currency, (totals.get(t.currency) ?? 0) + num(t.amount));
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cur, sum]) => formatAmount(sum, cur));
}

// ─── Historique ──────────────────────────────────────────
export interface TimelineStep {
  key: string;
  label: string;
  at: string;
  tone: TxTone;
}

/** Les étapes réellement atteintes, de la plus ancienne à la plus récente. */
export function timeline(tx: Transaction): TimelineStep[] {
  const steps: TimelineStep[] = [{ key: 'created', label: 'Transaction créée', at: tx.createdAt, tone: 'brand' }];
  if (tx.validatedAt) steps.push({ key: 'validated', label: 'Validée', at: tx.validatedAt, tone: 'brand' });
  if (tx.paidAt) steps.push({ key: 'paid', label: 'Payée', at: tx.paidAt, tone: 'ok' });
  if (tx.cancelledAt) steps.push({ key: 'cancelled', label: 'Annulée', at: tx.cancelledAt, tone: 'neutral' });
  if (tx.failedAt) steps.push({ key: 'failed', label: 'Échouée', at: tx.failedAt, tone: 'danger' });
  return steps.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}
