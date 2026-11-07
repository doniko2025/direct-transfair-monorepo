// apps/direct-transfair-mobile/services/kyc.ts
// =========================================================
// KYC v1.0 — vérification d'identité (lot 7). Contrat : apps/backend/src/kyc/kyc.controller.ts
//   CLIENT  GET /kyc/me · POST /kyc/documents (photos en base64)
//   ADMIN   GET /kyc/admin/stats · /kyc/admin/queue · /kyc/admin/users/:id
//           POST /kyc/admin/documents/:id/approve|reject · POST /kyc/admin/users/:id/remind
//           GET  /kyc/documents/:id/(front|back)  → octets de l'image (affichés en data-URI)
// Un client dont l'identité n'est pas validée reçoit 403 { code: 'KYC_REQUIRED' } sur les envois, les virements
// programmés et les retraits : voir utils/kycGate.ts.
// =========================================================

import { api } from "./api";

export type KycDocType = "NATIONAL_ID" | "PASSPORT" | "DRIVER_LICENSE" | "RESIDENCE_PERMIT" | "SELFIE" | "PROOF_OF_ADDRESS" | "BANK_STATEMENT";
export type KycDocStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
export type KycOverall = "NOT_SUBMITTED" | "PENDING" | "PARTIAL" | "REJECTED" | "EXPIRED" | "VERIFIED";

export const KYC_IDENTITY_TYPES: KycDocType[] = ["NATIONAL_ID", "PASSPORT", "DRIVER_LICENSE", "RESIDENCE_PERMIT"];
export const KYC_ADDRESS_TYPES: KycDocType[] = ["PROOF_OF_ADDRESS", "BANK_STATEMENT"];
export const KYC_NEEDS_BACK: KycDocType[] = ["NATIONAL_ID", "DRIVER_LICENSE", "RESIDENCE_PERMIT"];
export const KYC_NEEDS_EXPIRY: KycDocType[] = ["NATIONAL_ID", "PASSPORT", "DRIVER_LICENSE", "RESIDENCE_PERMIT"];

export const KYC_DOC_LABEL: Record<KycDocType, string> = {
  NATIONAL_ID: "Carte nationale d'identité",
  PASSPORT: "Passeport",
  DRIVER_LICENSE: "Permis de conduire",
  RESIDENCE_PERMIT: "Titre de séjour",
  SELFIE: "Selfie",
  PROOF_OF_ADDRESS: "Justificatif de domicile",
  BANK_STATEMENT: "Relevé bancaire",
};

export const KYC_STATUS_LABEL: Record<KycOverall, string> = {
  NOT_SUBMITTED: "Identité à vérifier",
  PENDING: "Vérification en cours",
  PARTIAL: "Dossier incomplet",
  REJECTED: "Pièce refusée",
  EXPIRED: "Pièce expirée",
  VERIFIED: "Identité vérifiée",
};

export const KYC_DOC_STATUS_LABEL: Record<KycDocStatus, string> = {
  PENDING: "En cours de vérification",
  APPROVED: "Validée",
  REJECTED: "Refusée",
  EXPIRED: "Expirée",
};

