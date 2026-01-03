//apps/backend/src/types/express.d.ts
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUserPayload;
    tenantCode?: string;
    tenantContext?: {
      code: string;
      clientId: number;
      databaseUrl: string;
      mode: 'single-db' | 'multi-db';
    };
  }
}
