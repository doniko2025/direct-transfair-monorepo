// src/tenants/tenant-resolver.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import type { RequestWithTenant } from './tenant.middleware';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(req: RequestWithTenant) {
    if (!req.tenantContext) {
      throw new Error('TenantContext missing');
    }

    const code = req.tenantContext.code;

    const client = await this.prisma.client.findUnique({
      where: { code },
      select: { id: true },
    });

    if (!client) {
      throw new NotFoundException(`Tenant inconnu: ${code}`);
    }

    // ✅ Hydratation finale
    req.tenantContext.clientId = client.id;
    req.tenantContext.databaseUrl = process.env.DATABASE_URL ?? '';
    req.tenantContext.mode = 'single-db';

    return req.tenantContext;
  }
}
