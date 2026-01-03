//apps/backend/src/withdrawals/guards/admin.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<any>();
    const role = String(req.user?.role ?? '').toUpperCase();

    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return true;
    throw new ForbiddenException('Accès admin requis');
  }
}
