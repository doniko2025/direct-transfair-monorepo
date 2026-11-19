// apps/backend/src/reconciliation/reconciliation.core.ts
// =========================================================
// RÉCONCILIATION QUOTIDIENNE (audit argent I3) — fonctions « cœur », sans dépendance Nest.
//
// Principe : un portefeuille a deux sources de vérité qui doivent toujours dire la même chose — son solde (wallets.balance) et son
// journal (ledger_entries : CREDIT − DEBIT). Un écart = de l'argent apparu ou disparu sans trace : à expliquer avant tout le reste.
// Le contrôle porte, par société (tenant) et par devise, sur :
//   • l'écart solde ↔ journal (portefeuille par portefeuille, avec une tolérance) ;
//   • les soldes négatifs ;
//   • le réservé négatif ou supérieur au solde ;
//   • (information) l'argent « en route » : envois débités mais pas encore retirés (codes de retrait en attente).
// Lecture seule : aucune écriture sur les portefeuilles. Les requêtes sont les mêmes que l'annexe du rapport d'audit.
// =========================================================

import { Prisma } from '@prisma/client';

type Db = Prisma.TransactionClient;

/** Tolérance d'arrondi (en unités de la devise). Les montants sont stockés à 4 décimales. */
export const DEFAULT_TOLERANCE = 0.01;

export type ReconStatus = 'OK' | 'ALERT';

export interface ProblemWallet {
  walletId: string;
  balance: number;
  journal: number;
  drift: number;
  reserved: number;
  owner: 'USER' | 'AGENCY' | 'COMPANY' | 'MERCHANT' | 'OTHER';
  issues: Array<'DRIFT' | 'NEGATIVE' | 'RESERVED'>;
}

export interface ReconRow {
  /** 0 = portefeuille rattaché à aucune société (plateforme). */
  clientId: number;
  currency: string;
  walletsCount: number;
  walletsBalance: number;
  ledgerNet: number;
  /** Somme des soldes − somme des journaux (peut être nulle alors que des écarts individuels se compensent : voir driftWallets). */
  drift: number;
  driftWallets: number;
  negativeWallets: number;
  reservedIssues: number;
  inTransitCount: number;
  inTransitAmount: number;
  status: ReconStatus;
  problems: ProblemWallet[];
}

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const round4 = (n: number): number => Math.round(n * 10_000) / 10_000;

/** Un jour est « OK » seulement si rien n'est à signaler. */
export function statusOf(r: Pick<ReconRow, 'driftWallets' | 'negativeWallets' | 'reservedIssues'>): ReconStatus {
  return r.driftWallets > 0 || r.negativeWallets > 0 || r.reservedIssues > 0 ? 'ALERT' : 'OK';
}

const WALLET_CTE = Prisma.sql`
  WITH w AS (
    SELECT w.id, w.currency::text AS currency, w.balance, w."reservedBalance" AS reserved,
           COALESCE(w."clientId", u."clientId", a."clientId", m."clientId", 0) AS cid,
           CASE WHEN w."merchantId" IS NOT NULL THEN 'MERCHANT'
                WHEN w."agencyId"   IS NOT NULL THEN 'AGENCY'
                WHEN w."userId"     IS NOT NULL THEN 'USER'
                WHEN w."clientId"   IS NOT NULL THEN 'COMPANY'
                ELSE 'OTHER' END AS owner
    FROM wallets w
    LEFT JOIN users u             ON u.id = w."userId"
    LEFT JOIN agencies a          ON a.id = w."agencyId"
    LEFT JOIN merchant_profiles m ON m.id = w."merchantId"
  ), j AS (
    SELECT "walletId", SUM(CASE type WHEN 'CREDIT' THEN amount WHEN 'DEBIT' THEN -amount ELSE 0 END) AS net
    FROM ledger_entries GROUP BY "walletId"
  )`;

