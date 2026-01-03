// apps/backend/src/auth/roles.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthRequest } from '../common/types/auth-request';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.get<string[]>('roles', context.getHandler()) ?? [];

    // Si aucune contrainte de rôle, on laisse passer
    if (requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthRequest>();
    const role = String(req.user?.role ?? '').toUpperCase();

    if (!role) return false;

    return requiredRoles.map((r) => String(r).toUpperCase()).includes(role);
  }
}
