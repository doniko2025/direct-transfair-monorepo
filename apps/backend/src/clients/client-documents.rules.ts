// apps/backend/src/clients/client-documents.rules.ts
// Règles pures des documents légaux d'une société (RCCM, pièce d'identité du représentant…) et du numéro RCCM.

export const CLIENT_DOC_KINDS = ['RCCM', 'IDENTITY', 'TAX', 'STATUTES', 'LICENSE', 'OTHER'] as const;
export type ClientDocKind = (typeof CLIENT_DOC_KINDS)[number];

export const CLIENT_DOC_LABEL: Record<ClientDocKind, string> = {
  RCCM: "Extrait RCCM (registre du commerce)",
  IDENTITY: "Pièce d'identité du représentant",
  TAX: 'Attestation fiscale (NIF)',
  STATUTES: 'Statuts de la société',
  LICENSE: "Agrément / licence",
  OTHER: 'Autre document',
};

export const isClientDocKind = (v: unknown): v is ClientDocKind =>
  typeof v === 'string' && (CLIENT_DOC_KINDS as readonly string[]).includes(v);

/** Nombre maximal de documents conservés par société. */
export const MAX_CLIENT_DOCS = 20;

/**
 * Numéro RCCM : les formats varient d'un pays à l'autre (GN.TCC.2021.A.12345, SN DKR 2020 B 1234, CI-ABJ-2019-B-12345…).
 * On contrôle seulement la forme : 4 à 60 caractères, lettres, chiffres, espaces, points, tirets, barres obliques.
 */
export const RCCM_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 .\-/]{3,59}$/;

/** Numéro RCCM nettoyé (espaces multiples réduits) ou null s'il est vide ; lève une Error de message clair s'il est invalide. */
export function normalizeRccm(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const value = String(raw).trim().replace(/\s+/g, ' ');
  if (!value) return null;
  if (!RCCM_PATTERN.test(value)) {
    throw new Error('Numéro RCCM invalide : 4 à 60 caractères (lettres, chiffres, espaces, points, tirets ou barres obliques).');
  }
  return value;
}
