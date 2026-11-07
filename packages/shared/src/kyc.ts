// packages/shared/src/kyc.ts
// =========================================================
// VÉRIFICATION D'IDENTITÉ (KYC) — client wallet + écrans de validation administrateur.
//
// Contrat : apps/backend/src/kyc/kyc.controller.ts
//   CLIENT  GET  /kyc/me                          mon dossier (statut global, pièces, ce qu'il manque)
//           POST /kyc/documents                   envoi d'une pièce (images/PDF en base64, 8 Ko à 6 Mo par fichier)
//   ADMIN   GET  /kyc/admin/stats                 compteurs de la société
//           GET  /kyc/admin/queue                 file de validation (status, search, page, limit)
//           GET  /kyc/admin/users/:userId         dossier complet d'un client
//           POST /kyc/admin/documents/:id/approve { note? }
//           POST /kyc/admin/documents/:id/reject  { reason } — sur une pièce déjà validée = révocation
//           POST /kyc/admin/users/:userId/remind  rappel immédiat (au plus un toutes les 12 h)
//           GET  /kyc/documents/:id/(front|back)  contenu de la pièce (jeton obligatoire) → fetchFile() renvoie un Blob
//           GET  /kyc/admin/counter-customers[?search&page&limit&clientId]   clients de passage (numéro de pièce masqué)
//           GET  /kyc/admin/counter-customers/:id                            fiche complète (consultation journalisée)
//           GET  /kyc/admin/counter-customers/:id/file/(front|back)          photo de la pièce prise au comptoir → Blob (journalisé)
//
// Toute consultation d'une pièce (dossier, recto, verso, client de passage) par un administrateur est journalisée côté serveur (KYC_VIEW).
// Une pièce d'identité périmée bloque les envois, virements programmés et retraits dès le lendemain de sa date d'expiration
// (statut EXPIRED) ; `expiry` annonce l'échéance 30 jours avant.
//
// Un client sans identité validée (statut ≠ VERIFIED) reçoit 403 { code: 'KYC_REQUIRED' } sur les envois, les virements
// programmés et les retraits : utiliser isKycRequiredError() pour l'orienter vers l'écran de vérification.
// =========================================================

import { ApiError } from './http';
import type { HttpClient } from './http';
import type { KycLevel } from './users';

export type KycDocType = 'NATIONAL_ID' | 'PASSPORT' | 'DRIVER_LICENSE' | 'RESIDENCE_PERMIT' | 'SELFIE' | 'PROOF_OF_ADDRESS' | 'BANK_STATEMENT';
export type KycDocStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
/** NOT_SUBMITTED : rien reçu · PENDING : en cours d'examen · PARTIAL : une pièce validée, il en manque · REJECTED · EXPIRED · VERIFIED */
export type KycOverallStatus = 'NOT_SUBMITTED' | 'PENDING' | 'PARTIAL' | 'REJECTED' | 'EXPIRED' | 'VERIFIED';

export const KYC_IDENTITY_TYPES: KycDocType[] = ['NATIONAL_ID', 'PASSPORT', 'DRIVER_LICENSE', 'RESIDENCE_PERMIT'];
export const KYC_ADDRESS_TYPES: KycDocType[] = ['PROOF_OF_ADDRESS', 'BANK_STATEMENT'];
/** Pièces dont le verso est obligatoire. */
export const KYC_NEEDS_BACK: KycDocType[] = ['NATIONAL_ID', 'DRIVER_LICENSE', 'RESIDENCE_PERMIT'];
/** Pièces dont la date d'expiration est obligatoire. */
export const KYC_NEEDS_EXPIRY: KycDocType[] = ['NATIONAL_ID', 'PASSPORT', 'DRIVER_LICENSE', 'RESIDENCE_PERMIT'];

export const KYC_DOC_LABEL: Record<KycDocType, string> = {
  NATIONAL_ID: "Carte nationale d'identité",
  PASSPORT: 'Passeport',
  DRIVER_LICENSE: 'Permis de conduire',
  RESIDENCE_PERMIT: 'Titre de séjour',
  SELFIE: 'Selfie',
  PROOF_OF_ADDRESS: 'Justificatif de domicile',
  BANK_STATEMENT: 'Relevé bancaire',
};

