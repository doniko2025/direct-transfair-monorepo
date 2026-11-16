// apps/backend/src/bills/bills.rules.ts
// =========================================================
// RÈGLES PURES DU PAIEMENT DE FACTURES (lot 14) — aucune lecture en base, entièrement testables.
//   catégories · champs dynamiques d'un facturier · validation de la référence saisie · frais · conversion de devise
//   références de paiement · retard de règlement · vue publique d'un facturier · export CSV
//
// Principe : RIEN de métier n'est écrit en dur dans les écrans. Le facturier décrit lui-même ce que le client doit saisir
// (intitulé, motif de validation, champs supplémentaires) : « N° de compteur » pour l'électricité, « N° de police » + « Plaque »
// pour une assurance auto, « Nom de l'élève » + « Classe » pour la scolarité… Ajouter un type de facture ne demande ni migration
// ni mise à jour de l'application.
// =========================================================

import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

import { roundForCurrency } from '../merchants/merchant-rules';

// ── Catégories ─────────────────────────────────────────

/** Catégories proposées par défaut. Une société peut en saisir d'autres (MAJUSCULES et « _ ») : l'application affiche alors le code tel quel. */
export const BILL_CATEGORIES = [
  'ELECTRICITY',
  'WATER',
  'GAS',
  'INTERNET_TV',
  'TELECOM',
  'INSURANCE_AUTO',
  'INSURANCE_MOTO',
  'INSURANCE_HOME',
  'INSURANCE_HEALTH',
  'SCHOOL_FEES',
  'UNIVERSITY_FEES',
  'RENT',
  'TAXES',
  'HEALTH',
  'TRANSPORT',
  'OTHER',
] as const;

const CATEGORY_RE = /^[A-Z][A-Z0-9_]{1,39}$/;

export function normalizeCategory(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim().toUpperCase().replace(/[\s-]+/g, '_') : '';
  if (!CATEGORY_RE.test(value)) {
    throw new BadRequestException('Catégorie invalide : lettres majuscules, chiffres et « _ » (2 à 40 caractères), par exemple ELECTRICITY.');
  }
  return value;
}

export const PARTNERSHIP_STATUSES = ['NONE', 'NEGOTIATING', 'SIGNED'] as const;
export const AMOUNT_MODES = ['FREE', 'FROM_LOOKUP'] as const;
export const BILLER_STATUSES = ['DRAFT', 'ACTIVE', 'SUSPENDED'] as const;
export const PAYMENT_STATUSES = ['SUBMITTED', 'PROCESSING', 'COMPLETED', 'REFUNDED'] as const;

// ── Motifs de validation fournis par la société ────────

/** Refuse un motif invalide ou « catastrophique » (ex. `(a+)+`) : il est exécuté sur ce que tape le client. */
export function assertSafePattern(pattern: unknown, what: string): string | null {
  if (pattern === undefined || pattern === null || pattern === '') return null;
  if (typeof pattern !== 'string' || pattern.length > 120) throw new BadRequestException(`${what} : motif trop long (120 caractères au maximum).`);
  if (/(\+|\*|\{[^}]*\})\s*\)\s*(\+|\*|\{)/.test(pattern)) throw new BadRequestException(`${what} : motif trop complexe.`);
  try {
    new RegExp(pattern);
  } catch {
    throw new BadRequestException(`${what} : motif invalide.`);
  }
  return pattern;
}

function matchesPattern(pattern: string | null | undefined, value: string): boolean {
  if (!pattern) return true;
  try {
    return new RegExp(pattern).test(value);
  } catch {
    return true; // motif cassé en base : on ne bloque pas le client, la société corrigera.
  }
}

// ── Champs dynamiques ──────────────────────────────────

export const FIELD_TYPES = ['text', 'number', 'select'] as const;
export const MAX_FIELDS = 8;
const MAX_VALUE_LENGTH = 120;

export interface FieldDef {
  key: string;
  label: string;
  type: (typeof FIELD_TYPES)[number];
  required: boolean;
  pattern?: string;
  options?: string[];
}

const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,29}$/;

