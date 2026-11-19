// packages/shared/src/compliance.ts
// =========================================================
// CONFORMITÉ (lot 17) — contrat de apps/backend/src/compliance/  (administrateur de société)
//   GET  /compliance-admin/overview
//   GET  /compliance-admin/cases                 ?status=OPEN_ALL|OPEN|UNDER_REVIEW|ESCALATED|RESOLVED|CLOSED  &kind=SANCTION_MATCH|AML_RULE  &search=
//   POST /compliance-admin/cases/:id/action      TAKE | ESCALATE | RESOLVE | DISMISS | RELEASE | REJECT
//   GET|POST /compliance-admin/watchlist         PATCH|DELETE /compliance-admin/watchlist/:id
//   POST /compliance-admin/watchlist/import      POST /compliance-admin/watchlist/test      POST /compliance-admin/screen-customers
//   GET|PUT /compliance-admin/settings
//   GET /compliance-admin/official-lists · PUT …/:provider {enabled} · POST …/:provider/sync   (lot 17b : ONU · OFAC · UE)
// =========================================================

import type { HttpClient } from './http';

export type WatchlistKind = 'SANCTION' | 'PEP' | 'INTERNAL';
export type ComplianceCaseStatus = 'OPEN' | 'UNDER_REVIEW' | 'ESCALATED' | 'RESOLVED' | 'CLOSED';
export type ComplianceCaseKind = 'SANCTION_MATCH' | 'AML_RULE' | 'MANUAL';
export type ComplianceSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CaseAction = 'TAKE' | 'ESCALATE' | 'RESOLVE' | 'DISMISS' | 'RELEASE' | 'REJECT';

export interface WatchlistEntry {
  id: string;
  kind: WatchlistKind;
  fullName: string;
  aliases: string[];
  country: string | null;
  birthYear: number | null;
  reference: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface WatchlistEntryInput {
  kind: WatchlistKind;
  fullName: string;
  aliases?: string[];
  country?: string;
  birthYear?: number;
  reference?: string;
  notes?: string;
}

export interface NameMatch {
  entryId: string;
  kind: string;
  entryName: string;
  matchedOn: string;
  reference: string | null;
  /** UN | OFAC | EU pour une liste officielle ; null pour une fiche saisie par la société. */
  source?: string | null;
  subjectRole: string;
  subjectName: string;
  score: number;
}

export interface ComplianceCaseDetails {
  matches?: NameMatch[];
  held?: boolean;
  heldFrom?: string | null;
  reference?: string | null;
  amount?: number;
  currency?: string;
  score?: number;
  reasons?: string[];
  rules?: string[];
  customer?: boolean;
  thresholds?: { match: number; strong: number };
}

export interface ComplianceCase {
  id: string;
  reason: string;
  status: ComplianceCaseStatus;
  kind: ComplianceCaseKind | string;
  severity: ComplianceSeverity;
  details: ComplianceCaseDetails | null;
  assignedTo: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  createdAt: string;
  userId: string | null;
  transactionId: string | null;
  transaction: { id: string; reference: string; amount: number; currency: string; status: string } | null;
}

export type OfficialProvider = 'UN' | 'OFAC' | 'EU';
export type OfficialSyncStatus = 'NEVER' | 'RUNNING' | 'OK' | 'ERROR';

export interface OfficialList {
  provider: OfficialProvider;
  label: string;
  /** Une adresse de téléchargement est configurée sur le serveur (l'UE n'en a pas par défaut). */
  configured: boolean;
  /** Activée pour cette société. */
  enabled: boolean;
  status: OfficialSyncStatus;
  error: string | null;
  entryCount: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  added: number;
  updated: number;
  removed: number;
  /** Dernière mise à jour réussie il y a plus de 3 jours. */
  stale: boolean;
}

export interface ComplianceSettings {
  sanctionsEnabled: boolean;
  matchThreshold: number;
  strongMatchThreshold: number;
  holdOnStrongMatch: boolean;
  /** Listes officielles activées : UN | OFAC | EU. */
  officialLists: OfficialProvider[];
  /** null = valeur de la plateforme. */
  amlThresholdXof: number | null;
  amlFlagScore: number | null;
  highRiskCountries: string[];
  /** 0 ou 1 désactive la règle. */
  structuringCount: number;
  fanInSenders: number;
  configured: boolean;
  platform: { amlThresholdXof: number; amlFlagScore: number };
}

export type ComplianceSettingsInput = Partial<Omit<ComplianceSettings, 'configured' | 'platform'>>;

export interface ComplianceOverview {
  open: number;
  byStatus: Record<string, number>;
  openBySeverity: Record<string, number>;
  heldTransactions: number;
  sanctionCases30d: number;
  amlCases30d: number;
  watchlist: Record<string, number>;
  settings: Omit<ComplianceSettings, 'platform'>;
  recentOpen: { id: string; reason: string; kind: string; severity: ComplianceSeverity; status: ComplianceCaseStatus; createdAt: string; transactionId: string | null }[];
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: { line: number; message: string }[];
}

export function createComplianceApi(http: HttpClient) {
  const q = (params: Record<string, string | undefined>) => {
    const s = Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&');
    return s ? `?${s}` : '';
  };
  return {
    overview: () => http.get<ComplianceOverview>('/compliance-admin/overview'),
    cases: (p: { status?: string; kind?: string; search?: string } = {}) => http.get<{ items: ComplianceCase[] }>(`/compliance-admin/cases${q(p)}`),
    actOnCase: (id: string, action: CaseAction, note?: string) => http.post<ComplianceCase>(`/compliance-admin/cases/${encodeURIComponent(id)}/action`, { action, note }),

    watchlist: (p: { kind?: string; search?: string; active?: string } = {}) => http.get<{ items: WatchlistEntry[] }>(`/compliance-admin/watchlist${q(p)}`),
    createEntry: (input: WatchlistEntryInput) => http.post<WatchlistEntry>('/compliance-admin/watchlist', input),
    updateEntry: (id: string, input: Partial<WatchlistEntryInput> & { isActive?: boolean }) => http.patch<WatchlistEntry>(`/compliance-admin/watchlist/${encodeURIComponent(id)}`, input),
    removeEntry: (id: string) => http.delete<{ ok: true }>(`/compliance-admin/watchlist/${encodeURIComponent(id)}`),
    importEntries: (kind: WatchlistKind, text: string) => http.post<ImportResult>('/compliance-admin/watchlist/import', { kind, text }),
    testName: (name: string) => http.post<{ matches: NameMatch[]; threshold: number; strongThreshold: number }>('/compliance-admin/watchlist/test', { name }),
    screenCustomers: () => http.post<{ checked: number; cases: number }>('/compliance-admin/screen-customers', {}),

    officialLists: () => http.get<OfficialList[]>('/compliance-admin/official-lists'),
    setOfficialList: (provider: OfficialProvider, enabled: boolean) => http.request<OfficialList[]>(`/compliance-admin/official-lists/${provider}`, { method: 'PUT', body: { enabled } }),
    syncOfficialList: (provider: OfficialProvider) => http.post<unknown>(`/compliance-admin/official-lists/${provider}/sync`, {}),

    settings: () => http.get<ComplianceSettings>('/compliance-admin/settings'),
    saveSettings: (input: ComplianceSettingsInput) => http.request<ComplianceSettings>('/compliance-admin/settings', { method: 'PUT', body: input }),
  };
}
