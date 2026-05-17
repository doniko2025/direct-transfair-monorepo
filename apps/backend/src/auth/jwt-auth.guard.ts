// apps/backend/src/auth/jwt-auth.guard.ts
// =========================================================
// JWT AUTH GUARD — implémentation custom (sans Passport)
// ✅ Gère le tenant matching (clientId dans token = clientId du tenant)
// ✅ Bypass via @Public()
// ✅ Ajout des champs agencyId + primaryCurrency dans req.user
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

  // Supporte "Bearer <token>" ou "<token>"
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

    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractToken(req);

    try {
      const payload = this.jwt.verify<JwtPayloadLike>(token);

      const id = payload.sub ?? payload.id ?? payload.userId;
      if (!id) {
        throw new UnauthorizedException('Invalid token payload');
      }

      const clientId =
        typeof payload.clientId === 'number' ? payload.clientId : undefined;

      // ✅ AuthUserPayload enrichi v4 avec agencyId + primaryCurrency
      req.user = {
        id,
        sub: id,
        email: payload.email,
        role: payload.role,
        clientId,
        agencyId: payload.agencyId ?? null,
        primaryCurrency: payload.primaryCurrency ?? null,
      };

      // ✅ Tenant matching — inchangé
            // ✅ SUPER_ADMIN = bypass multi-tenant global
      if (payload.role === 'SUPER_ADMIN') {
        return true;
      }

      // ✅ Tenant matching — inchangé
      const tenantClientId = req.tenantContext?.clientId;

      if (typeof tenantClientId === 'number' && tenantClientId > 0) {
        if (typeof clientId !== 'number') {
          throw new UnauthorizedException('Invalid token: missing clientId');
        }

        if (clientId !== tenantClientId) {
          throw new UnauthorizedException('Tenant mismatch');
        }
      }

      return true;
    } catch (e) {
      // On laisse remonter le UnauthorizedException explicite si déjà thrown
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid token');
    }
  }
}