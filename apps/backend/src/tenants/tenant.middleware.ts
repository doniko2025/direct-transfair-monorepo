// src/tenants/tenant.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

import { TenantResolverService } from './tenant-resolver.service';
import type { TenantContext } from './tenant-context';

export type RequestWithTenant = Request & {
  tenantCode?: string;
  tenantContext?: TenantContext;
};

const DEFAULT_TENANT_CODE = 'DONIKO';

function normalizeTenant(v: unknown): string {
  if (typeof v !== 'string') return DEFAULT_TENANT_CODE;
  const t = v.trim().toUpperCase();
  if (!t || t === '10') return DEFAULT_TENANT_CODE;
  return t;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly resolver: TenantResolverService) {}

  async use(req: RequestWithTenant, _res: Response, next: NextFunction) {
    try {
      // 1️⃣ Lecture header
      const rawHeader = req.headers['x-tenant-id'];
      const raw = Array.isArray(rawHeader)
        ? rawHeader[0]
        : rawHeader ?? DEFAULT_TENANT_CODE;

      const code = normalizeTenant(raw);

      req.tenantCode = code;

      // 2️⃣ Contexte initial
      req.tenantContext = {
        code,
        clientId: -1,
        databaseUrl: '',
        mode: 'single-db',
      };

      // 3️⃣ Résolution immédiate en DB
      await this.resolver.resolve(req);

      // 🔥 à ce stade clientId est garanti valide
      next();
    } catch (e) {
      next(e);
    }
  }
}
