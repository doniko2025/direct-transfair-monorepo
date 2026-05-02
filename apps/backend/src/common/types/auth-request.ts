// apps/backend/src/common/types/auth-request.ts
// Importé par payments.controller.ts et d'autres controllers
import type { Request } from 'express';
import type { AuthUserPayload } from '../../auth/types/auth-user-payload.type';
import type { TenantContext } from '../../tenants/tenant-context';

export type AuthTenantRequest = Request & {
  user?: AuthUserPayload;
  tenantContext?: TenantContext;
  tenantCode?: string;
};