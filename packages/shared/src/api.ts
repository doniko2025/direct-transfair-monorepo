// packages/shared/src/api.ts
// =========================================================
// ENDPOINTS v1.4 — auth + branding (phase 1), sociétés, utilisateurs, transactions, trésorerie, supervision et taux de change (phase 2).
// Chaque phase ajoute ses groupes d'endpoints ici (agencies,
// treasury, transactions…) en lisant le contrôleur backend
// correspondant, pas en recopiant services/api.ts du mobile.
// =========================================================

import { createCompaniesApi } from './companies';
import type { HttpClient } from './http';
import { createRatesApi } from './rates';
import { createSupervisionApi } from './supervision';
import { createTransactionsApi } from './transactions';
import { createTreasuryApi } from './treasury';
import { createUsersApi } from './users';
import { PLATFORM_TENANT } from './tenant';
import type {
  AuthUser,
  LoginPasswordResult,
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
