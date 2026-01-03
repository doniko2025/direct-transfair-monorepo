//apps/backend/src/tenants/tenant.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import type { TenantContext } from './tenant-context';
import { TenantResolverService } from './tenant-resolver.service';

type ReqWithTenant = Request & { tenantContext?: TenantContext };

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly resolver: TenantResolverService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ReqWithTenant>();

    if (!req.tenantContext?.code) {
      throw new UnauthorizedException('TenantContext missing');
    }

    // Déjà résolu ? (évite double hit DB)
    if (typeof req.tenantContext.clientId === 'number' && req.tenantContext.clientId > 0) {
      return true;
    }

    await this.resolver.resolve(req);
    return true;
  }
}
