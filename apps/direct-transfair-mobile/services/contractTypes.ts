// apps/direct-transfair-mobile/services/contractTypes.ts
// =========================================================
// CONTRATS (location / achat de l'application) — types et règles de saisie côté mobile (SUPER_ADMIN).
// Reprend à l'identique packages/shared/src/contracts.ts et apps/web-admin/src/lib/contractRules.ts :
// mêmes statuts, mêmes libellés, mêmes contrôles (le serveur refait tous les contrôles).
//
// Routes (apps/backend/src/contracts/contracts.controller.ts — SUPER_ADMIN) :
//   GET  /contracts?clientId=         liste        POST /contracts                  émettre
//   GET  /contracts/:id/pdf           PDF          POST /contracts/:id/resend       nouveau lien + e-mail
//   POST /contracts/:id/resend-signed copie signée POST /contracts/:id/cancel       annuler (non signé)
// =========================================================

export type ContractStatus = "PENDING" | "SIGNED" | "CANCELLED" | "EXPIRED";
export type ContractKind = "RENTAL" | "PURCHASE";
export type BillingPeriod = "MONTHLY" | "QUARTERLY" | "YEARLY";
export type ContractCurrency = "EUR" | "USD" | "GBP" | "XOF" | "GNF";

export interface ContractTermsInput {
  amount: number;
  currency: ContractCurrency;
  billingPeriod?: BillingPeriod;
  commitmentMonths?: number;
  maintenanceFeeYearly?: number;
  paymentDays?: number;
  /** AAAA-MM-JJ */
  effectiveDate?: string;
}

export interface ContractTerms extends ContractTermsInput {
  paymentDays: number;
  effectiveDate: string;
}

export interface ContractSummary {
  id: string;
  reference: string;
  type: ContractKind;
  status: ContractStatus;
  terms: ContractTerms;
  recipientEmail: string;
  recipientName: string | null;
  tokenExpiresAt: string;
  sentAt: string | null;
  reminderCount: number;
  signedAt: string | null;
  signerName: string | null;
  signedMailedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  /** Présent sur la liste globale (GET /contracts) : permet de regrouper les contrats par société. */
  client?: { id: number };
}

export interface IssueContractInput {
  clientId: number;
  kind?: ContractKind;
  terms: ContractTermsInput;
  recipientEmail?: string;
  /** Envoyer tout de suite le lien par e-mail (défaut : oui). */
  notify?: boolean;
}

export interface IssueContractResult {
  id: string;
  reference: string;
  signUrl: string | null;
  expiresAt: string;
  recipientEmail: string;
}

export interface ResendLinkResult {
  signUrl: string | null;
  emailed: boolean;
  expiresAt: string;
  recipientEmail: string;
}

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  PENDING: "En attente de signature",
  SIGNED: "Signé",
  EXPIRED: "Lien expiré",
  CANCELLED: "Annulé",
};

export const CONTRACT_KIND_LABEL: Record<ContractKind, string> = {
  RENTAL: "Location de l'application",
  PURCHASE: "Achat de l'application",
};

export const BILLING_PERIOD_LABEL: Record<BillingPeriod, string> = {
  MONTHLY: "par mois",
  QUARTERLY: "par trimestre",
  YEARLY: "par an",
};

export const CONTRACT_CURRENCIES: { value: ContractCurrency; label: string }[] = [
  { value: "EUR", label: "EUR" },
  { value: "USD", label: "USD" },
  { value: "GBP", label: "GBP" },
  { value: "XOF", label: "XOF" },
  { value: "GNF", label: "GNF" },
];

export const BILLING_PERIODS: { value: BillingPeriod; label: string }[] = [
  { value: "MONTHLY", label: "Chaque mois" },
  { value: "QUARTERLY", label: "Chaque trimestre" },
  { value: "YEARLY", label: "Chaque année" },
];

/** Valeurs saisies dans le formulaire (toutes en texte, comme les champs). */
export interface ContractTermsForm {
  amount: string;
  currency: ContractCurrency;
  billingPeriod: BillingPeriod;
  commitmentMonths: string;
  maintenanceFeeYearly: string;
  paymentDays: string;
  effectiveDate: string;
}

/** Date du jour AAAA-MM-JJ, à l'heure du téléphone (pas en UTC : près de minuit, le jour serait décalé). */
export function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Devise de la société si elle est proposée dans les contrats, sinon l'euro. */
export function contractCurrencyOf(code?: string | null): ContractCurrency {
  const c = String(code ?? "").toUpperCase();
  return (CONTRACT_CURRENCIES.find((x) => x.value === c)?.value ?? "EUR") as ContractCurrency;
}

