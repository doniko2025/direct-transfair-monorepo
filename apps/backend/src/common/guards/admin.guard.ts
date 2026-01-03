// apps/backend/src/common/guards/admin.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthRequest } from '../types/auth-request';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthRequest>();

    const role = String(req.user?.role ?? '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return true;

    throw new ForbiddenException('Accès admin requis');
  }
}