/** Saisie de la société (stricte) → liste enregistrée. */
export function parseFieldDefs(raw: unknown): FieldDef[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new BadRequestException('Champs supplémentaires : liste attendue.');
  if (raw.length > MAX_FIELDS) throw new BadRequestException(`Champs supplémentaires : ${MAX_FIELDS} au maximum.`);
  const seen = new Set<string>();
  return raw.map((item, i) => {
    const f = (item ?? {}) as Record<string, unknown>;
    const key = typeof f.key === 'string' ? f.key.trim() : '';
    const label = typeof f.label === 'string' ? f.label.trim() : '';
    if (!KEY_RE.test(key)) throw new BadRequestException(`Champ ${i + 1} : identifiant invalide (lettres, chiffres et « _ », commençant par une lettre).`);
    if (seen.has(key)) throw new BadRequestException(`Champ « ${key} » en double.`);
    seen.add(key);
    if (!label || label.length > 60) throw new BadRequestException(`Champ « ${key} » : intitulé requis (60 caractères au maximum).`);
    const type = (typeof f.type === 'string' ? f.type : 'text') as FieldDef['type'];
    if (!FIELD_TYPES.includes(type)) throw new BadRequestException(`Champ « ${key} » : type inconnu (text, number ou select).`);
    const def: FieldDef = { key, label, type, required: f.required !== false };
    const pattern = assertSafePattern(f.pattern, `Champ « ${key} »`);
    if (pattern) def.pattern = pattern;
    if (type === 'select') {
      const options = Array.isArray(f.options) ? f.options.map((o) => String(o).trim()).filter(Boolean) : [];
      if (options.length < 2 || options.length > 30) throw new BadRequestException(`Champ « ${key} » : entre 2 et 30 choix.`);
      def.options = [...new Set(options)];
    }
    return def;
  });
}

/** Lecture tolérante de ce qui est enregistré (jamais d'exception : une fiche abîmée ne doit pas bloquer l'écran). */
export function readFieldDefs(raw: unknown): FieldDef[] {
  try {
    return parseFieldDefs(raw);
  } catch {
    return [];
  }
}

/** Valeurs saisies par le client → valeurs contrôlées (seuls les champs déclarés par le facturier sont conservés). */
export function cleanFieldValues(defs: FieldDef[], input: unknown): Record<string, string> {
  const source = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const d of defs) {
    const rawValue = source[d.key];
    const value = (typeof rawValue === 'number' ? String(rawValue) : typeof rawValue === 'string' ? rawValue : '').trim().replace(/\s+/g, ' ');
    if (!value) {
      if (d.required) throw new BadRequestException(`« ${d.label} » est requis.`);
      continue;
    }
    if (value.length > MAX_VALUE_LENGTH) throw new BadRequestException(`« ${d.label} » : ${MAX_VALUE_LENGTH} caractères au maximum.`);
    if (d.type === 'number' && !/^\d+([.,]\d+)?$/.test(value)) throw new BadRequestException(`« ${d.label} » doit être un nombre.`);
    if (d.type === 'select' && !(d.options ?? []).includes(value)) throw new BadRequestException(`« ${d.label} » : choix invalide.`);
    if (!matchesPattern(d.pattern, value)) throw new BadRequestException(`« ${d.label} » n'a pas le bon format.`);
    out[d.key] = value;
  }
  return out;
}

// ── Référence principale ───────────────────────────────

export const MAX_REFERENCE_LENGTH = 64;

export function normalizeReference(raw: unknown): string {
  return (typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : '').trim().replace(/\s+/g, ' ');
}

export function assertReference(biller: { referenceLabel: string; referencePattern: string | null }, raw: unknown): string {
  const ref = normalizeReference(raw);
  if (!ref) throw new BadRequestException(`« ${biller.referenceLabel} » est requis.`);
  if (ref.length > MAX_REFERENCE_LENGTH) throw new BadRequestException(`« ${biller.referenceLabel} » : ${MAX_REFERENCE_LENGTH} caractères au maximum.`);
  if (!matchesPattern(biller.referencePattern, ref)) throw new BadRequestException(`« ${biller.referenceLabel} » n'a pas le bon format.`);
  return ref;
}

