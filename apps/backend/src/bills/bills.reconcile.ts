// apps/backend/src/bills/bills.reconcile.ts
// =========================================================
// RAPPROCHEMENT AUTOMATIQUE (lot 14b) — fonctions PURES : lecture du fichier CSV d'un facturier, détection des colonnes, montants et
// dates saisis « à la française » ou « à l'anglaise », appariement avec les factures réglées par la société.
//
// Appariement, par ordre de priorité :
//   1. numéro d'opération du facturier (colonne « operation / transaction / reçu » = providerRef enregistré à la clôture) ;
//   2. à défaut, référence du client (compteur, police, élève…) ET montant identiques.
// Écarts rendus :
//   MATCHED            facture et ligne du fichier concordent (même montant)
//   AMOUNT_MISMATCH    même opération mais montants différents (à régler avec le facturier)
//   MISSING_AT_BILLER  nous avons réglé (ou envoyé) la facture, le facturier ne la montre pas — l'argent est parti : à réclamer
//   UNKNOWN_AT_BILLER  le facturier montre une ligne que nous n'avons pas : encaissement sans facture chez nous
//   DUPLICATE_LINE     la même opération apparaît deux fois dans le fichier (ou deux lignes pour une facture)
// =========================================================

export const MAX_LINES = 5000;
export const MAX_ROWS_PER_BUCKET = 500;

export type ReconcileKind = 'MATCHED' | 'AMOUNT_MISMATCH' | 'MISSING_AT_BILLER' | 'UNKNOWN_AT_BILLER' | 'DUPLICATE_LINE';

export interface ColumnMapping {
  /** Intitulé de la colonne (tel qu'écrit dans l'en-tête du fichier) — chacune est facultative sauf le montant. */
  amount: string;
  providerRef?: string | null;
  reference?: string | null;
  date?: string | null;
}

export interface ParsedCsv {
  delimiter: string;
  headers: string[];
  rows: string[][];
  /** Lignes ignorées car vides. */
  skipped: number;
}

// ── Lecture du CSV ─────────────────────────────────────

