// apps/backend/src/common/guards/admin.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Role } from '@prisma/client';

// Typage léger de la requête (évite any)
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
    const role = String(req.user?.role ?? '').toUpperCase();

    // ✅ Autorisés : SUPER_ADMIN et COMPANY_ADMIN
    if (role === 'SUPER_ADMIN' || role === 'COMPANY_ADMIN') {
      return true;
    }

    throw new ForbiddenException('Accès administrateur requis');
  }
}