// ── Frais et conversion ────────────────────────────────

/** Frais payés par le client EN PLUS de la facture : part fixe + pourcentage, arrondis à la devise du facturier. */
export function computeBillFee(amount: number, feeFixed: number, feePct: number, currency: string): number {
  const fixed = Number.isFinite(feeFixed) && feeFixed > 0 ? feeFixed : 0;
  const pct = Number.isFinite(feePct) && feePct > 0 ? feePct : 0;
  return roundForCurrency(fixed + (amount * pct) / 100, currency);
}

export interface Charges {
  amountCharged: number;
  feeCharged: number;
  totalCharged: number;
}

/**
 * Ce qui sort du portefeuille du client. Même devise : montants inchangés. Devises différentes : chaque part est convertie avec le taux de
 * la société puis arrondie à la devise du portefeuille ; le total est la somme des deux parts arrondies (jamais un arrondi séparé du total),
 * donc facture + frais = débit, au centime près.
 */
export function convertCharges(p: { amount: number; fee: number; rate: number; walletCurrency: string }): Charges {
  const amountCharged = roundForCurrency(p.amount * p.rate, p.walletCurrency);
  const feeCharged = roundForCurrency(p.fee * p.rate, p.walletCurrency);
  return { amountCharged, feeCharged, totalCharged: roundForCurrency(amountCharged + feeCharged, p.walletCurrency) };
}

// ── Références de paiement et retard ───────────────────

/** `FAC-` + horodatage base 36 + 3 octets aléatoires : lisible au téléphone, non devinable. */
export function generateBillReference(now = new Date()): string {
  return `FAC-${now.getTime().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

/** Une facture payée par le client mais pas encore réglée au facturier au-delà du délai annoncé est « en retard » (alerte côté société). */
export function isLate(p: { status: string; createdAt: Date }, delayHours: number, now: Date): boolean {
  if (p.status !== 'SUBMITTED' && p.status !== 'PROCESSING') return false;
  return now.getTime() - p.createdAt.getTime() > Math.max(1, delayHours) * 3_600_000;
}

// ── Vue publique d'un facturier ────────────────────────

export interface BillerRow {
  id: string;
  name: string;
  category: string;
  country: string | null;
  currency: string;
  description: string | null;
  connectorKey: string;
  referenceLabel: string;
  referenceHint: string | null;
  referencePattern: string | null;
  fields: unknown;
  amountMode: string;
  minAmount: { toString(): string } | null;
  maxAmount: { toString(): string } | null;
  feeFixed: { toString(): string };
  feePct: { toString(): string };
  settlementDelayHours: number;
}

const num = (v: { toString(): string } | null | undefined): number | null => (v === null || v === undefined ? null : Number(v.toString()));

/** Ce que voit un client : jamais le suivi du partenariat, les coordonnées de règlement ni la note interne. */
export function publicBiller(b: BillerRow) {
  return {
    id: b.id,
    name: b.name,
    category: b.category,
    country: b.country,
    currency: b.currency,
    description: b.description,
    referenceLabel: b.referenceLabel,
    referenceHint: b.referenceHint,
    referencePattern: b.referencePattern,
    fields: readFieldDefs(b.fields),
    amountMode: b.amountMode,
    minAmount: num(b.minAmount),
    maxAmount: num(b.maxAmount),
    feeFixed: num(b.feeFixed) ?? 0,
    feePct: num(b.feePct) ?? 0,
    settlementDelayHours: b.settlementDelayHours,
    /** L'application affiche « mode simulation » : aucun argent ne part vers un vrai facturier. */
    simulated: b.connectorKey === 'sandbox',
    /** Règlement automatique par un connecteur (sinon : traité par la société, délai annoncé). */
    automatic: b.connectorKey !== 'manual',
  };
}

// ── Export CSV ─────────────────────────────────────────

/** Échappe une cellule CSV et neutralise les formules (« =… », « +… », « -… », « @… ») ouvertes dans un tableur. */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
}
