// src/tenants/tenant.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

import type { TenantContext } from './tenant-context';

export type RequestWithTenant = Request & {
  // legacy (compat)
  tenantCode?: string;
  // new
  tenantContext?: TenantContext;
};

const DEFAULT_TENANT_CODE = 'DONIKO';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: RequestWithTenant, _res: Response, next: NextFunction): void {
    const rawHeader = req.headers['x-tenant-id'];

    const raw =
      Array.isArray(rawHeader) ? rawHeader[0] : (rawHeader ?? DEFAULT_TENANT_CODE);

    const code = String(raw).trim().toUpperCase() || DEFAULT_TENANT_CODE;

    // compat ancien code
    req.tenantCode = code;

    // nouveau tenant context (Hybrid)
    req.tenantContext = {
      code,
      clientId: -1, // résolu ensuite via TenantGuard/TenantResolverService
      databaseUrl: process.env.DATABASE_URL ?? '',
      mode: 'single-db',
    };

    next();
  }
}
