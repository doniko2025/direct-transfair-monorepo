// apps/backend/src/common/guards/admin.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Role } from '@prisma/client';

// Définition simple du type pour la requête authentifiée
type AuthRequest = {
  user?: {
    id: string;
    role?: Role | string;
    clientId?: number | null;
  };
};

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    
    // 1. Vérification basique de l'authentification
    if (!req.user) {
        throw new ForbiddenException('Utilisateur non authentifié');
    }

    // 2. Normalisation du rôle (au cas où il arrive en minuscule)
    const role = String(req.user.role ?? '').toUpperCase();

    // ✅ SÉCURITÉ : On autorise SUPER_ADMIN et COMPANY_ADMIN
    if (role === 'SUPER_ADMIN' || role === 'COMPANY_ADMIN') {
      return true;
    }

    throw new ForbiddenException(`Accès administrateur requis (Rôle actuel: ${role})`);
  }
}