// apps/backend/src/common/types/auth-request.ts
import type { Request } from 'express';
import type { AuthUserPayload } from '../../auth/types/auth-user-payload.type';
import type { TenantContext } from '../../tenants/tenant-context';

/**
 * Requête Express enrichie par l'auth (JwtStrategy / JwtAuthGuard).
 * On s'aligne sur AuthUserPayload pour éviter les divergences de types.
 */
export type AuthRequest = Request & {
  user?: AuthUserPayload;
};

/**
 * Variante lorsque le TenantGuard enrichit la requête.
 */
export type AuthTenantRequest = AuthRequest & {
  tenantContext?: TenantContext;
};