export interface KycDocumentView {
  id: string;
  type: KycDocType;
  label: string;
  status: KycDocStatus;
  documentNumber: string | null;
  expiryDate: string | null;
  issuedCountry: string | null;
  version: number;
  hasBack: boolean;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface KycStatusView {
  status: KycOverall;
  level: "LEVEL_0" | "LEVEL_1" | "LEVEL_2" | "LEVEL_3";
  verified: boolean;
  canTransact: boolean;
  verifiedAt: string | null;
  missing: KycDocType[];
  canUpgrade: boolean;
  /** Échéance de la pièce d'identité : renseignée à moins de 30 jours de la date, ou déjà expirée (opérations bloquées). */
  expiry: KycExpiryView | null;
  documents: KycDocumentView[];
  history: KycDocumentView[];
}

export interface KycExpiryView {
  type: KycDocType;
  label: string;
  /** AAAA-MM-JJ — dernier jour de validité */
  expiryDate: string;
  /** Jours de validité restants, jour d'expiration compris (0 si expirée). */
  daysLeft: number;
  expired: boolean;
}

export interface SubmitKycInput {
  type: KycDocType;
  /** base64 pur ou data-URL */
  front: string;
  back?: string;
  documentNumber?: string;
  /** AAAA-MM-JJ */
  expiryDate?: string;
  issuedCountry?: string;
}

export interface KycAdminStats {
  pending: number;
  rejected: number;
  notSubmitted: number;
  approved: number;
  oldestPendingAt: string | null;
}

export type KycQueueFilter = "PENDING" | "REJECTED" | "NOT_SUBMITTED" | "APPROVED" | "ALL";

export interface KycQueueItem {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  level: string;
  status: KycOverall;
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

// ─── Appels ──────────────────────────────────────────────
export const kycApi = {
  me: async (): Promise<KycStatusView> => (await api.http.get<KycStatusView>("/kyc/me")).data,

  /** Les photos pèsent plusieurs Mo : délai long, et une seule requête à la fois côté écran. */
  submit: async (input: SubmitKycInput): Promise<KycStatusView & { document: KycDocumentView }> =>
    (await api.http.post("/kyc/documents", input, { timeout: 90_000 })).data,

  adminStats: async (): Promise<KycAdminStats> => (await api.http.get<KycAdminStats>("/kyc/admin/stats")).data,

  adminQueue: async (p: { status?: KycQueueFilter; search?: string; page?: number; limit?: number } = {}): Promise<KycQueuePage> => {
    const params: Record<string, string | number> = {};
    if (p.status) params.status = p.status;
    if (p.search?.trim()) params.search = p.search.trim();
    if (p.page) params.page = p.page;
    if (p.limit) params.limit = p.limit;
    return (await api.http.get<KycQueuePage>("/kyc/admin/queue", { params })).data;
  },

  adminDossier: async (userId: string): Promise<KycDossier> =>
    (await api.http.get<KycDossier>(`/kyc/admin/users/${encodeURIComponent(userId)}`)).data,

  approve: async (documentId: string, note?: string): Promise<KycDossier> =>
    (await api.http.post<KycDossier>(`/kyc/admin/documents/${encodeURIComponent(documentId)}/approve`, note?.trim() ? { note: note.trim() } : {})).data,

  reject: async (documentId: string, reason: string): Promise<KycDossier> =>
    (await api.http.post<KycDossier>(`/kyc/admin/documents/${encodeURIComponent(documentId)}/reject`, { reason })).data,

  remind: async (userId: string): Promise<{ sent: boolean }> =>
    (await api.http.post<{ sent: boolean }>(`/kyc/admin/users/${encodeURIComponent(userId)}/remind`, {})).data,

  /** Image d'une pièce, prête pour <Image source={{ uri }}> (data-URI) ; `isPdf` si c'est un PDF (non affichable ici). */
  file: async (documentId: string, kind: "front" | "back"): Promise<{ uri: string | null; isPdf: boolean }> => {
    const res = await api.http.get<ArrayBuffer>(`/kyc/documents/${encodeURIComponent(documentId)}/${kind}`, {
      responseType: "arraybuffer",
      timeout: 60_000,
    });
    const mime = String(res.headers?.["content-type"] ?? "image/jpeg").split(";")[0].trim();
    if (mime === "application/pdf") return { uri: null, isPdf: true };
    return { uri: `data:${mime};base64,${bytesToBase64(res.data)}`, isPdf: false };
  },
};

// ─── Outils ──────────────────────────────────────────────
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Base64 sans dépendance (btoa/Buffer ne sont pas disponibles partout sur React Native). */
export function bytesToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const parts: string[] = [];
  const CHUNK = 3 * 4096;
  for (let start = 0; start < bytes.length; start += CHUNK) {
    const end = Math.min(start + CHUNK, bytes.length);
    let out = "";
    let i = start;
    for (; i + 2 < end; i += 3) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    }
    if (i < end) {
      const rest = end - i;
      const n = (bytes[i] << 16) | ((rest > 1 ? bytes[i + 1] : 0) << 8);
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (rest > 1 ? B64[(n >> 6) & 63] : "=") + "=";
    }
    parts.push(out);
  }
  return parts.join("");
}

/** « 12 mars 2031 » à partir de AAAA-MM-JJ (sans décalage de fuseau). */
export function formatDay(day: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day ?? "");
  if (!m) return "";
  const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${Number(m[3])} ${mois[Number(m[2]) - 1]} ${m[1]}`;
}

/** Saisie « 12032031 » ou « 12/03/2031 » (JJ/MM/AAAA) → AAAA-MM-JJ ; null si invalide. */
export function parseFrenchDate(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const d = Number(digits.slice(0, 2));
  const m = Number(digits.slice(2, 4));
  const y = Number(digits.slice(4, 8));
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Met en forme au fil de la frappe : « 12032031 » → « 12/03/2031 ». */
export function maskFrenchDate(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Cette date (AAAA-MM-JJ) est-elle dans le futur (ou aujourd'hui) ? */
export function isFutureOrToday(day: string, now: Date = new Date()): boolean {
  const t = new Date(`${day}T23:59:59Z`).getTime();
  return !Number.isNaN(t) && t >= now.getTime();
}