/** Calcule l'état de réconciliation à l'instant T (toutes sociétés). Lève en cas d'erreur de base : l'appelant décide quoi faire. */
export async function computeReconciliation(db: Db, tolerance: number = DEFAULT_TOLERANCE, maxProblemsPerRow = 20): Promise<ReconRow[]> {
  const tol = Math.max(0, tolerance);

  const agg = await db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    ${WALLET_CTE}
    SELECT w.cid::int AS cid, w.currency,
           COUNT(*)::int AS wallets,
           COALESCE(SUM(w.balance), 0)::text AS balance,
           COALESCE(SUM(COALESCE(j.net, 0)), 0)::text AS ledger,
           (COUNT(*) FILTER (WHERE ABS(w.balance - COALESCE(j.net, 0)) > ${tol}))::int AS drift_wallets,
           (COUNT(*) FILTER (WHERE w.balance < 0))::int AS negative_wallets,
           (COUNT(*) FILTER (WHERE w.reserved < 0 OR w.reserved > w.balance))::int AS reserved_issues
    FROM w LEFT JOIN j ON j."walletId" = w.id
    GROUP BY w.cid, w.currency`);

  const bad = await db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    ${WALLET_CTE}
    SELECT w.id, w.cid::int AS cid, w.currency, w.owner, w.balance::text AS balance, w.reserved::text AS reserved,
           COALESCE(j.net, 0)::text AS journal
    FROM w LEFT JOIN j ON j."walletId" = w.id
    WHERE ABS(w.balance - COALESCE(j.net, 0)) > ${tol} OR w.balance < 0 OR w.reserved < 0 OR w.reserved > w.balance
    ORDER BY ABS(w.balance - COALESCE(j.net, 0)) DESC, w.balance ASC
    LIMIT 500`);

  const transit = await db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT COALESCE("clientId", 0)::int AS cid, currency::text AS currency, COUNT(*)::int AS n, COALESCE(SUM(total), 0)::text AS amount
    FROM transactions
    WHERE status::text IN ('PENDING', 'VALIDATED', 'PROCESSING', 'ON_HOLD') AND "recipientId" IS NULL AND "payoutMethod"::text = 'CASH_PICKUP'
    GROUP BY "clientId", currency`);

  const key = (cid: unknown, cur: unknown) => `${num(cid)}|${String(cur)}`;
  const problemsBy = new Map<string, ProblemWallet[]>();
  for (const b of bad) {
    const balance = num(b.balance);
    const journal = num(b.journal);
    const reserved = num(b.reserved);
    const issues: ProblemWallet['issues'] = [];
    if (Math.abs(balance - journal) > tol) issues.push('DRIFT');
    if (balance < 0) issues.push('NEGATIVE');
    if (reserved < 0 || reserved > balance) issues.push('RESERVED');
    const list = problemsBy.get(key(b.cid, b.currency)) ?? [];
    if (list.length < maxProblemsPerRow) {
      list.push({ walletId: String(b.id), balance, journal, drift: round4(balance - journal), reserved, owner: String(b.owner) as ProblemWallet['owner'], issues });
    }
    problemsBy.set(key(b.cid, b.currency), list);
  }
  const transitBy = new Map<string, Record<string, unknown>>(transit.map((t) => [key(t.cid, t.currency), t]));

  const rows: ReconRow[] = agg.map((a) => {
    const k = key(a.cid, a.currency);
    const t = transitBy.get(k);
    const base = {
      clientId: num(a.cid),
      currency: String(a.currency),
      walletsCount: num(a.wallets),
      walletsBalance: round4(num(a.balance)),
      ledgerNet: round4(num(a.ledger)),
      drift: round4(num(a.balance) - num(a.ledger)),
      driftWallets: num(a.drift_wallets),
      negativeWallets: num(a.negative_wallets),
      reservedIssues: num(a.reserved_issues),
      inTransitCount: num(t?.n),
      inTransitAmount: round4(num(t?.amount)),
      problems: problemsBy.get(k) ?? [],
    };
    return { ...base, status: statusOf(base) };
  });
  return rows.sort((x, y) => x.clientId - y.clientId || x.currency.localeCompare(y.currency));
}

/** Texte court d'un écart, pour l'alerte. */
export function describeRow(r: ReconRow): string {
  const parts: string[] = [];
  if (r.driftWallets > 0) parts.push(`${r.driftWallets} portefeuille(s) dont le solde ne correspond pas au journal (écart cumulé ${r.drift} ${r.currency})`);
  if (r.negativeWallets > 0) parts.push(`${r.negativeWallets} solde(s) négatif(s)`);
  if (r.reservedIssues > 0) parts.push(`${r.reservedIssues} montant(s) réservé(s) incohérent(s)`);
  return parts.join(' ; ');
}
