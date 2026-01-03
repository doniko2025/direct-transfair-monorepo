// apps/backend/src/prisma/prisma-multitenant.service.ts
import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import type { TenantContext } from '../tenants/tenant-context';
import { PrismaService } from './prisma.service';
import { PrismaClientManager } from '../common/prisma/prisma-client.manager';

@Injectable()
export class PrismaMultiTenantService {
  constructor(
    private readonly prisma: PrismaService, // Phase 1
    private readonly manager: PrismaClientManager, // Phase 2
  ) {}

  getPrisma(ctx: TenantContext): PrismaClient {
    // Phase 1 : DB unique
    if (ctx.mode === 'single-db') return this.prisma;

    // Phase 2 : 1 DB par tenant
    return this.manager.getClient({
      tenantCode: ctx.code,
      databaseUrl: ctx.databaseUrl,
    });
  }
}