export const KYC_STATUS_LABEL: Record<KycOverallStatus, string> = {
  NOT_SUBMITTED: 'Non envoyé',
  PENDING: 'En cours de vérification',
  PARTIAL: 'Incomplet',
  REJECTED: 'Refusé',
  EXPIRED: 'Pièce expirée',
  VERIFIED: 'Vérifié',
};

export const KYC_DOC_STATUS_LABEL: Record<KycDocStatus, string> = {
  PENDING: 'En attente',
  APPROVED: 'Validée',
  REJECTED: 'Refusée',
  EXPIRED: 'Expirée',
};

export interface KycDocumentView {
  id: string;
  type: KycDocType;
  label: string;
  status: KycDocStatus;
  documentNumber: string | null;
  /** AAAA-MM-JJ */
  expiryDate: string | null;
  issuedCountry: string | null;
  version: number;
  hasBack: boolean;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface KycStatusView {
  status: KycOverallStatus;
  level: KycLevel;
  verified: boolean;
  /** false = envois, virements programmés et retraits refusés tant que l'identité n'est pas validée. */
  canTransact: boolean;
  verifiedAt: string | null;
  /** Types de pièces encore à fournir pour le niveau de base (identité et/ou selfie). */
  missing: KycDocType[];
  /** Le client vérifié peut encore envoyer un justificatif de domicile (niveau 2, plafonds plus hauts). */
  canUpgrade: boolean;
  /**
   * Échéance de la pièce d'identité : renseignée quand elle expire dans moins de 30 jours, ou quand elle est déjà expirée
   * (expired = true, opérations sensibles bloquées). null = rien à signaler.
   */
  expiry: KycExpiryView | null;
  /** Dernière version de chaque type de pièce. */
  documents: KycDocumentView[];
  history: KycDocumentView[];
}

export interface KycExpiryView {
  type: KycDocType;
  label: string;
  /** AAAA-MM-JJ — dernier jour de validité */
  expiryDate: string;
  /** Jours de validité restants, jour d'expiration compris (0 si déjà expirée). */
  daysLeft: number;
  expired: boolean;
}

/** Fichier à envoyer : base64 pur ou data-URL (data:image/jpeg;base64,…). */
export interface SubmitKycDocumentInput {
  type: KycDocType;
  front: string;
  back?: string;
  documentNumber?: string;
  /** AAAA-MM-JJ */
  expiryDate?: string;
  issuedCountry?: string;
}

export interface SubmitKycResult extends KycStatusView {
  document: KycDocumentView;
}

export interface KycAdminStats {
  pending: number;
  rejected: number;
  notSubmitted: number;
  approved: number;
  oldestPendingAt: string | null;
}

export type KycQueueFilter = 'PENDING' | 'REJECTED' | 'NOT_SUBMITTED' | 'APPROVED' | 'ALL';

export interface KycQueueItem {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  clientId: number | null;
  level: KycLevel;
  status: KycOverallStatus;
  pendingCount: number;
  pendingTypes: KycDocType[];
  submittedAt: string | null;
  createdAt: string;
}

export interface KycQueuePage {
  items: KycQueueItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface KycQueueParams {
  status?: KycQueueFilter;
  search?: string;
  page?: number;
  limit?: number;
  /** SUPER_ADMIN uniquement : restreindre à une société. */
  clientId?: number;
}

export interface KycDossier extends KycStatusView {
  user: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    country: string | null;
    city: string | null;
    address: string | null;
    birthDate: string | null;
    nationality: string | null;
    birthPlace: string | null;
    createdAt: string;
    isSuspended: boolean;
    remindersSent: number;
    lastReminderAt: string | null;
  };
}

export type KycFileKind = 'front' | 'back';

// ── Clients de passage (envois au comptoir) — consultation administrateur ──
export interface CounterCustomerListItem {
  id: string;
  clientId: number;
  name: string;
  phone: string;
  idType: KycDocType;
  idTypeLabel: string;
  /** Numéro masqué (4 derniers caractères) ; le numéro complet est dans la fiche. */
  idNumberMasked: string;
  idExpiry: string;
  idExpired: boolean;
  hasPhoto: boolean;
  photoAt: string | null;
  sends: number;
  createdAt: string;
}

export interface CounterCustomerPage {
  items: CounterCustomerListItem[];
  page: number;
  limit: number;
  total: number;
}

export interface CounterCustomerDetail {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  birthDate: string;
  idType: KycDocType;
  idTypeLabel: string;
  idNumber: string;
  idCountry: string | null;
  idExpiry: string;
  idExpired: boolean;
  photoAt: string | null;
  files: { kind: KycFileKind; mimeType: string; sizeBytes: number; at: string }[];
  registeredBy: string | null;
  createdAt: string;
  sends: number;
  recent: { id: string; amount: number; currency: string; status: string; createdAt: string }[];
}

export interface CounterCustomerParams {
  search?: string;
  page?: number;
  limit?: number;
  clientId?: number;
}

/** Le serveur refuse l'opération : l'identité du client n'est pas encore validée. */
export function isKycRequiredError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 403 && err.code === 'KYC_REQUIRED';
}

