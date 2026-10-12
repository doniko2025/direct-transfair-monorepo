// packages/shared/src/agencies.ts
// =========================================================
// AGENCES — COMPANY_ADMIN (celles de sa société)
//
// Contrat relevé dans apps/backend/src/agencies/agencies.controller.ts :
//   GET    /agencies        liste des agences actives de la société (agents et portefeuilles inclus)
//   GET    /agencies/:id    fiche (même une agence désactivée, pour l'audit)
//   POST   /agencies        crée l'agence, son portefeuille, ET son premier agent (le responsable)
//   PATCH  /agencies/:id    met à jour l'agence (et téléphone / nom / email du responsable)
//   DELETE /agencies/:id    DÉSACTIVE l'agence ET tous ses agents ; renvoie des avertissements sur les soldes
// =========================================================

import type { CurrencyCode } from './companies';
import type { HttpClient } from './http';

export type AgencyType = 'SUBSIDIARY' | 'PARTNER';

export interface AgencyBalance {
  id: number | string;
  currency: CurrencyCode;
  balance: number;
  reservedBalance: number;
  availableBalance: number;
  isDefault: boolean;
}

export interface AgencyAgent {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  role: string;
}

export interface Agency {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string | null;
  email: string | null;
  code: string | null;
  country: string | null;
  primaryCurrency: CurrencyCode;
  isActive: boolean;
  isCertified: boolean;
  clientId: number;
  clientName?: string | null;
  clientCode?: string | null;
  type: AgencyType;
  managerId: string | null;
  wallets?: AgencyBalance[];
  agents?: AgencyAgent[];
  createdAt: string;
  updatedAt: string;
}

/** Corps de POST /agencies. Le mot de passe du responsable est toujours généré par le serveur. */
export interface CreateAgencyInput {
  name: string;
  city: string;
  address: string;
  /** Adresse du responsable : c'est son identifiant de connexion. */
  email: string;
  phone?: string;
  /** ISO alpha-2 : détermine la devise de l'agence. */
  country: string;
  code?: string;
  type?: AgencyType;
  adminFirstName?: string;
  adminLastName?: string;
}

export interface CreateAgencyResult {
  agency: Agency;
  agent: { id: string; email: string; firstName: string | null; lastName: string | null; agencyId: string };
  /** Présent uniquement à la création : le mot de passe temporaire du responsable. */
  generatedPassword?: string;
}

/** Champs que le web modifie. Le pays n'en fait pas partie : il fixe la devise du portefeuille. */
export interface UpdateAgencyInput {
  name?: string;
  city?: string;
  address?: string;
  phone?: string | null;
  code?: string | null;
  email?: string;
  managerName?: string;
  type?: AgencyType;
}

export interface RemoveAgencyResult extends Agency {
  warnings: string[];
}

function asList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: T[] }).data;
  }
  return [];
}

export function createAgenciesApi(http: HttpClient) {
  const enc = encodeURIComponent;
  return {
    list: async (): Promise<Agency[]> => asList<Agency>(await http.get<unknown>('/agencies')),
    get: (id: string) => http.get<Agency>(`/agencies/${enc(id)}`),
    create: (input: CreateAgencyInput) => http.post<CreateAgencyResult>('/agencies', input),
    update: (id: string, patch: UpdateAgencyInput) => http.patch<Agency>(`/agencies/${enc(id)}`, patch),
    remove: (id: string) => http.delete<RemoveAgencyResult>(`/agencies/${enc(id)}`),
  };
}
