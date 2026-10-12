// apps/backend/src/auth/roles.guard.ts
// =========================================================
// ROLES GUARD v1.1
//
// ✅ v1.1 (phase 6) : 🚨 FIX SÉCURITÉ — un @Roles(...) posé sur la CLASSE
//   du contrôleur était ignoré.
//
//   Avant : this.reflector.get('roles', context.getHandler()) ne lit que
//   la méthode. Le contrôleur agent-desk déclare @Roles(Role.AGENT) au
//   niveau de la classe : aucune de ses 3 routes n'était donc réellement
//   restreinte — n'importe quel compte connecté (même un client USER)
//   pouvait appeler /agent-desk/clients/lookup et lire nom, téléphone et
//   pays des clients de sa société.
//
//   Maintenant : getAllAndOverride([méthode, classe]) — la méthode prime
//   sur la classe, comme dans les RolesGuard locaux de users, clients et
//   agencies. Aucun autre contrôleur n'utilise @Roles sur la classe, donc
//   aucun autre comportement ne change.
// =========================================================

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>('roles', [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

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
