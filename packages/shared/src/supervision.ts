// packages/shared/src/supervision.ts
// =========================================================
// SUPERVISION — SUPER_ADMIN (toute la plateforme) ; COMPANY_ADMIN (sa société) côté serveur
//
// Contrat : apps/backend/src/supervision/ (module créé avec cette phase — le mobile appelait
// /audit-logs et /alerts, qui n'existaient pas).
//   GET   /supervision/overview                santé base, activité 24 h, sécurité, sociétés, points d'attention
//   GET   /supervision/audit-logs?page&limit&action&successful&clientId
//   GET   /supervision/alerts?page&limit&status&severity&clientId      status = open | resolved | all
//   PATCH /supervision/alerts/:id/resolve
// =========================================================

import type { HttpClient } from './http';

export type HealthStatus = 'ok' | 'warn' | 'error';

export type AttentionKind =
  | 'STUCK_TRANSACTIONS'
  | 'ON_HOLD_TRANSACTIONS'
  | 'LOCKED_ACCOUNTS'
  | 'SUSPENDED_COMPANIES'
  | 'EXPIRED_COMPANIES'
  | 'EXPIRING_SUBSCRIPTIONS'
  | 'CRITICAL_ALERTS';

export interface AttentionItem {
  kind: AttentionKind;
  severity: 'warn' | 'danger';
  count: number;
}

/** Présent pour le super admin uniquement (null pour un admin de société). La société de la plateforme n'est pas comptée. */
export interface CompaniesSummary {
  total: number;
  active: number;
  trial: number;
  suspended: number;
  expired: number;
  inactive: number;
  expiringSoon: number;
}

export interface SupervisionOverview {
  generatedAt: string;
  scope: 'PLATFORM' | 'COMPANY';
  health: {
    database: { status: HealthStatus; latencyMs: number | null };
    api: { status: HealthStatus; uptimeSeconds: number };
  };
  companies: CompaniesSummary | null;
  last24h: { transactions: number; failedTransactions: number };
  security: {
    failedOtp24h: number;
    lockouts24h: number;
    suspicious24h: number;
    lockedAccountsNow: number;
  };
  alerts: { open: number; critical: number };
  attention: AttentionItem[];
}

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertType =
  | 'SUSPICIOUS_TRANSACTION'
  | 'LARGE_WITHDRAWAL'
  | 'MULTIPLE_FAILED_LOGIN'
  | 'LOW_AGENCY_BALANCE'
  | 'SUBSCRIPTION_EXPIRY'
  | 'KYC_EXPIRED'
  | 'AML_FLAG'
  | 'RATE_ALERT_TRIGGERED'
  | 'SCHEDULED_TRANSFER_FAILED'
  | 'DEVICE_NEW_LOGIN';

export interface AlertCompanyRef {
  id: number;
  name: string;
  code: string;
}

export interface SupervisionAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  isResolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
  client: AlertCompanyRef | null;
}

export interface AuditActor {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
}

/** Valeurs de l'enum AuditAction du backend (le serveur peut en ajouter : toujours prévoir un libellé de repli). */
export type AuditAction = string;

export interface AuditEntry {
  id: string;
  action: AuditAction;
  entity: string | null;
  entityId: string | null;
  ipAddress: string | null;
  country: string | null;
  successful: boolean;
  errorMsg: string | null;
  createdAt: string;
  user: AuditActor | null;
  client: AlertCompanyRef | null;
}

export interface Page<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface AuditFilters {
  action?: AuditAction;
  /** false = échecs uniquement. */
  successful?: boolean;
  clientId?: number;
}

export interface AlertFilters {
  status?: 'open' | 'resolved' | 'all';
  severity?: AlertSeverity;
  clientId?: number;
}

function query(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) qs.set(key, String(value));
  }
  const text = qs.toString();
  return text ? `?${text}` : '';
}

export function createSupervisionApi(http: HttpClient) {
  return {
    overview: () => http.get<SupervisionOverview>('/supervision/overview'),

    auditLogs: (page: number, limit: number, filters: AuditFilters = {}) =>
      http.get<Page<AuditEntry>>(`/supervision/audit-logs${query({ page, limit, ...filters })}`),

    alerts: (page: number, limit: number, filters: AlertFilters = {}) =>
      http.get<Page<SupervisionAlert>>(`/supervision/alerts${query({ page, limit, ...filters })}`),

    resolveAlert: (id: string) =>
      http.patch<{ id: string; isResolved: true }>(`/supervision/alerts/${encodeURIComponent(id)}/resolve`),
  };
}
