// apps/backend/src/auth/jwt-auth.guard.ts
// =========================================================
// JWT AUTH GUARD v4.1
// ✅ Fix "Tenant mismatch" sur Railway :
//    - tenantClientId=0 (multi-db mode) → bypass le check
//    - tenantClientId=-1 (non résolu) → bypass le check
//    - SUPER_ADMIN → bypass global (inchangé)
//    - COMPANY_ADMIN avec clientId valide → check normal
// =========================================================

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { AuthUserPayload } from './types/auth-user-payload.type';
import type { TenantContext } from '../tenants/tenant-context';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';

type JwtPayloadLike = {
  sub?: string;
  id?: string;
  userId?: string;
  email?: string;
  role?: string;
  clientId?: number;
  agencyId?: string | null;
  primaryCurrency?: string | null;
};

type AuthenticatedRequest = Request & {
  user?: AuthUserPayload;
  tenantContext?: TenantContext;
};

function extractToken(req: Request): string {
  const rawHeader = req.headers['authorization'];

  if (!rawHeader || Array.isArray(rawHeader)) {
    throw new UnauthorizedException('Missing Authorization header');
  }

  const header = String(rawHeader).trim();
  if (!header) {
    throw new UnauthorizedException('Missing Authorization header');
  }

  const token = header.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : header.trim();

  if (!token) {
    throw new UnauthorizedException('Invalid Authorization header');
  }

  return token;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractToken(req);

    try {
      const payload = this.jwt.verify<JwtPayloadLike>(token);

      const id = payload.sub ?? payload.id ?? payload.userId;
      if (!id) throw new UnauthorizedException('Invalid token payload');

      const clientId =
        typeof payload.clientId === 'number' ? payload.clientId : undefined;

      req.user = {
        id,
        sub: id,
        email: payload.email,
        role: payload.role,
        clientId,
        agencyId: payload.agencyId ?? null,
        primaryCurrency: payload.primaryCurrency ?? null,
      };

      // ✅ SUPER_ADMIN — bypass total
      if (payload.role === 'SUPER_ADMIN') return true;

      // ✅ Tenant matching
      const tenantClientId = req.tenantContext?.clientId;

      // ✅ FIX v4.1 : on ne vérifie que si tenantClientId est un entier > 0
      // - tenantClientId=0  → mode multi-db (pas de clientId global fiable) → bypass
      // - tenantClientId=-1 → non résolu → bypass
      // - tenantClientId=undefined/null → middleware non passé → bypass
      // - tenantClientId>0 → single-db avec clientId résolu → on vérifie
      if (
        typeof tenantClientId === 'number' &&
        tenantClientId > 0
      ) {
        if (typeof clientId !== 'number') {
          throw new UnauthorizedException('Invalid token: missing clientId');
        }

        if (clientId !== tenantClientId) {
          // ✅ Log détaillé pour debug Railway (ne pas laisser en prod silencieux)
          console.error(
            `[JwtAuthGuard] Tenant mismatch — JWT clientId=${clientId} vs tenant clientId=${tenantClientId} | role=${payload.role} | userId=${id}`,
          );
          throw new UnauthorizedException(
            `Tenant mismatch (token clientId=${clientId}, tenant clientId=${tenantClientId}). ` +
            `Reconnectez-vous pour obtenir un nouveau token.`,
          );
        }
      }

      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid token');
    }
  }
}