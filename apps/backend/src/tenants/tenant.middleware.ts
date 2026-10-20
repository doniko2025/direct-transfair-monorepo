// src/tenants/tenant.middleware.ts
// ✅ phase 7 : société par défaut et alias « 10 » lus dans la configuration plateforme (PLATFORM_TENANT_CODE / PLATFORM_LEGACY_CODES).
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

import { TenantResolverService } from './tenant-resolver.service';
import type { TenantContext } from './tenant-context';
import { platform } from '../common/platform.config';

export type RequestWithTenant = Request & {
  tenantCode?: string;
  tenantContext?: TenantContext;
};

// ✅ phase 7 : société par défaut et alias historique « 10 » viennent de la configuration plateforme.
function normalizeTenant(v: unknown): string {
  return platform.canonicalCode(v);
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
        : rawHeader ?? platform.code;

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
