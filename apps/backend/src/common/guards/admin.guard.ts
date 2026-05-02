// apps/backend/src/common/guards/admin.guard.ts
// =========================================================
// ADMIN GUARD — version unifiée v4.0
// ✅ Autorise SUPER_ADMIN + COMPANY_ADMIN
// ✅ Remplace aussi withdrawals/guards/admin.guard.ts
//    → supprimer apps/backend/src/withdrawals/guards/admin.guard.ts
// =========================================================

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Role } from '@prisma/client';

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

    if (!req.user) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    const role = String(req.user.role ?? '').toUpperCase();

    if (
      role === 'SUPER_ADMIN' ||
      role === 'COMPANY_ADMIN' ||
      role === 'ADMIN'  // ← rétrocompat ancienne valeur
    ) {
      return true;
    }

    throw new ForbiddenException(
      `Accès administrateur requis (Rôle actuel: ${role})`,
    );
  }
}