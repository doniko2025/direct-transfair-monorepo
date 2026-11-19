// packages/shared/src/pilotage.ts
// =========================================================
// PILOTAGE (lot 15) — contrat de apps/backend/src/pilotage/
//   Agent :
//     GET   /pilotage/closing/today?tz        caisse de l'agence : soldes théoriques + clôtures du jour
//     POST  /pilotage/closing                 clôture de caisse
//   Administrateur de société :
//     GET   /pilotage/closings                clôtures + caisses non clôturées
//     PATCH /pilotage/closings/:id/review     écart examiné
//     GET   /pilotage/liquidity               niveaux de caisse + seuils
//     PUT   /pilotage/liquidity-rules         DELETE /pilotage/liquidity-rules/:id
//     GET   /pilotage/profitability           rentabilité par couloir
//     GET   /pilotage/agents                  objectifs et classement
//     PUT   /pilotage/agents/:id/target       DELETE /pilotage/agents/:id/target?month=
//     GET   /pilotage/export/(transactions|closings|profitability).csv
//     GET   /pilotage/report/monthly
// =========================================================

import type { HttpClient } from './http';

export type VarianceSeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
export type LiquidityLevel = 'OK' | 'WARN' | 'LOW' | 'CRITICAL';

export interface CashClosing {
  id: string;
  agencyId: string;
  agentId: string;
  /** Jour local « AAAA-MM-JJ ». */
  day: string;
  currency: string;
  expectedAmount: number;
  countedAmount: number;
  /** Compté − théorique : négatif = manque, positif = excédent. */
  variance: number;
  severity: VarianceSeverity;
  opsCount: number;
  note: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  closedAt: string;
}

export interface CashClosingAdmin extends CashClosing {
  agencyName: string;
  agentName: string;
}

export interface ClosingToday {
  day: string;
  agency: { id: string; name: string; city: string };
  items: { currency: string; expectedAmount: number; opsCount: number; closing: CashClosing | null }[];
}

export interface CloseCashInput {
  currency: string;
  countedAmount: number | string;
  note?: string;
  tzOffsetMin?: number;
}

export interface MissingClosing {
  agencyId: string;
  agencyName: string;
  currency: string;
  expectedAmount: number;
}

export interface ClosingsReport {
  from: string;
  to: string;
  closings: CashClosingAdmin[];
  missing: MissingClosing[];
  summary: { count: number; withVariance: number; toReview: number; missing: number };
}

export interface ClosingsQuery {
  day?: string;
  from?: string;
  to?: string;
  onlyVariance?: boolean;
}

export interface LiquidityItem {
  agencyId: string;
  agencyName: string;
  city: string;
  currency: string;
  balance: number;
  reserved: number;
  minBalance: number | null;
  level: LiquidityLevel;
}

export interface LiquidityRule {
  id: string;
  agencyId: string | null;
  agencyName: string | null;
  currency: string;
  minBalance: number;
  isActive: boolean;
}

export interface LiquidityOverview {
  items: LiquidityItem[];
  rules: LiquidityRule[];
  summary: { critical: number; low: number; warn: number; ok: number };
}

export interface LiquidityRuleInput {
  /** Absent ou null = toutes les agences. */
  agencyId?: string | null;
  currency: string;
  minBalance: number | string;
  isActive?: boolean;
}

export interface CorridorRow {
  corridor: string;
  currency: string;
  targetCurrency: string | null;
  count: number;
  sent: number;
  received: number;
  fees: number;
  agentCommissions: number;
  platformShare: number;
  /** Marge nette estimée : frais − commissions des agents − part de la plateforme. */
  net: number;
  marginPct: number;
}

export interface PilotageCurrencyTotal {
  currency: string;
  count: number;
  sent: number;
  fees: number;
  net: number;
}

export interface ProfitabilityReport {
  from: string;
  to: string;
  corridors: CorridorRow[];
  totals: PilotageCurrencyTotal[];
}

export interface PeriodQuery {
  from?: string;
  to?: string;
}

export interface AgentTarget {
  currency: string;
  targetAmount: number;
  targetOperations: number;
}

export interface AgentProgress {
  amountPct: number | null;
  operationsPct: number | null;
  pct: number | null;
  reached: boolean;
}

export interface AgentBoardRow {
  rank: number;
  agentId: string;
  name: string;
  agencyName: string | null;
  isActive: boolean;
  operations: number;
  volume: Record<string, number>;
  fees: Record<string, number>;
  target: AgentTarget | null;
  progress: AgentProgress;
}

export interface AgentsBoard {
  month: string;
  rows: AgentBoardRow[];
}

export interface AgentTargetInput {
  month: string;
  currency: string;
  targetAmount?: number | string;
  targetOperations?: number;
}

export interface MonthlyReport {
  month: string;
  totals: PilotageCurrencyTotal[];
  corridors: CorridorRow[];
  topAgents: AgentBoardRow[];
  closings: { count: number; withVariance: number; unreviewed: number };
}

export type PilotageExport = 'transactions' | 'closings' | 'profitability';

/** Décalage du fuseau de l'appareil en minutes en plus de l'UTC (Paris hiver : +60). */
export function deviceTzOffsetMin(): number {
  return -new Date().getTimezoneOffset();
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function createPilotageApi(http: HttpClient) {
  const tz = () => deviceTzOffsetMin();
  return {
    // Agent
    closingToday: () => http.get<ClosingToday>(`/pilotage/closing/today${qs({ tz: tz() })}`),
    closeCash: (input: CloseCashInput) => http.post<CashClosing>('/pilotage/closing', { tzOffsetMin: tz(), ...input }),

    // Administrateur : caisses
    closings: (q: ClosingsQuery = {}) => http.get<ClosingsReport>(`/pilotage/closings${qs({ ...q, tz: tz() })}`),
    reviewClosing: (id: string, note?: string) => http.patch<CashClosing>(`/pilotage/closings/${encodeURIComponent(id)}/review`, { note }),

    // Administrateur : liquidité
    liquidity: () => http.get<LiquidityOverview>('/pilotage/liquidity'),
    saveLiquidityRule: (input: LiquidityRuleInput) => http.request<LiquidityRule>('/pilotage/liquidity-rules', { method: 'PUT', body: input }),
    deleteLiquidityRule: (id: string) => http.delete<{ ok: true }>(`/pilotage/liquidity-rules/${encodeURIComponent(id)}`),

    // Administrateur : rentabilité, objectifs
    profitability: (q: PeriodQuery = {}) => http.get<ProfitabilityReport>(`/pilotage/profitability${qs({ ...q, tz: tz() })}`),
    agents: (month?: string) => http.get<AgentsBoard>(`/pilotage/agents${qs({ month, tz: tz() })}`),
    saveTarget: (agentId: string, input: AgentTargetInput) =>
      http.request<{ agentId: string; month: string } & AgentTarget>(`/pilotage/agents/${encodeURIComponent(agentId)}/target`, { method: 'PUT', body: input }),
    deleteTarget: (agentId: string, month: string) => http.delete<{ ok: true }>(`/pilotage/agents/${encodeURIComponent(agentId)}/target${qs({ month })}`),

    // Administrateur : exports et rapport
    exportCsv: (kind: PilotageExport, q: PeriodQuery = {}) => http.get<Blob>(`/pilotage/export/${kind}.csv${qs({ ...q, tz: tz() })}`, { responseType: 'blob' }),
    monthlyReport: (month?: string) => http.get<MonthlyReport>(`/pilotage/report/monthly${qs({ month, tz: tz() })}`),
  };
}
