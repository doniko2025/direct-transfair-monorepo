// packages/shared/src/users.ts
// =========================================================
// UTILISATEURS — SUPER_ADMIN (toute la plateforme) et COMPANY_ADMIN (sa société)
//
// Contrat relevé dans apps/backend/src/users/users.controller.ts :
//   GET    /users                 liste (non paginée côté serveur, comptes supprimés exclus)
//   GET    /users/:id             fiche complète (hash et secrets retirés par le serveur)
//   POST   /users                 création (⚠ le serveur laisse choisir n'importe quel rôle)
//   PATCH  /users/:id             mise à jour (liste blanche côté serveur)
//   PATCH  /users/:id/suspend     suspension (effective immédiatement, jetons compris)
//   PATCH  /users/:id/reactivate  réactivation
//   DELETE /users/:id             suppression logique
// =========================================================

import type { Company, CurrencyCode } from './companies';
import type { HttpClient } from './http';

export type KycLevel = 'LEVEL_0' | 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
export type ComplianceStatus = 'CLEAR' | 'REVIEW' | 'BLOCKED';

export interface UserWallet {
  id: number | string;
  currency: CurrencyCode;
  balance: string | number;
  reservedBalance?: string | number;
  availableBalance?: number;
  isDefault?: boolean;
  isFrozen?: boolean;
}

export interface UserSummary {
  id: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  /** SUPER_ADMIN | COMPANY_ADMIN | AGENT | USER */
  role: string;
  country: string | null;
  city: string | null;
  primaryCurrency: CurrencyCode | null;
  kycLevel: KycLevel | null;
  complianceStatus: ComplianceStatus | null;
  isActive: boolean;
  isSuspended: boolean;
  deletedAt: string | null;
  createdAt: string;
  client?: { name: string; code: string } | null;
  agency?: { name: string; id: number | string } | null;
  wallets?: UserWallet[];
}

export interface UserDetail extends Omit<UserSummary, 'client'> {
  clientId?: number | null;
  agencyId?: number | string | null;
  client?: Partial<Company> | null;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  mfaEnabled?: boolean;
  suspendedAt?: string | null;
  suspendedReason?: string | null;
  lastLoginAt?: string | null;
  jobTitle?: string | null;
  gender?: string | null;
  nationality?: string | null;
  birthDate?: string | null;
  addressStreet?: string | null;
  postalCode?: string | null;
  preferredLanguage?: string | null;
}

/** Corps de POST /users. `clientId` n'est lu que pour un SUPER_ADMIN. */
export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'COMPANY_ADMIN' | 'AGENT';
  clientId?: number;
  phone?: string;
  country?: string;
}

/**
 * Champs que le web modifie. L'email n'en fait volontairement pas partie
 * (changer l'identifiant de connexion d'un compte sans nouvelle vérification),
 * ni le pays (le serveur en recalcule la devise principale).
 */
export interface UpdateUserInput {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  city?: string | null;
}

export interface SuspendUserResult {
  id: string;
  isSuspended: boolean;
  suspendedAt?: string | null;
  suspendedReason?: string | null;
}

export interface DeleteUserResult {
  id: string;
  deleted: boolean;
  message?: string;
}

function asList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: T[] }).data;
  }
  return [];
}

export function createUsersApi(http: HttpClient) {
  const enc = encodeURIComponent;
  return {
    list: async (): Promise<UserSummary[]> =>
      asList<UserSummary>(await http.get<unknown>('/users')).filter((u) => !u.deletedAt),

    get: (id: string) => http.get<UserDetail>(`/users/${enc(id)}`),

    create: (input: CreateUserInput) => http.post<UserSummary>('/users', input),

    update: (id: string, patch: UpdateUserInput) => http.patch<UserDetail>(`/users/${enc(id)}`, patch),

    suspend: (id: string, reason?: string) =>
      http.patch<SuspendUserResult>(`/users/${enc(id)}/suspend`, reason ? { reason } : {}),

    reactivate: (id: string) => http.patch<SuspendUserResult>(`/users/${enc(id)}/reactivate`, {}),

    remove: (id: string) => http.delete<DeleteUserResult>(`/users/${enc(id)}`),
  };
}