/** « ; », « , », tabulation ou « | » : celui qui revient le plus souvent hors guillemets sur la première ligne. */
export function detectDelimiter(text: string): string {
  const first = text.replace(/^﻿/, '').split(/\r?\n/).find((l) => l.trim()) ?? '';
  let best = ';';
  let bestCount = -1;
  for (const d of [';', ',', '\t', '|']) {
    let count = 0;
    let quoted = false;
    for (const ch of first) {
      if (ch === '"') quoted = !quoted;
      else if (!quoted && ch === d) count += 1;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/** Lecteur CSV : guillemets doublés, retours à la ligne dans une cellule, BOM, CRLF. Ne lève jamais. */
export function parseCsv(text: string, delimiter?: string): ParsedCsv {
  const src = String(text ?? '').replace(/^﻿/, '');
  const delim = delimiter ?? detectDelimiter(src);
  const all: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell);
      cell = '';
      all.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    all.push(row);
  }
  const nonEmpty = all.filter((r) => r.some((c) => c.trim() !== ''));
  const skipped = all.length - nonEmpty.length;
  const headers = (nonEmpty[0] ?? []).map((h) => h.trim());
  return { delimiter: delim, headers, rows: nonEmpty.slice(1), skipped };
}

// ── Valeurs ────────────────────────────────────────────

/**
 * Montant lu dans un fichier : « 1 500,50 », « 1.500,50 », « 1,500.50 », « 100000 », « 100 000 GNF », « -2 500 ».
 * Le DERNIER séparateur (« , » ou « . ») est la virgule décimale s'il est suivi de 1 ou 2 chiffres ; sinon c'est un séparateur de milliers.
 * Renvoie null si le texte n'est pas un montant.
 */
export function parseAmount(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  let t = String(raw ?? '').trim();
  if (!t) return null;
  const negative = /^\(.*\)$/.test(t) || /^-/.test(t);
  t = t.replace(/[^\d.,]/g, '');
  if (!/\d/.test(t)) return null;
  const lastSep = Math.max(t.lastIndexOf(','), t.lastIndexOf('.'));
  let intPart = t;
  let decPart = '';
  if (lastSep >= 0) {
    const after = t.length - lastSep - 1;
    if (after >= 1 && after <= 2) {
      intPart = t.slice(0, lastSep);
      decPart = t.slice(lastSep + 1);
    }
  }
  const n = Number(`${intPart.replace(/[.,]/g, '')}${decPart ? `.${decPart}` : ''}`);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Date lue dans un fichier (AAAA-MM-JJ, JJ/MM/AAAA, JJ-MM-AAAA, avec ou sans heure). Heure ignorée sauf pour l'ordre. Null si illisible. */
export function parseFileDate(raw: unknown): Date | null {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  let y: number, mo: number, d: number;
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(t);
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else {
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(t);
    if (!m) return null;
    [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? date : null;
}

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Référence comparée sans espaces, tirets, casse ni zéros de tête. */
export const normRef = (s: unknown): string => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+(?=.)/, '');

/** Devine les colonnes d'après leurs intitulés. Le client peut ensuite les corriger : c'est une aide, jamais une obligation. */
export function suggestMapping(headers: string[]): ColumnMapping | null {
  const find = (re: RegExp, taken: Set<string>): string | null => {
    const h = headers.find((x) => !taken.has(x) && re.test(norm(x)));
    return h ?? null;
  };
  const taken = new Set<string>();
  const take = (h: string | null) => {
    if (h) taken.add(h);
    return h;
  };
  const amount = take(find(/\b(montant|amount|total|somme|valeur|paye|payment)\b/, taken));
  if (!amount) return null;
  const providerRef = take(find(/\b(operation|transaction|trans|recu|receipt|quittance|txn|ref operation|id)\b/, taken));
  const reference = take(find(/\b(reference|ref|compteur|police|abonne|client|numero|contrat|matricule|eleve|account|meter)\b/, taken));
  const date = take(find(/\b(date|jour|day|time|heure)\b/, taken));
  return { amount, providerRef, reference, date };
}

// ── Rapprochement ──────────────────────────────────────

export interface FileLine {
  /** Numéro de ligne dans le fichier (l'en-tête est la ligne 1). */
  line: number;
  providerRef: string | null;
  reference: string | null;
  amount: number | null;
  date: Date | null;
  raw: string;
}

export interface OurPayment {
  id: string;
  reference: string;
  accountRef: string;
  providerRef: string | null;
  amount: number;
  currency: string;
  status: string;
  at: Date;
}

export interface ReconcileRow {
  kind: ReconcileKind;
  line: number | null;
  fileAmount: number | null;
  fileRef: string | null;
  fileProviderRef: string | null;
  fileDate: string | null;
  paymentId: string | null;
  paymentReference: string | null;
  paymentAccountRef: string | null;
  paymentProviderRef: string | null;
  paymentAmount: number | null;
  diff: number | null;
}

/** Transforme le fichier lu en lignes exploitables selon le mapping (une colonne absente du fichier est ignorée, jamais une erreur silencieuse sur le montant). */
export function toLines(parsed: ParsedCsv, mapping: ColumnMapping): { lines: FileLine[]; invalidAmounts: number[] } {
  const idx = (name: string | null | undefined): number => (name ? parsed.headers.findIndex((h) => h === name) : -1);
  const iAmount = idx(mapping.amount);
  if (iAmount < 0) throw new Error(`Colonne « ${mapping.amount} » introuvable dans le fichier.`);
  const [iOp, iRef, iDate] = [idx(mapping.providerRef), idx(mapping.reference), idx(mapping.date)];
  const lines: FileLine[] = [];
  const invalidAmounts: number[] = [];
  parsed.rows.forEach((cells, k) => {
    const line = k + 2;
    const amount = parseAmount(cells[iAmount]);
    if (amount === null) invalidAmounts.push(line);
    lines.push({
      line,
      providerRef: iOp >= 0 && (cells[iOp] ?? '').trim() ? cells[iOp].trim() : null,
      reference: iRef >= 0 && (cells[iRef] ?? '').trim() ? cells[iRef].trim() : null,
      amount,
      date: iDate >= 0 ? parseFileDate(cells[iDate]) : null,
      raw: cells.join(' | ').slice(0, 200),
    });
  });
  return { lines, invalidAmounts };
}

export interface ReconcileResult {
  rows: ReconcileRow[];
  counts: Record<ReconcileKind, number>;
  totals: { matched: number; amountMismatch: number; missingAtBiller: number; unknownAtBiller: number };
}

const emptyRow = (kind: ReconcileKind): ReconcileRow => ({
  kind, line: null, fileAmount: null, fileRef: null, fileProviderRef: null, fileDate: null,
  paymentId: null, paymentReference: null, paymentAccountRef: null, paymentProviderRef: null, paymentAmount: null, diff: null,
});

const round = (n: number): number => Math.round(n * 10_000) / 10_000;

/** Appariement ligne ↔ facture. Une facture ne sert qu'une fois ; une seconde ligne pour la même facture est signalée « doublon ». */
export function reconcile(lines: FileLine[], payments: OurPayment[], opts: { tolerance?: number } = {}): ReconcileResult {
  const tolerance = Math.max(0, opts.tolerance ?? 0);
  const byOp = new Map<string, OurPayment>();
  for (const p of payments) if (p.providerRef) byOp.set(normRef(p.providerRef), p);
  const byRef = new Map<string, OurPayment[]>();
  for (const p of payments) {
    const k = normRef(p.accountRef);
    byRef.set(k, [...(byRef.get(k) ?? []), p]);
  }

  const used = new Set<string>();
  const rows: ReconcileRow[] = [];

  for (const l of lines) {
    if (l.amount === null) continue; // ligne sans montant lisible : signalée à part (invalidAmounts), jamais comptée
    let match: OurPayment | undefined;
    const op = l.providerRef ? normRef(l.providerRef) : '';
    if (op && byOp.has(op)) match = byOp.get(op);
    if (!match && l.reference) {
      const candidates = (byRef.get(normRef(l.reference)) ?? []).filter((p) => !used.has(p.id));
      match = candidates.find((p) => Math.abs(p.amount - l.amount!) <= tolerance) ?? undefined;
    }

    const base = { ...emptyRow('UNKNOWN_AT_BILLER'), line: l.line, fileAmount: l.amount, fileRef: l.reference, fileProviderRef: l.providerRef, fileDate: l.date ? l.date.toISOString().slice(0, 10) : null };
    if (!match) {
      rows.push(base);
      continue;
    }
    const withPayment = { ...base, paymentId: match.id, paymentReference: match.reference, paymentAccountRef: match.accountRef, paymentProviderRef: match.providerRef, paymentAmount: match.amount };
    if (used.has(match.id)) {
      rows.push({ ...withPayment, kind: 'DUPLICATE_LINE', diff: null });
      continue;
    }
    used.add(match.id);
    const diff = round(l.amount - match.amount);
    rows.push({ ...withPayment, kind: Math.abs(diff) <= tolerance ? 'MATCHED' : 'AMOUNT_MISMATCH', diff });
  }

  for (const p of payments) {
    if (used.has(p.id)) continue;
    rows.push({ ...emptyRow('MISSING_AT_BILLER'), paymentId: p.id, paymentReference: p.reference, paymentAccountRef: p.accountRef, paymentProviderRef: p.providerRef, paymentAmount: p.amount });
  }

  const counts: Record<ReconcileKind, number> = { MATCHED: 0, AMOUNT_MISMATCH: 0, MISSING_AT_BILLER: 0, UNKNOWN_AT_BILLER: 0, DUPLICATE_LINE: 0 };
  const totals = { matched: 0, amountMismatch: 0, missingAtBiller: 0, unknownAtBiller: 0 };
  for (const r of rows) {
    counts[r.kind] += 1;
    if (r.kind === 'MATCHED') totals.matched += r.paymentAmount ?? 0;
    else if (r.kind === 'AMOUNT_MISMATCH') totals.amountMismatch += Math.abs(r.diff ?? 0);
    else if (r.kind === 'MISSING_AT_BILLER') totals.missingAtBiller += r.paymentAmount ?? 0;
    else if (r.kind === 'UNKNOWN_AT_BILLER') totals.unknownAtBiller += r.fileAmount ?? 0;
  }
  return { rows, counts, totals: { matched: round(totals.matched), amountMismatch: round(totals.amountMismatch), missingAtBiller: round(totals.missingAtBiller), unknownAtBiller: round(totals.unknownAtBiller) } };
}

export const KIND_LABEL_FR: Record<ReconcileKind, string> = {
  MATCHED: 'Concordant',
  AMOUNT_MISMATCH: 'Montant différent',
  MISSING_AT_BILLER: 'Absent chez le facturier',
  UNKNOWN_AT_BILLER: 'Inconnu chez nous',
  DUPLICATE_LINE: 'Ligne en double',
};
