// apps/backend/src/auth/jwt-auth.guard.spec.ts
// Phase 6 (v4.3) — req.user.role / clientId viennent de la base, pas du jeton.
import 'reflect-metadata';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

function makeGuard(payload: any, dbUser: any, session?: any) {
  const jwt = { verify: jest.fn().mockReturnValue(payload) } as any;
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(dbUser) },
    userSession: { findUnique: jest.fn().mockResolvedValue(session ?? null) },
  } as any;
  return new JwtAuthGuard(jwt, new Reflector(), prisma);
}

function ctx(req: any): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Ctl {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

const req = (tenantClientId?: number) => ({
  headers: { authorization: 'Bearer abc' },
  tenantContext: tenantClientId === undefined ? undefined : { clientId: tenantClientId },
});

describe('JwtAuthGuard v4.3', () => {
  it('prend le rôle et la société de la base, pas ceux du jeton', async () => {
    const guard = makeGuard(
      { sub: 'u1', role: 'COMPANY_ADMIN', clientId: 7 },
      { deletedAt: null, isSuspended: false, role: 'USER', clientId: 7, client: { isActive: true } },
    );
    const r: any = req(7);
    await expect(guard.canActivate(ctx(r))).resolves.toBe(true);
    expect(r.user.role).toBe('USER');
    expect(r.user.clientId).toBe(7);
  });

  it('un ancien SUPER_ADMIN rétrogradé ne contourne plus le contrôle de société', async () => {
    const guard = makeGuard(
      { sub: 'u1', role: 'SUPER_ADMIN', clientId: 1 },
      { deletedAt: null, isSuspended: false, role: 'COMPANY_ADMIN', clientId: 1, client: { isActive: true } },
    );
    await expect(guard.canActivate(ctx(req(2)))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('compte déplacé vers une autre société : la société de la base fait foi', async () => {
    const guard = makeGuard(
      { sub: 'u1', role: 'AGENT', clientId: 1 },
      { deletedAt: null, isSuspended: false, role: 'AGENT', clientId: 2, client: { isActive: true } },
    );
    await expect(guard.canActivate(ctx(req(1)))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(makeGuard(
      { sub: 'u1', role: 'AGENT', clientId: 1 },
      { deletedAt: null, isSuspended: false, role: 'AGENT', clientId: 2, client: { isActive: true } },
    ).canActivate(ctx(req(2)))).resolves.toBe(true);
  });

  it('un vrai SUPER_ADMIN passe quelle que soit la société demandée', async () => {
    const guard = makeGuard(
      { sub: 'u1', role: 'SUPER_ADMIN' },
      { deletedAt: null, isSuspended: false, role: 'SUPER_ADMIN', clientId: null, client: null },
    );
    await expect(guard.canActivate(ctx(req(9)))).resolves.toBe(true);
  });

  it('refuse toujours un compte supprimé, suspendu ou une société désactivée', async () => {
    const base = { role: 'USER', clientId: 1, client: { isActive: true } };
    await expect(makeGuard({ sub: 'u' }, { ...base, deletedAt: new Date(), isSuspended: false }).canActivate(ctx(req(1)))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(makeGuard({ sub: 'u' }, { ...base, deletedAt: null, isSuspended: true }).canActivate(ctx(req(1)))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(makeGuard({ sub: 'u' }, { ...base, deletedAt: null, isSuspended: false, client: { isActive: false } }).canActivate(ctx(req(1)))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(makeGuard({ sub: 'u' }, null).canActivate(ctx(req(1)))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('JwtAuthGuard — session révoquée', () => {
  const dbUser = { deletedAt: null, isSuspended: false, role: 'USER', clientId: 1, client: { isActive: true } };
  const ok = (session: any, sub = 'u1') => makeGuard({ sub, sid: 's1' }, dbUser, session).canActivate(ctx(req(1)));

  it('refuse tout de suite un jeton dont la session a été révoquée ou a expiré', async () => {
    await expect(ok({ status: 'REVOKED', userId: 'u1' })).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(ok({ status: 'EXPIRED', userId: 'u1' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuse un jeton dont la session appartient à un autre utilisateur', async () => {
    await expect(ok({ status: 'ACTIVE', userId: 'autre' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepte une session active, une session introuvable (création non bloquante) et un jeton sans sid', async () => {
    await expect(ok({ status: 'ACTIVE', userId: 'u1' })).resolves.toBe(true);
    await expect(ok(null)).resolves.toBe(true);
    await expect(makeGuard({ sub: 'u1' }, dbUser, { status: 'REVOKED', userId: 'u1' }).canActivate(ctx(req(1)))).resolves.toBe(true);
  });
});
