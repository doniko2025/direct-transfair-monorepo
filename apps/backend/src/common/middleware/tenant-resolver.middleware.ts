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

    const attach = (ctx: TenantContext) => {
      req.tenantCode = tenantCode;
      req.tenantContext = ctx;
      next();
    };

    // Helper: resolve clientId in single-db mode (Client table exists in DATABASE_URL)
    const resolveClientIdSingleDb = async (): Promise<number> => {
      if (!defaultDbUrl) throw new UnauthorizedException('Missing DATABASE_URL');
      const prisma = this.prismaManager.getClient({
        tenantCode: '__SINGLE__',
        databaseUrl: defaultDbUrl,
      });

      const client = await prisma.client.findUnique({
        where: { code: tenantCode },
        select: { id: true },
      });

      if (!client) throw new UnauthorizedException(`Unknown tenant: ${tenantCode}`);
      return client.id;
    };

    // ==========================================================
    // PHASE 2 — platform DB active => resolve tenant registry
    // (avec fallback Phase 1 si tenant absent en platform)
    // ==========================================================
    if (platformDbUrl) {
      void (async () => {
        await this.platform.connect();

        const tenant = await this.platform.tenant.findUnique({
          where: { code: tenantCode },
          select: { code: true, databaseUrl: true, isActive: true },
        });

        // --- FALLBACK: si platform ne connaît pas le tenant, on tente Phase 1 (Client table)
        // Cela évite le 401 "Unknown or inactive tenant" quand tu es encore en single-db
        // mais que DATABASE_URL_PLATFORM est configuré.
        if (!tenant || !tenant.isActive) {
          // Phase 1 fallback
          const clientId = await resolveClientIdSingleDb();

          const ctx: TenantContext = {
            code: tenantCode,
            clientId,
            databaseUrl: defaultDbUrl!, // safe: resolveClientIdSingleDb() a validé
            mode: 'single-db',
          };

          attach(ctx);
          return;
        }

        // Priorité aux overrides locaux (pratique en dev)
        const overrideUrl = this.config.get<string>(`DATABASE_URL__${tenantCode}`)?.trim();

        const tenantDbUrl = (overrideUrl || tenant.databaseUrl || defaultDbUrl)?.trim();
        if (!tenantDbUrl) {
          throw new UnauthorizedException(`Missing database URL for tenant ${tenantCode}`);
        }

        const mode: TenantContext['mode'] =
          defaultDbUrl && tenantDbUrl === defaultDbUrl ? 'single-db' : 'multi-db';

        // En single-db: on récupère le vrai clientId depuis Client (évite le "1" en dur)
        // En multi-db: clientId n'est pas fiable globalement => 0
        const clientId = mode === 'single-db' ? await resolveClientIdSingleDb() : 0;

        const ctx: TenantContext = {
          code: tenantCode,
          clientId,
          databaseUrl: tenantDbUrl,
          mode,
        };

        attach(ctx);
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

    void (async () => {
      const clientId = await resolveClientIdSingleDb();

      const ctx: TenantContext = {
        code: tenantCode,
        clientId,
        databaseUrl: defaultDbUrl,
        mode: 'single-db',
      };

      attach(ctx);
    })().catch((err) => next(err));
  }
}
