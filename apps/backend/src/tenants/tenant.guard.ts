// apps/backend/src/tenants/tenant.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { TenantResolverService } from './tenant-resolver.service';
import type { RequestWithTenant } from './tenant.middleware';

function stripQuery(url: string): string {
  const i = url.indexOf('?');
  return i >= 0 ? url.slice(0, i) : url;
}

/**
 * Normalise le path pour gérer le globalPrefix "api".
 * Ex: "/api/auth/login" -> "/auth/login"
 */
function normalizePath(rawUrl: string): string {
  const url = stripQuery(rawUrl || '');
  const withSlash = url.startsWith('/') ? url : `/${url}`;
  return withSlash.replace(/^\/api(?=\/|$)/, '') || '/';
}

function isPublicOrAdminPath(path: string): boolean {
  return (
    // Swagger / health
    path.startsWith('/swagger') ||
    path.startsWith('/health') ||

    // Auth public
    path.startsWith('/auth/login') ||
    path.startsWith('/auth/register') ||
    path.startsWith('/auth/refresh') ||
    path.startsWith('/auth/find-account') ||
    path.startsWith('/auth/send-otp') ||
    path.startsWith('/auth/verify-otp') ||
    path.startsWith('/auth/reset-password') ||

    // Exception admin (si tu l’assumes)
    path.includes('/transactions/admin/')
  );
}

function normalizeTenantHeader(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().toUpperCase();
  if (!t) return null;
  // ton “bug tenant=10”
  if (t === '10') return 'DONIKO';
  return t;
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenantResolver: TenantResolverService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithTenant>();

    const rawUrl =
      (req as unknown as Request).originalUrl ??
      (req as unknown as Request).url ??
      '';

    const path = normalizePath(rawUrl);

    // ✅ Public routes : on laisse passer
    if (isPublicOrAdminPath(path)) {
      return true;
    }

    // ✅ Déjà résolu par middleware/service
    if (req.tenantContext) {
      return true;
    }

    // ✅ Fallback 1 : header x-tenant-id (le mobile l’envoie)
    const headerTenant =
      normalizeTenantHeader((req.headers as any)['x-tenant-id']) ??
      normalizeTenantHeader((req.headers as any)['x-tenant-id'.toUpperCase()]);

    if (headerTenant) {
      // On renseigne au minimum pour que le reste de l’app fonctionne
      (req as any).tenantCode = headerTenant;
      (req as any).tenantContext = { code: headerTenant };
      return true;
    }

    // ✅ Fallback 2 : tentative de résolution via service (si tu as d’autres mécanismes)
    try {
      await this.tenantResolver.resolve(req);
    } catch {
      throw new UnauthorizedException('Missing tenant context (Guard Blocked)');
    }

    if (!req.tenantContext) {
      throw new UnauthorizedException('Missing tenant context (Guard Blocked)');
    }

    return true;
  }
}
