// apps/backend/src/prisma/prisma-resolver.service.ts
import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { PrismaService } from './prisma.service';
import { PrismaClientManager } from '../common/prisma/prisma-client.manager';
import type { AuthedRequest } from '../types/requests';
import type { TenantContext } from '../tenants/tenant-context';

@Injectable()
export class PrismaResolver {
  constructor(
    private readonly prisma: PrismaService, // DB unique (Phase 1)
    private readonly manager: PrismaClientManager, // multi-db (Phase 2)
  ) {}

  /**
   * Prisma pour une requête HTTP (tenantContext attaché par le middleware)
   */
  forRequest(req: AuthedRequest): PrismaClient {
    const ctx = req.tenantContext;
    return this.forTenantContext(ctx);
  }

  /**
   * Prisma pour un contexte tenant (utile dans services / jobs)
   */
  forTenantContext(ctx?: TenantContext): PrismaClient {
    // Phase 1 (DB unique) ou pas de ctx => PrismaService
    if (!ctx || ctx.mode === 'single-db') {
      return this.prisma;
    }

    // Phase 2 (multi-db) => client dédié tenant
    return this.manager.getClient({
      tenantCode: ctx.code,
      databaseUrl: ctx.databaseUrl,
    });
  }
}
