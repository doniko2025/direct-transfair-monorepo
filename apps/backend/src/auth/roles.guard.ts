// apps/backend/src/auth/roles.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.get<string[]>('roles', context.getHandler()) ?? [];

    // Si aucune contrainte de rôle, on laisse passer
    if (requiredRoles.length === 0) return true;

    // Ton fichier express.d.ts s'occupe déjà d'étendre globalement l'objet Request.
    // On utilise donc l'import standard d'Express.
    const req = context.switchToHttp().getRequest<Request>();
    
    // On effectue un cast de sécurité pour garantir que la compilation ne cassera jamais ici,
    // même si TypeScript met du temps à lier express.d.ts dans ce contexte précis.
    const user = (req as any).user;
    const role = String(user?.role ?? '').toUpperCase();

    if (!role) return false;

    return requiredRoles.map((r) => String(r).toUpperCase()).includes(role);
  }
}