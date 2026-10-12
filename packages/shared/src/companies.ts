// packages/shared/src/companies.ts
// =========================================================
// SOCIÉTÉS (table Client côté backend) — réservé au SUPER_ADMIN
//
// Contrat relevé dans apps/backend/src/clients/clients.controller.ts :
//   GET    /clients              liste (la société système DONIKO y figure)
//   GET    /clients/:id          détail (+ users, wallets)
//   POST   /clients              création société + administrateur
//   PATCH  /clients/:id          mise à jour (⚠ aucune validation côté serveur)
//   PATCH  /clients/:id/status   statut d'abonnement
//   DELETE /clients/:id          désactivation en cascade (soft delete)
// =========================================================

import type { HttpClient } from './http';

export type SubscriptionStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'TRIAL';
export type SubscriptionType = 'RENTAL' | 'PURCHASE';
export type CurrencyCode = 'XOF' | 'EUR' | 'USD' | 'GNF' | 'GBP';

export interface CompanyWallet {
  id: number | string;
  currency: CurrencyCode;
  /** Decimal Prisma : sérialisé en chaîne par le backend. */
  balance: string | number;
  isDefault?: boolean;
}

export interface CompanyPerson {
  id: number | string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
}

/** Champs communs à la liste et au détail (tous optionnels sauf l'identité). */
export interface Company {
  id: number;
  code: string;
  name: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  tagline?: string | null;
  fontFamily?: string | null;
  welcomeMessage?: string | null;

  subdomain?: string | null;
  customDomain?: string | null;

  country?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  activitySector?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;

  ownerFirstName?: string | null;
  ownerLastName?: string | null;
  ownerCountry?: string | null;

  legalCompanyName?: string | null;
  regulatorName?: string | null;
  regulatorAcronym?: string | null;
  regulatoryFrameworkLabel?: string | null;
  regulatorLicenseNumber?: string | null;
  regulatorLicenseType?: string | null;
  capitalSocial?: string | null;
  supportEmail?: string | null;
  whatsappNumber?: string | null;
  mediatorName?: string | null;
  mediatorUrl?: string | null;

  subscriptionType?: SubscriptionType | null;
  subscriptionStatus?: SubscriptionStatus | null;
  defaultCurrency?: CurrencyCode | null;

  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanySummary extends Company {
  _count?: { users?: number; agencies?: number };
  wallets?: CompanyWallet[];
}

export interface CompanyDetail extends Company {
  users?: CompanyPerson[];
  wallets?: CompanyWallet[];
}

/** Corps de POST /clients — mêmes noms que CreateClientDto. */
export interface CreateCompanyInput {
  code: string;
  name: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  adminPassword: string;
  /** ISO alpha-2 : le backend en déduit la devise par défaut. */
  ownerCountry?: string;
  subscriptionType?: SubscriptionType;
  activitySector?: string;
  primaryColor?: string;
  secondaryColor?: string;
  subdomain?: string;
  customDomain?: string;
  contactPhone?: string;
}

/**
 * Le backend renvoie aussi l'objet `admin` complet (hash du mot de passe compris).
 * Le web n'en lit que l'identité : on ne type volontairement rien d'autre.
 */
export interface CreateCompanyResult {
  client: Pick<Company, 'id' | 'code' | 'name'> & Partial<Company>;
  admin: { id: number | string; email: string };
}

export type UpdateCompanyInput = Partial<
  Omit<Company, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'isActive' | 'subscriptionStatus' | 'defaultCurrency'>
>;

export interface DeleteCompanyResult {
  id?: number;
  /** Soldes non nuls constatés à la désactivation (à réconcilier). */
  warnings?: string[];
}

/** Société système qui porte le portail plateforme : jamais gérée comme une société cliente. */
export const SYSTEM_COMPANY_CODE = 'DONIKO';

function asList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: T[] }).data;
  }
  return [];
}

export function createCompaniesApi(http: HttpClient) {
  return {
    list: async (): Promise<CompanySummary[]> =>
      asList<CompanySummary>(await http.get<unknown>('/clients')).filter(
        (c) => c.code !== SYSTEM_COMPANY_CODE,
      ),

    get: (id: number) => http.get<CompanyDetail>(`/clients/${id}`),

    create: (input: CreateCompanyInput) => http.post<CreateCompanyResult>('/clients', input),

    update: (id: number, patch: UpdateCompanyInput) =>
      http.patch<CompanyDetail>(`/clients/${id}`, patch),

    setStatus: (id: number, status: SubscriptionStatus) =>
      http.patch<CompanyDetail>(`/clients/${id}/status`, { status }),

    remove: (id: number) => http.delete<DeleteCompanyResult>(`/clients/${id}`),
  };
}
