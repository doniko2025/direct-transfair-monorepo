// src/tenants/tenant.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import type { TenantContext } from './tenant-context';

export type RequestWithTenant = Request & {
  tenantCode?: string;
  tenantContext?: TenantContext;
};

const DEFAULT_TENANT_CODE = 'DONIKO';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: RequestWithTenant, _res: Response, next: NextFunction): void {
    const rawHeader = req.headers['x-tenant-id'];
    const raw = Array.isArray(rawHeader)
      ? rawHeader[0]
      : rawHeader ?? DEFAULT_TENANT_CODE;

    const code = String(raw).trim().toUpperCase() || DEFAULT_TENANT_CODE;

    req.tenantCode = code;

    // ⚠️ Context PARTIEL ici (sera complété par le resolver)
    req.tenantContext = {
      code,
      clientId: -1,
      databaseUrl: '',
      mode: 'single-db',
    };

    next();
  }
}