export function initialTermsForm(currency: ContractCurrency = "EUR"): ContractTermsForm {
  return {
    amount: "",
    currency,
    billingPeriod: "MONTHLY",
    commitmentMonths: "12",
    maintenanceFeeYearly: "",
    paymentDays: "15",
    effectiveDate: todayLocal(),
  };
}

const toNumber = (v: string): number => Number(v.replace(/\s/g, "").replace(",", "."));

/** Erreurs par champ (objet vide = formulaire valide). Mêmes règles que le web et le serveur. */
export function validateTerms(f: ContractTermsForm, kind: ContractKind): Record<string, string> {
  const e: Record<string, string> = {};
  const raw = f.amount.replace(/\s/g, "");
  if (!/^\d+([.,]\d{1,2})?$/.test(raw) || toNumber(raw) <= 0) {
    e.amount = kind === "RENTAL"
      ? "Saisissez la redevance (supérieure à 0, 2 décimales au plus)."
      : "Saisissez le prix (supérieur à 0, 2 décimales au plus).";
  }
  if (kind === "RENTAL") {
    const m = Number(f.commitmentMonths);
    if (!Number.isInteger(m) || m < 1 || m > 120) e.commitmentMonths = "Entre 1 et 120 mois.";
  } else if (f.maintenanceFeeYearly.trim()) {
    const fee = toNumber(f.maintenanceFeeYearly);
    if (!Number.isFinite(fee) || fee < 0) e.maintenanceFeeYearly = "Montant invalide.";
  }
  const d = Number(f.paymentDays);
  if (!Number.isInteger(d) || d < 0 || d > 90) e.paymentDays = "Entre 0 et 90 jours.";
  const ed = f.effectiveDate.trim();
  const parsed = new Date(`${ed}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ed) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== ed) {
    e.effectiveDate = "Date d'effet invalide (AAAA-MM-JJ).";
  }
  return e;
}

export function toTermsInput(f: ContractTermsForm, kind: ContractKind): ContractTermsInput {
  const input: ContractTermsInput = {
    amount: toNumber(f.amount),
    currency: f.currency,
    paymentDays: Number(f.paymentDays),
    effectiveDate: f.effectiveDate.trim(),
  };
  if (kind === "RENTAL") {
    input.billingPeriod = f.billingPeriod;
    input.commitmentMonths = Number(f.commitmentMonths);
  } else if (f.maintenanceFeeYearly.trim() && toNumber(f.maintenanceFeeYearly) > 0) {
    input.maintenanceFeeYearly = toNumber(f.maintenanceFeeYearly);
  }
  return input;
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
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
  return kind === "RENTAL" ? `${money} ${BILLING_PERIOD_LABEL[t.billingPeriod ?? "MONTHLY"]}` : money;
}

// ── Alertes de conformité d'une société (liste des sociétés du Super Admin) ──
export type CompanyAlertKey = "RCCM_MISSING" | "CONTRACT_EXPIRED" | "CONTRACT_PENDING" | "NO_CONTRACT";
export interface CompanyAlert { key: CompanyAlertKey; label: string; tone: "red" | "amber" | "muted" }

/**
 * Ce qui reste à régler pour une société, du plus urgent au moins urgent :
 *  • RCCM manquant (sociétés créées avant son introduction) — sans lui, aucun contrat ne peut être émis ;
 *  • lien de signature expiré, puis contrat à signer ;
 *  • aucun contrat (ou seulement des contrats annulés).
 * `contracts` = contrats de CETTE société, ou null si la liste n'a pas pu être chargée (alors aucune alerte de contrat :
 * mieux vaut ne rien afficher qu'un faux « Aucun contrat »).
 */
export function companyAlerts(company: { rccmNumber?: string | null }, contracts: ContractSummary[] | null): CompanyAlert[] {
  const out: CompanyAlert[] = [];
  if (!String(company.rccmNumber ?? "").trim()) out.push({ key: "RCCM_MISSING", label: "RCCM manquant", tone: "red" });
  if (contracts) {
    if (contracts.some((c) => c.status === "EXPIRED")) out.push({ key: "CONTRACT_EXPIRED", label: "Lien de contrat expiré", tone: "red" });
    else if (contracts.some((c) => c.status === "PENDING")) out.push({ key: "CONTRACT_PENDING", label: "Contrat à signer", tone: "amber" });
    else if (!contracts.some((c) => c.status === "SIGNED")) out.push({ key: "NO_CONTRACT", label: "Aucun contrat", tone: "muted" });
  }
  return out;
}

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try { return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return iso.slice(0, 10); }
}