export function createKycApi(http: HttpClient) {
  return {
    // ── Client ──
    me: () => http.get<KycStatusView>('/kyc/me'),
    submit: (input: SubmitKycDocumentInput) => http.post<SubmitKycResult>('/kyc/documents', input),

    // ── Administrateur ──
    adminStats: (clientId?: number) => http.get<KycAdminStats>(`/kyc/admin/stats${clientId ? `?clientId=${clientId}` : ''}`),
    adminQueue: (params: KycQueueParams = {}) => {
      const qs = new URLSearchParams();
      if (params.status) qs.set('status', params.status);
      if (params.search?.trim()) qs.set('search', params.search.trim());
      if (params.page) qs.set('page', String(params.page));
      if (params.limit) qs.set('limit', String(params.limit));
      if (params.clientId) qs.set('clientId', String(params.clientId));
      const s = qs.toString();
      return http.get<KycQueuePage>(`/kyc/admin/queue${s ? `?${s}` : ''}`);
    },
    adminDossier: (userId: string) => http.get<KycDossier>(`/kyc/admin/users/${encodeURIComponent(userId)}`),
    approve: (documentId: string, note?: string) =>
      http.post<KycDossier>(`/kyc/admin/documents/${encodeURIComponent(documentId)}/approve`, note?.trim() ? { note: note.trim() } : {}),
    /** Sur une pièce déjà validée : révocation (le niveau du client est recalculé). */
    reject: (documentId: string, reason: string) =>
      http.post<KycDossier>(`/kyc/admin/documents/${encodeURIComponent(documentId)}/reject`, { reason }),
    remind: (userId: string) => http.post<{ sent: boolean }>(`/kyc/admin/users/${encodeURIComponent(userId)}/remind`, {}),

    /** Clients de passage de la société (envois au comptoir) et photos de leur pièce. */
    counterCustomers: (params: CounterCustomerParams = {}) => {
      const qs = new URLSearchParams();
      if (params.search?.trim()) qs.set('search', params.search.trim());
      if (params.page) qs.set('page', String(params.page));
      if (params.limit) qs.set('limit', String(params.limit));
      if (params.clientId) qs.set('clientId', String(params.clientId));
      const q = qs.toString();
      return http.get<CounterCustomerPage>(`/kyc/admin/counter-customers${q ? `?${q}` : ''}`);
    },
    counterCustomer: (id: string) => http.get<CounterCustomerDetail>(`/kyc/admin/counter-customers/${encodeURIComponent(id)}`),
    fetchCounterFile: (id: string, kind: KycFileKind) =>
      http.get<Blob>(`/kyc/admin/counter-customers/${encodeURIComponent(id)}/file/${kind}`, { responseType: 'blob' }),

    /** Contenu d'une pièce, avec le jeton de l'utilisateur (une <img src> ne peut pas l'envoyer). */
    fetchFile: (documentId: string, kind: KycFileKind) =>
      http.get<Blob>(`/kyc/documents/${encodeURIComponent(documentId)}/${kind}`, { responseType: 'blob' }),
  };
}
