// apps/backend/src/support/permissions.guard.ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { hasAnyPermission, type SupportPermission } from './support-permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<SupportPermission[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) ?? [];
    if (required.length === 0) return true;
    const user = context.switchToHttp().getRequest().user;
    if (!hasAnyPermission(user, required)) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'PERMISSION_REQUIRED',
        message: 'Cette action n\'est pas déléguée à votre compte. Contactez votre administrateur.',
      });
    }
    return true;
  }
}
