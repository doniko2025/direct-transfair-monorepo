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

import type { ContractTermsInput } from './contracts';
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
  /** Numéro RCCM : repris dans le contrat de la société (jamais affiché aux clients). */
  rccmNumber?: string | null;
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

  // Coordonnées de la société (modifiables ensuite depuis la fiche)
  contactEmail?: string;
  city?: string;
  website?: string;
  address?: string;

  // Apparence
  logoUrl?: string;
  tagline?: string;
  welcomeMessage?: string;
  fontFamily?: string;

  // Mentions légales
  legalCompanyName?: string;
  regulatorName?: string;
  regulatorAcronym?: string;
  regulatoryFrameworkLabel?: string;
  regulatorLicenseType?: string;
  regulatorLicenseNumber?: string;
  capitalSocial?: string;
  /** Numéro RCCM de la société : obligatoire pour émettre son contrat, où il figure. */
  rccmNumber?: string;
  supportEmail?: string;
  whatsappNumber?: string;
  mediatorName?: string;
  mediatorUrl?: string;

  /** Conditions du contrat de location / d'achat : si présent, un contrat est émis et son lien de signature part avec les identifiants. */
  contract?: ContractTermsInput;
}

/**
 * Le backend renvoie aussi l'objet `admin` complet (hash du mot de passe compris).
 * Le web n'en lit que l'identité : on ne type volontairement rien d'autre.
 */
export interface CreateCompanyResult {
  client: Pick<Company, 'id' | 'code' | 'name'> & Partial<Company>;
  admin: { id: number | string; email: string };
  /** Contrat émis à la création (null si aucun ou en échec — voir contractError). */
  contract?: { id: string; reference: string; signUrl: string | null; expiresAt: string } | null;
  contractError?: string;
}

// ── Documents légaux de la société (RCCM, pièce d'identité du représentant…) — SUPER_ADMIN ──────────────────────
//   GET    /clients/:id/documents              { documents }
//   POST   /clients/:id/documents              { kind, label?, file } — file : data URL base64 (JPEG, PNG, WebP ou PDF, 6 Mo au plus)
//   GET    /clients/:id/documents/:docId/file  octets du document
//   DELETE /clients/:id/documents/:docId
export const COMPANY_DOC_KINDS = ['RCCM', 'IDENTITY', 'TAX', 'STATUTES', 'LICENSE', 'OTHER'] as const;
export type CompanyDocKind = (typeof COMPANY_DOC_KINDS)[number];

export const COMPANY_DOC_LABEL: Record<CompanyDocKind, string> = {
  RCCM: 'Extrait RCCM (registre du commerce)',
  IDENTITY: "Pièce d'identité du représentant",
  TAX: 'Attestation fiscale (NIF)',
  STATUTES: 'Statuts de la société',
  LICENSE: 'Agrément / licence',
  OTHER: 'Autre document',
};

export interface CompanyDocument {
  id: string;
  kind: CompanyDocKind;
  kindLabel: string;
  label: string | null;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface AddCompanyDocumentInput {
  kind: CompanyDocKind;
  label?: string;
  /** Data URL base64 du fichier. */
  file: string;
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

    /** Toutes les sociétés, la société système (la plateforme) comprise : sert à détecter un logo copié d'une autre société. */
    all: async (): Promise<CompanySummary[]> => asList<CompanySummary>(await http.get<unknown>('/clients')),

    get: (id: number) => http.get<CompanyDetail>(`/clients/${id}`),

    create: (input: CreateCompanyInput) => http.post<CreateCompanyResult>('/clients', input),

    update: (id: number, patch: UpdateCompanyInput) =>
      http.patch<CompanyDetail>(`/clients/${id}`, patch),

    setStatus: (id: number, status: SubscriptionStatus) =>
      http.patch<CompanyDetail>(`/clients/${id}/status`, { status }),

    remove: (id: number) => http.delete<DeleteCompanyResult>(`/clients/${id}`),

    documents: (id: number) => http.get<{ documents: CompanyDocument[] }>(`/clients/${id}/documents`),

    addDocument: (id: number, input: AddCompanyDocumentInput) =>
      http.post<CompanyDocument>(`/clients/${id}/documents`, input),

    /** Octets du document, avec l'authentification du super admin. */
    documentFile: (id: number, docId: string) =>
      http.request<Blob>(`/clients/${id}/documents/${encodeURIComponent(docId)}/file`, { responseType: 'blob' }),

    removeDocument: (id: number, docId: string) =>
      http.delete<{ id: string }>(`/clients/${id}/documents/${encodeURIComponent(docId)}`),
  };
}
