// apps/backend/src/common/middleware/tenant-resolver.middleware.ts
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import type { Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

import type { TenantContext } from '../../tenants/tenant-context';
import type { AuthedRequest } from '../../types/requests';
import { PrismaClientManager } from '../prisma/prisma-client.manager';
import { PlatformPrismaService } from '../../platform/platform-prisma.service';

function readTenantCode(req: AuthedRequest): string {
  const raw = req.headers['x-tenant-id'];
  const code =
    typeof raw === 'string'
      ? raw.trim().toUpperCase()
      : Array.isArray(raw) && typeof raw[0] === 'string'
        ? raw[0].trim().toUpperCase()
        : '';

  return code;
}

@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(
    private readonly config: ConfigService,
    private readonly prismaManager: PrismaClientManager,
    private readonly platform: PlatformPrismaService,
  ) {}

  use(req: AuthedRequest, _res: Response, next: NextFunction): void {
    const tenantCode = readTenantCode(req);

    if (!tenantCode) {
      next(new UnauthorizedException('Missing x-tenant-id header'));
      return;
    }

    const platformDbUrl = this.config.get<string>('DATABASE_URL_PLATFORM')?.trim();
    const defaultDbUrl = this.config.get<string>('DATABASE_URL')?.trim();

    // ==========================================================
    // PHASE 2 — platform DB active => resolve tenant registry
    // ==========================================================
    if (platformDbUrl) {
      void (async () => {
        // Connexion lazy (ne bloque pas le boot)
        await this.platform.connect();

        const tenant = await this.platform.tenant.findUnique({
          where: { code: tenantCode },
          select: { code: true, databaseUrl: true, isActive: true },
        });

        if (!tenant || !tenant.isActive) {
          throw new UnauthorizedException(`Unknown or inactive tenant: ${tenantCode}`);
        }

        // Priorité aux overrides locaux (pratique en dev)
        const overrideUrl = this.config.get<string>(`DATABASE_URL__${tenantCode}`)?.trim();

        const tenantDbUrl = overrideUrl || tenant.databaseUrl || defaultDbUrl;
        if (!tenantDbUrl) {
          throw new UnauthorizedException(`Missing database URL for tenant ${tenantCode}`);
        }

        const mode: TenantContext['mode'] =
          defaultDbUrl && tenantDbUrl === defaultDbUrl ? 'single-db' : 'multi-db';

        const ctx: TenantContext = {
          code: tenantCode,
          // En multi-db, le clientId n'est pas fiable globalement => on met 0
          // (et ton JwtAuthGuard ne fera pas de "tenant mismatch" sur clientId)
          clientId: mode === 'multi-db' ? 0 : 1,
          databaseUrl: tenantDbUrl,
          mode,
        };

        req.tenantCode = tenantCode;
        req.tenantContext = ctx;

        next();
      })().catch((err) => next(err));

      return;
    }

    // ==========================================================
    // PHASE 1 — single DB (Client table exists in main schema)
    // ==========================================================
    if (!defaultDbUrl) {
      next(new UnauthorizedException('Missing DATABASE_URL'));
      return;
    }

    const prisma = this.prismaManager.getClient({
      tenantCode: '__SINGLE__',
      databaseUrl: defaultDbUrl,
    });

    void (async () => {
      const client = await prisma.client.findUnique({
        where: { code: tenantCode },
        select: { id: true },
      });

      if (!client) {
        throw new UnauthorizedException(`Unknown tenant: ${tenantCode}`);
      }

      const ctx: TenantContext = {
        code: tenantCode,
        clientId: client.id,
        databaseUrl: defaultDbUrl,
        mode: 'single-db',
      };

      req.tenantCode = tenantCode;
      req.tenantContext = ctx;

      next();
    })().catch((err) => next(err));
  }
}
