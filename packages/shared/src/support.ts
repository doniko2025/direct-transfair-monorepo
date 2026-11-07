// packages/shared/src/support.ts
// =========================================================
// SERVICE CLIENT (lot 9) — compte SUPPORT, délégations par interrupteurs, bureau d'assistance, litiges, remboursements.
//
// Contrat : apps/backend/src/support
//   ADMIN   GET  /support-staff/catalog                 catalogue des délégations (libellés, groupes, implications)
//           GET  /support-staff                         comptes du service client de la société
//           POST /support-staff                         crée un compte (mot de passe temporaire renvoyé une seule fois)
//           PATCH /support-staff/:id                    prénom / nom / téléphone
//           PUT  /support-staff/:id/permissions         { permissions } — liste COMPLÈTE des interrupteurs actifs
//           PATCH /support-staff/:id/active             { active } suspend / réactive
//           POST /support-staff/:id/reset-password
//   BUREAU  GET  /support-desk/overview                 compteurs + délégations
//           GET  /support-desk/clients[/:id]            CLIENTS_VIEW
//           PATCH /support-desk/clients/:id/suspend     ACCOUNT_SUSPEND  { reason }
//           PATCH /support-desk/clients/:id/reactivate  ACCOUNT_REACTIVATE
//           GET  /support-desk/transactions[/:id]       TRANSACTIONS_VIEW
//           GET  /support-desk/tickets[/:id]            TICKETS_HANDLE
//           POST /support-desk/tickets/:id/(take|reply|resolve|close)
//           GET/POST /support-desk/refunds              REFUNDS_DECIDE ou DISPUTES_RESOLVE
//           POST /support-desk/refunds/:id/decide       REFUNDS_DECIDE — jamais sur sa propre demande (sauf administrateur)
//   CLIENT  POST/GET /support/tickets[/:id]  POST /support/tickets/:id/reply      (application mobile)
//
// Les délégations sont lues en base à chaque requête : un interrupteur coupé retire l'accès tout de suite. Une action non déléguée
// reçoit 403 { code: 'PERMISSION_REQUIRED' } → isPermissionError().
// =========================================================

import { ApiError } from './http';
import type { HttpClient } from './http';

export const SUPPORT_PERMISSIONS = [
  'CLIENTS_VIEW',
  'KYC_REVIEW',
  'KYC_COUNTER',
  'ACCOUNT_SUSPEND',
  'ACCOUNT_REACTIVATE',
  'TICKETS_HANDLE',
  'DISPUTES_RESOLVE',
  'REFUNDS_DECIDE',
  'TRANSACTIONS_VIEW',
] as const;
export type SupportPermission = (typeof SUPPORT_PERMISSIONS)[number];

export interface SupportPermissionMeta {
  key: SupportPermission;
  group: 'COMPTES' | 'CONFORMITE' | 'ASSISTANCE' | 'ARGENT';
  label: string;
  description: string;
  implies: SupportPermission[];
  sensitive: boolean;
}

export const SUPPORT_GROUP_LABEL: Record<SupportPermissionMeta['group'], string> = {
  COMPTES: 'Comptes clients',
  CONFORMITE: 'Conformité (KYC)',
  ASSISTANCE: 'Assistance',
  ARGENT: 'Argent',
};

/** Ajoute les délégations impliquées (même règle que le serveur, pour l'affichage des interrupteurs verrouillés). */
export function expandSupportPermissions(granted: readonly string[], catalog: readonly SupportPermissionMeta[]): SupportPermission[] {
  const meta = new Map(catalog.map((m) => [m.key, m]));
  const out = new Set<SupportPermission>(granted.filter((p): p is SupportPermission => meta.has(p as SupportPermission)));
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of Array.from(out)) {
      for (const dep of meta.get(p)?.implies ?? []) {
        if (!out.has(dep)) {
          out.add(dep);
          grew = true;
        }
      }
    }
  }
  return SUPPORT_PERMISSIONS.filter((p) => out.has(p));
}

