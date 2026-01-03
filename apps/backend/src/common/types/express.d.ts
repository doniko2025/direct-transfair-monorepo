//apps/backend/src/common/types/express.d.ts
import type { AuthUserPayload } from '../../auth/types/auth-user-payload.type';
import type { TenantContext } from '../../tenants/tenant-context';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
      tenantContext?: TenantContext;
      tenantCode?: string;
    }
  }
}

export {};
