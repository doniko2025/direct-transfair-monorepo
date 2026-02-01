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

function isPublicTenantPath(url: string): boolean {
  return (
    url.startsWith('/swagger') ||
    url.startsWith('/auth/login') ||
    url.startsWith('/auth/register') ||
    url.startsWith('/auth/refresh') ||
    url.startsWith('/health')
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

    // ✅ LOGIN / REGISTER / SWAGGER → PAS de tenant requis
    if (isPublicTenantPath(url)) {
      return true;
    }

    // 🚨 toutes les autres routes DOIVENT avoir un tenant
    if (!req.tenantContext) {
      throw new UnauthorizedException('Missing tenant context');
    }

    // 🔥 Résolution DB réelle ici
    await this.tenantResolver.resolve(req);

    return true;
  }
}
