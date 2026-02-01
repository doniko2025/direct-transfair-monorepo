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

function isPublicOrAdminPath(url: string): boolean {
  return (
    url.startsWith('/swagger') ||
    url.startsWith('/auth/login') ||
    url.startsWith('/auth/register') ||
    url.startsWith('/auth/refresh') ||
    url.startsWith('/health') ||
    // ✅ CORRECTION CRITIQUE ICI
    // On autorise les routes de trésorerie admin à passer SANS contexte tenant obligatoire.
    // C'est le JwtAuthGuard (Controller) qui sécurisera l'accès.
    url.includes('/transactions/admin/') 
  );
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly tenantResolver: TenantResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<RequestWithTenant>();

    const url =
      (req as unknown as Request).originalUrl ??
      (req as unknown as Request).url ??
      '';

    // ✅ Si c'est public OU une route admin spéciale, on laisse passer
    if (isPublicOrAdminPath(url)) {
      return true;
    }

    // 🚨 Pour les autres routes (clients/agences standards), on exige un tenant
    if (!req.tenantContext) {
      // On tente une dernière résolution si le middleware a échoué silencieusement
      try {
          await this.tenantResolver.resolve(req);
      } catch (e) {
          // Si vraiment impossible, on rejette
          throw new UnauthorizedException('Missing tenant context (Guard Blocked)');
      }
      
      // Si après tentative c'est toujours vide
      if (!req.tenantContext) {
          throw new UnauthorizedException('Missing tenant context');
      }
    }

    return true;
  }
}