/** Un administrateur a toutes les délégations ; un compte SUPPORT seulement celles qui sont actives. */
export function can(
  user: { role?: string | null; supportPermissions?: readonly string[] | null } | null | undefined,
  ...anyOf: SupportPermission[]
): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN' || user.role === 'COMPANY_ADMIN') return true;
  if (user.role !== 'SUPPORT') return false;
  const have = user.supportPermissions ?? [];
  return anyOf.some((p) => have.includes(p));
}

export function isPermissionError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && err.code === 'PERMISSION_REQUIRED';
}

// ─── Personnel ───────────────────────────────────────────
export interface SupportStaff {
  id: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  /** Interrupteurs posés. */
  permissions: SupportPermission[];
  /** Droits réellement exercés (interrupteurs + implications). */
  effectivePermissions: SupportPermission[];
}

export interface CreateSupportStaffInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  permissions?: SupportPermission[];
}

// ─── Bureau ──────────────────────────────────────────────
export interface SupportOverview {
  permissions: string[] | null;
  counts: { tickets: number | null; disputes: number | null; refunds: number | null; kyc: number | null };
}

export interface SupportClient {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  country: string | null;
  kycLevel: string;
  suspended: boolean;
  suspendedAt: string | null;
  suspendedReason: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface SupportTransaction {
  id: string;
  reference: string;
  type: string;
  status: string;
  amount: number;
  fees: number;
  total: number;
  currency: string;
  targetCurrency: string | null;
  receivedAmount: number | null;
  payoutMethod: string;
  createdAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  isFlagged: boolean;
  sender: { id: string; name: string } | null;
}

export interface Paged<T> {
  page: number;
  limit: number;
  total: number;
  items: T[];
}

export interface RefundRequestLite {
  id: string;
  status: RefundStatus;
  amount: number;
  currency: string;
  createdAt: string;
}

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'RESOLVED' | 'CLOSED';
export type TicketOutcome = 'ACCEPTED' | 'REJECTED' | 'INFO';
export type RefundStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FAILED';

export interface Ticket {
  id: string;
  subject: string;
  message: string;
  category: string | null;
  status: TicketStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  isDispute: boolean;
  transactionId: string | null;
  outcome: TicketOutcome | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Vue du service client uniquement. */
  assignedTo?: string | null;
  user?: { id: string; name: string; email: string; phone: string | null } | null;
  repliesCount?: number;
}

export interface TicketReply {
  id: string;
  message: string;
  internal: boolean;
  createdAt: string;
  fromMe: boolean;
  author: { name: string; isStaff: boolean };
}

export interface TicketList extends Paged<Ticket> {
  byStatus: Partial<Record<TicketStatus, number>>;
}

export interface TicketDetail {
  ticket: Ticket;
  replies: TicketReply[];
  transaction: SupportTransaction | null;
  refundRequests: RefundRequestLite[];
}

export interface RefundRequest {
  id: string;
  transactionId: string;
  ticketId: string | null;
  amount: number;
  currency: string;
  reason: string;
  status: RefundStatus;
  requestedById: string;
  decidedById: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  reference?: string | null;
  transactionStatus?: string | null;
  customer?: string | null;
  requestedBy?: string | null;
  decidedBy?: string | null;
  /** Faux pour une demande que le compte a lui-même créée (règle des quatre yeux) ou déjà traitée. */
  canDecide?: boolean;
}

export interface RefundList extends Paged<RefundRequest> {
  pending: number;
}

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Ouverte',
  IN_PROGRESS: 'En cours',
  WAITING_USER: 'Réponse du client attendue',
  RESOLVED: 'Traitée',
  CLOSED: 'Clôturée',
};
export const OUTCOME_LABEL: Record<TicketOutcome, string> = {
  ACCEPTED: 'Accepté (en faveur du client)',
  REJECTED: 'Rejeté',
  INFO: 'Réponse / information',
};
export const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  PENDING: 'À valider',
  APPROVED: 'Remboursé',
  REJECTED: 'Refusé',
  FAILED: 'À traiter hors plateforme',
};

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function createSupportApi(http: HttpClient) {
  const enc = encodeURIComponent;
  return {
    // Personnel (administrateur de société)
    catalog: async (): Promise<SupportPermissionMeta[]> => (await http.get<{ permissions: SupportPermissionMeta[] }>('/support-staff/catalog')).permissions,
    listStaff: async (): Promise<SupportStaff[]> => (await http.get<{ data: SupportStaff[] }>('/support-staff')).data ?? [],
    createStaff: (input: CreateSupportStaffInput) => http.post<{ staff: SupportStaff; generatedPassword: string }>('/support-staff', input),
    updateStaff: (id: string, input: { firstName?: string; lastName?: string; phone?: string }) => http.patch<SupportStaff>(`/support-staff/${enc(id)}`, input),
    setPermissions: (id: string, permissions: SupportPermission[]) =>
      http.request<SupportStaff>(`/support-staff/${enc(id)}/permissions`, { method: 'PUT', body: { permissions } }),
    setStaffActive: (id: string, active: boolean) => http.patch<SupportStaff>(`/support-staff/${enc(id)}/active`, { active }),
    resetStaffPassword: (id: string) => http.post<{ generatedPassword: string }>(`/support-staff/${enc(id)}/reset-password`, {}),

    // Bureau d'assistance
    overview: () => http.get<SupportOverview>('/support-desk/overview'),
    clients: (q: { search?: string; status?: 'ALL' | 'ACTIVE' | 'SUSPENDED'; page?: number; limit?: number } = {}) =>
      http.get<Paged<SupportClient>>(`/support-desk/clients${qs(q)}`),
    client: (id: string) =>
      http.get<{ client: SupportClient; recentTransactions: SupportTransaction[] | null; openTickets: number | null }>(`/support-desk/clients/${enc(id)}`),
    suspendClient: (id: string, reason: string) => http.patch<SupportClient>(`/support-desk/clients/${enc(id)}/suspend`, { reason }),
    reactivateClient: (id: string) => http.patch<SupportClient>(`/support-desk/clients/${enc(id)}/reactivate`, {}),

    transactions: (q: { search?: string; status?: string; page?: number; limit?: number } = {}) => http.get<Paged<SupportTransaction>>(`/support-desk/transactions${qs(q)}`),
    transaction: (id: string) =>
      http.get<{ transaction: SupportTransaction; refundable: boolean; refundRequests: RefundRequestLite[] }>(`/support-desk/transactions/${enc(id)}`),

    tickets: (q: { status?: string; kind?: 'DISPUTE' | 'REQUEST'; search?: string; mine?: boolean; page?: number; limit?: number } = {}) =>
      http.get<TicketList>(`/support-desk/tickets${qs(q)}`),
    ticket: (id: string) => http.get<TicketDetail>(`/support-desk/tickets/${enc(id)}`),
    takeTicket: (id: string) => http.post<TicketDetail>(`/support-desk/tickets/${enc(id)}/take`, {}),
    replyTicket: (id: string, message: string, internal = false) => http.post<TicketDetail>(`/support-desk/tickets/${enc(id)}/reply`, { message, internal }),
    resolveTicket: (id: string, outcome: TicketOutcome, note: string) => http.post<TicketDetail>(`/support-desk/tickets/${enc(id)}/resolve`, { outcome, note }),
    closeTicket: (id: string) => http.post<TicketDetail>(`/support-desk/tickets/${enc(id)}/close`, {}),

    refunds: (q: { status?: RefundStatus; page?: number; limit?: number } = {}) => http.get<RefundList>(`/support-desk/refunds${qs(q)}`),
    requestRefund: (input: { transactionId: string; reason: string; ticketId?: string }) => http.post<RefundRequest>('/support-desk/refunds', input),
    decideRefund: (id: string, approve: boolean, note?: string) => http.post<RefundRequest>(`/support-desk/refunds/${enc(id)}/decide`, { approve, note }),

    // Côté client (application mobile)
    myTickets: () => http.get<{ items: Ticket[] }>('/support/tickets'),
    myTicket: (id: string) => http.get<{ ticket: Ticket; replies: TicketReply[] }>(`/support/tickets/${enc(id)}`),
    openTicket: (input: { subject: string; message: string; category?: string; transactionId?: string }) => http.post<Ticket>('/support/tickets', input),
    replyMyTicket: (id: string, message: string) => http.post<{ ticket: Ticket; replies: TicketReply[] }>(`/support/tickets/${enc(id)}/reply`, { message }),
  };
}
