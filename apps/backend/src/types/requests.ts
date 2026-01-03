// apps/backend/src/types/requests.ts
import type { Request } from 'express';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import type { TenantContext } from '../tenants/tenant-context';

export type AuthedRequest = Request & {
  user?: AuthUserPayload;
  tenantCode?: string;
  tenantContext?: TenantContext;
};
