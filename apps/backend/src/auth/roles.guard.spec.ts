// apps/backend/src/auth/roles.guard.spec.ts
// Phase 6 — un @Roles posé sur la CLASSE doit être respecté (cas agent-desk).
import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';

@Roles('AGENT')
class ClassLevelController {
  inherits() {}

  @Roles('COMPANY_ADMIN')
  overrides() {}
}

class OpenController {
  open() {}

  @Roles('SUPER_ADMIN')
  restricted() {}
}

function ctx(cls: any, handler: string, role?: string): ExecutionContext {
  return {
    getClass: () => cls,
    getHandler: () => cls.prototype[handler],
    switchToHttp: () => ({ getRequest: () => ({ user: role === undefined ? undefined : { role } }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('applique le @Roles de la classe quand la méthode n\'en déclare pas', () => {
    expect(guard.canActivate(ctx(ClassLevelController, 'inherits', 'AGENT'))).toBe(true);
    expect(guard.canActivate(ctx(ClassLevelController, 'inherits', 'USER'))).toBe(false);
    expect(guard.canActivate(ctx(ClassLevelController, 'inherits', 'COMPANY_ADMIN'))).toBe(false);
  });

  it('le @Roles de la méthode prime sur celui de la classe', () => {
    expect(guard.canActivate(ctx(ClassLevelController, 'overrides', 'COMPANY_ADMIN'))).toBe(true);
    expect(guard.canActivate(ctx(ClassLevelController, 'overrides', 'AGENT'))).toBe(false);
  });

  it('laisse passer une route sans @Roles', () => {
    expect(guard.canActivate(ctx(OpenController, 'open', 'USER'))).toBe(true);
    expect(guard.canActivate(ctx(OpenController, 'open'))).toBe(true);
  });

  it('refuse un utilisateur sans rôle sur une route restreinte', () => {
    expect(guard.canActivate(ctx(OpenController, 'restricted'))).toBe(false);
    expect(guard.canActivate(ctx(OpenController, 'restricted', 'USER'))).toBe(false);
  });

  it('compare les rôles sans tenir compte de la casse', () => {
    expect(guard.canActivate(ctx(OpenController, 'restricted', 'super_admin'))).toBe(true);
  });
});
