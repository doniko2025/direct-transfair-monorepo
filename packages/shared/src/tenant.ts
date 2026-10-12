// packages/shared/src/tenant.ts
// =========================================================
// TENANT v1.0
//
// Règles issues du backend (auth.service.ts, tenant.middleware.ts) :
//   - le tenant voyage dans l'en-tête `x-tenant-id` (code en MAJUSCULES)
//   - le tenant par défaut est la plateforme : "DONIKO"
//   - isolation des portails : SUPER_ADMIN ne se connecte QUE sur le
//     portail plateforme ; tous les autres rôles QUE sur le portail de
//     leur société (sinon 403 USE_COMPANY_PORTAL / USE_DEFAULT_PORTAL)
// =========================================================

export const PLATFORM_TENANT = 'DONIKO';

/** Nettoie un code société : majuscules, caractères A-Z 0-9 _ - uniquement. */
export function normalizeTenantCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const cleaned = input.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  return cleaned.length > 0 ? cleaned : null;
}

export function normalizeHost(input: string): string {
  return input.trim().toLowerCase().replace(/:\d+$/, '');
}

export function isLocalHost(host: string): boolean {
  const h = normalizeHost(host);
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '[::1]' ||
    h.endsWith('.localhost') ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(h)
  );
}
