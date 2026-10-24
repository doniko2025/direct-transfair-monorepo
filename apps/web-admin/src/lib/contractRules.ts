// apps/web-admin/src/lib/contractRules.ts
// Règles d'affichage et de saisie des contrats (location / achat de l'application).

import {
  BILLING_PERIOD_LABEL,
  CONTRACT_STATUS_LABEL,
  type ContractKind,
  type ContractStatus,
  type ContractTerms,
  type ContractTermsInput,
  type CurrencyCode,
} from '@direct-transfair/shared';

export type ContractTone = 'ok' | 'brand' | 'warn' | 'neutral' | 'danger';

export const CONTRACT_TONE: Record<ContractStatus, ContractTone> = {
  PENDING: 'warn',
  SIGNED: 'ok',
  EXPIRED: 'neutral',
  CANCELLED: 'danger',
};

export const contractStatusLabel = (s: ContractStatus): string => CONTRACT_STATUS_LABEL[s] ?? s;

/** Valeurs saisies dans le formulaire (toutes en texte, comme les champs). */
export interface ContractTermsForm {
  amount: string;
  currency: CurrencyCode;
  billingPeriod: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  commitmentMonths: string;
  maintenanceFeeYearly: string;
  paymentDays: string;
  effectiveDate: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export function initialTermsForm(currency: CurrencyCode = 'EUR'): ContractTermsForm {
  return {
    amount: '',
    currency,
    billingPeriod: 'MONTHLY',
    commitmentMonths: '12',
    maintenanceFeeYearly: '',
    paymentDays: '15',
    effectiveDate: today(),
  };
}

const toNumber = (v: string): number => Number(v.replace(/\s/g, '').replace(',', '.'));

export function validateTerms(f: ContractTermsForm, kind: ContractKind): Record<string, string> {
  const e: Record<string, string> = {};
  const raw = f.amount.replace(/\s/g, '');
  if (!/^\d+([.,]\d{1,2})?$/.test(raw) || toNumber(raw) <= 0) {
    e.amount =
      kind === 'RENTAL'
        ? 'Saisissez la redevance (supérieure à 0, 2 décimales au plus).'
        : 'Saisissez le prix (supérieur à 0, 2 décimales au plus).';
  }
  if (kind === 'RENTAL') {
    const m = Number(f.commitmentMonths);
    if (!Number.isInteger(m) || m < 1 || m > 120) e.commitmentMonths = 'Entre 1 et 120 mois.';
  } else if (f.maintenanceFeeYearly.trim()) {
    const fee = toNumber(f.maintenanceFeeYearly);
    if (!Number.isFinite(fee) || fee < 0) e.maintenanceFeeYearly = 'Montant invalide.';
  }
  const d = Number(f.paymentDays);
  if (!Number.isInteger(d) || d < 0 || d > 90) e.paymentDays = 'Entre 0 et 90 jours.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.effectiveDate)) e.effectiveDate = "Date d'effet invalide.";
  return e;
}

export function toTermsInput(f: ContractTermsForm, kind: ContractKind): ContractTermsInput {
  const input: ContractTermsInput = {
    amount: toNumber(f.amount),
    currency: f.currency,
    paymentDays: Number(f.paymentDays),
    effectiveDate: f.effectiveDate,
  };
  if (kind === 'RENTAL') {
    input.billingPeriod = f.billingPeriod;
    input.commitmentMonths = Number(f.commitmentMonths);
  } else if (f.maintenanceFeeYearly.trim() && toNumber(f.maintenanceFeeYearly) > 0) {
    input.maintenanceFeeYearly = toNumber(f.maintenanceFeeYearly);
  }
  return input;
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/** « 149 € par mois » (location) ou « 4 900 € » (achat). */
export function termsHeadline(kind: ContractKind, t: ContractTerms): string {
  const money = formatMoney(Number(t.amount), t.currency);
  return kind === 'RENTAL' ? `${money} ${BILLING_PERIOD_LABEL[t.billingPeriod ?? 'MONTHLY']}` : money;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
}

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { dateStyle: 'long' });
}

/** Enregistre un fichier reçu de l'API sur l'appareil (fonctionne aussi sur téléphone, sans fenêtre surgissante). */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
