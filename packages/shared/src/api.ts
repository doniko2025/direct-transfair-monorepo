// packages/shared/src/api.ts
// =========================================================
// ENDPOINTS v2.0 — + portalDomains (domaine du portail de chaque société : Cloudflare + Vercel, suivi de statut).
// ENDPOINTS v1.9 — + auth.platformSso (connexion unique depuis la console dkmoney.store).
// ENDPOINTS v1.8 — auth + branding (phase 1), sociétés, utilisateurs, transactions, trésorerie, supervision, taux de change, frais et notifications (phase 2), agences, agents, barème de frais, répartition et commissions (phase 3), guichet de l'agent (phase 4), seuil de validation et plafonds d'envoi (phase 6).
// Chaque phase ajoute ses groupes d'endpoints ici (agencies,
// treasury, transactions…) en lisant le contrôleur backend
// correspondant, pas en recopiant services/api.ts du mobile.
// =========================================================

import { createAgenciesApi } from './agencies';
import { createAgentDeskApi } from './agentDesk';
import { createAgentsApi } from './agents';
import { createCommissionRulesApi } from './commissionRules';
import { createCommissionsApi } from './commissions';
import { createCompaniesApi } from './companies';
import { createFeeScheduleApi } from './feeSchedule';
import { createFeesApi } from './fees';
import type { HttpClient } from './http';
import { createNotificationsApi } from './notifications';
import { createPortalDomainsApi } from './portalDomains';
import { createRatesApi } from './rates';
import { createSupervisionApi } from './supervision';
import { createTransactionsApi } from './transactions';
import { createTransferLimitsApi } from './transferLimits';
import { createTreasuryApi } from './treasury';
import { createUsersApi } from './users';
import { createValidationThresholdsApi } from './validationThresholds';
import { PLATFORM_TENANT } from './tenant';
import type {
  AuthUser,
  LoginPasswordResult,
  LoginResult,
  TenantBranding,
  VerificationChannel,
  VerifyContactResult,
} from './types';

/**
 * Les routes /branding/* sont publiques mais le TenantGuard global du
 * backend exige quand même un en-tête x-tenant-id : le mobile envoie
 * "DONIKO" sur ces appels, on fait pareil.
 */
const PLATFORM_HEADERS = { 'x-tenant-id': PLATFORM_TENANT } as const;

export function createApi(http: HttpClient) {
  return {
    companies: createCompaniesApi(http),
    users: createUsersApi(http),
    transactions: createTransactionsApi(http),
    treasury: createTreasuryApi(http),
    supervision: createSupervisionApi(http),
    rates: createRatesApi(http),
    fees: createFeesApi(http),
    notifications: createNotificationsApi(http),
    agencies: createAgenciesApi(http),
    agents: createAgentsApi(http),
    feeSchedule: createFeeScheduleApi(http),
    commissionRules: createCommissionRulesApi(http),
    commissions: createCommissionsApi(http),
    agentDesk: createAgentDeskApi(http),
    validationThresholds: createValidationThresholdsApi(http),
    transferLimits: createTransferLimitsApi(http),
    portalDomains: createPortalDomainsApi(http),

    branding: {
      byHost: (host: string) =>
        http.get<TenantBranding>(`/branding/by-host?host=${encodeURIComponent(host)}`, {
          auth: false,
          headers: { ...PLATFORM_HEADERS },
        }),
      byCode: (code: string) =>
        http.get<TenantBranding>(`/branding/${encodeURIComponent(code)}`, {
          auth: false,
          headers: { ...PLATFORM_HEADERS },
        }),
    },

    auth: {
      loginPassword: (email: string, password: string) =>
        http.post<LoginPasswordResult>(
          '/auth/v2/login-password',
          { email, password },
          { auth: false },
        ),

      /** Connexion unique depuis la console dkmoney.store (assertion signée de 60 s, usage unique). */
      platformSso: (assertion: string) =>
        http.post<LoginResult>('/auth/platform-sso', { assertion }, { auth: false }),

      sendVerification: (userId: string, channel: VerificationChannel) =>
        http.post<unknown>('/auth/v2/send-verification', { userId, channel }, { auth: false }),

      verifyContact: (userId: string, code: string, channel: VerificationChannel) =>
        http.post<VerifyContactResult>(
          '/auth/v2/verify-contact',
          { userId, code, channel },
          { auth: false },
        ),

      me: () => http.get<AuthUser>('/auth/me'),

      logout: () => http.post<unknown>('/auth/logout'),
    },
  };
}

export type Api = ReturnType<typeof createApi>;
