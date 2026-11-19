// packages/shared/src/reconciliation.ts
// =========================================================
// RÉCONCILIATION QUOTIDIENNE (audit argent I3) — contrat de apps/backend/src/reconciliation/
//   GET  /reconciliation?days=14   dernier rapport par devise + historique (SUPER_ADMIN : tout ; COMPANY_ADMIN : sa société)
//   POST /reconciliation/run       relance le contrôle maintenant (SUPER_ADMIN)
// =========================================================

import type { HttpClient } from './http';

export type ReconciliationStatus = 'OK' | 'ALERT';

export interface ReconciliationProblem {
  walletId: string;
  balance: number;
  journal: number;
  drift: number;
  reserved: number;
  owner: 'USER' | 'AGENCY' | 'COMPANY' | 'MERCHANT' | 'OTHER';
  issues: Array<'DRIFT' | 'NEGATIVE' | 'RESERVED'>;
}

export interface ReconciliationRow {
  id: string;
  /** 0 = portefeuilles rattachés à aucune société (plateforme). */
  clientId: number;
  currency: string;
  status: ReconciliationStatus;
  walletsCount: number;
  walletsBalance: number;
  ledgerNet: number;
  drift: number;
  driftWallets: number;
  negativeWallets: number;
  reservedIssues: number;
  inTransitCount: number;
  inTransitAmount: number;
  problems: ReconciliationProblem[];
  updatedAt: string;
}

export interface ReconciliationOverview {
  lastRunDate: string | null;
  status: ReconciliationStatus | 'NEVER';
  rows: ReconciliationRow[];
  history: Array<{ runDate: string; lines: number; alerts: number }>;
}

export interface ReconciliationRunResult {
  runDate: string;
  lines: number;
  alerts: number;
  status: ReconciliationStatus;
}

export function createReconciliationApi(http: HttpClient) {
  return {
    overview: (days = 14) => http.get<ReconciliationOverview>(`/reconciliation?days=${encodeURIComponent(String(days))}`),
    run: () => http.post<ReconciliationRunResult>('/reconciliation/run', {}),
  };
}
