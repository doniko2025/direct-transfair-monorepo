// apps/backend/src/auth/must-change-password.spec.ts
// Mot de passe temporaire : changement obligatoire (garde JWT, effacement du drapeau) et liste blanche de PATCH /auth/me.
import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from './auth.service';

function makeGuard(dbUser: any) {
  const jwt = { verify: jest.fn().mockReturnValue({ sub: 'u1', role: 'COMPANY_ADMIN', clientId: 7 }) } as any;
  const prisma = { user: { findUnique: jest.fn().mockResolvedValue(dbUser) } } as any;
  return new JwtAuthGuard(jwt, new Reflector(), prisma);
}

function ctx(req: any): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Ctl {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

const call = (method: string, url: string) => ({
  method,
  originalUrl: url,
  headers: { authorization: 'Bearer abc' },
  tenantContext: { clientId: 7 },
});

const db = (mustChangePassword: boolean) => ({
  deletedAt: null,
  isSuspended: false,
  role: 'COMPANY_ADMIN',
  clientId: 7,
  client: { isActive: true },
  mustChangePassword,
});

describe('JwtAuthGuard — changement de mot de passe obligatoire', () => {
  it("refuse toute route métier tant que le mot de passe temporaire n'est pas changé", async () => {
    const guard = makeGuard(db(true));
    const err: any = await guard.canActivate(ctx(call('GET', '/api/agencies'))).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse()).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED', statusCode: 403 });
    await expect(guard.canActivate(ctx(call('POST', '/api/transactions')))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('laisse ouvertes les routes du changement (me, change-password, logout), avec ou sans paramètres', async () => {
    const guard = makeGuard(db(true));
    await expect(guard.canActivate(ctx(call('GET', '/api/auth/me')))).resolves.toBe(true);
    await expect(guard.canActivate(ctx(call('GET', '/api/auth/me?x=1')))).resolves.toBe(true);
    await expect(guard.canActivate(ctx(call('PATCH', '/api/auth/change-password')))).resolves.toBe(true);
    await expect(guard.canActivate(ctx(call('POST', '/api/auth/logout')))).resolves.toBe(true);
  });

  it("ne confond pas les méthodes : PATCH /auth/me (modifier la fiche) reste interdit", async () => {
    const guard = makeGuard(db(true));
    await expect(guard.canActivate(ctx(call('PATCH', '/api/auth/me')))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(ctx(call('GET', '/api/auth/change-password')))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sans drapeau, rien ne change', async () => {
    const guard = makeGuard(db(false));
    await expect(guard.canActivate(ctx(call('GET', '/api/agencies')))).resolves.toBe(true);
  });
});

describe('AuthService — drapeau et liste blanche du profil', () => {
  function fakeService(extra: Record<string, unknown> = {}) {
    const update = jest.fn().mockResolvedValue({});
    const self: any = {
      prisma: { user: { update, findUnique: jest.fn() }, wallet: { findUnique: jest.fn(), create: jest.fn() } },
      audit: jest.fn().mockResolvedValue(undefined),
      getProfile: jest.fn().mockResolvedValue({ ok: true }),
      ...extra,
    };
    return { self, update };
  }

  it("PATCH /auth/me ignore tout champ hors liste blanche (suspension, drapeaux, plafonds, agence…)", async () => {
    const { self, update } = fakeService();
    await (AuthService.prototype as any).updateProfile.call(self, 'u1', {
      firstName: 'Awa',
      city: 'Dakar',
      mustChangePassword: false,
      isSuspended: false,
      isEmailVerified: true,
      complianceStatus: 'CLEAR',
      dailySentAmount: 0,
      agencyId: 'autre-agence',
      mfaSecret: 'x',
      lockedUntil: null,
      deletedAt: null,
      role: 'SUPER_ADMIN',
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].data).toEqual({ firstName: 'Awa', city: 'Dakar' });
  });

  it('PATCH /auth/me : un corps qui n\'est pas un objet ne casse rien et ne modifie rien', async () => {
    const { self, update } = fakeService();
    await (AuthService.prototype as any).updateProfile.call(self, 'u1', 'n\'importe quoi');
    expect(update.mock.calls[0][0].data).toEqual({});
  });

  it('changePassword remet mustChangePassword à false', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('Temporaire1', 4);
    const update = jest.fn().mockResolvedValue({});
    const self: any = {
      prisma: { user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', password: hash, clientId: 7, email: null }), update } },
      audit: jest.fn().mockResolvedValue(undefined),
      mail: { sendEmail: jest.fn().mockResolvedValue(undefined) },
      logger: { warn: jest.fn() },
    };
    await (AuthService.prototype as any).changePassword.call(self, 'u1', 'Temporaire1', 'NouveauSecret9');
    expect(update.mock.calls[0][0].data).toMatchObject({ mustChangePassword: false });
    expect(typeof update.mock.calls[0][0].data.password).toBe('string');
  });
});
