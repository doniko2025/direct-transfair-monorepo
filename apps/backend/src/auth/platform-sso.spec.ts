// apps/backend/src/auth/platform-sso.spec.ts
// Connexion unique depuis la console dkmoney.store : secret, signature, expiration, rejeu, rôle du compte.
import 'reflect-metadata';
import { ForbiddenException, HttpException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as jwtLib from 'jsonwebtoken';

import { PlatformSsoService, SSO_AUDIENCE, SSO_ISSUER } from './platform-sso.service';

const SECRET = 'x'.repeat(40);
const ENV = ['PLATFORM_SSO_SECRET', 'PLATFORM_SSO_ALLOWED_EMAILS'] as const;
const saved: Record<string, string | undefined> = {};
beforeEach(() => { ENV.forEach((k) => { saved[k] = process.env[k]; delete process.env[k]; }); process.env.PLATFORM_SSO_SECRET = SECRET; });
afterEach(() => ENV.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }));

const sign = (over: Record<string, unknown> = {}, opts: jwtLib.SignOptions = {}, secret = SECRET) =>
  jwtLib.sign(
    { email: 'Doniko@Example.com', jti: 'jti-0123456789abcdef', sub: 'lcd:u1', ...over },
    secret,
    { algorithm: 'HS256', issuer: SSO_ISSUER, audience: SSO_AUDIENCE, expiresIn: 60, ...opts },
  );

const superAdmin = (over: any = {}) => ({
  id: 'u-sa', email: 'doniko@example.com', role: 'SUPER_ADMIN', clientId: 1, deletedAt: null, isActive: true,
  isSuspended: false, isEmailVerified: true, lockedUntil: null, ...over,
});

function make(user: any = superAdmin()) {
  const used = new Set<string>();
  const prisma: any = {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
    platformSsoAssertion: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn(async ({ data }: any) => {
        if (used.has(data.jti)) throw new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 't' });
        used.add(data.jti);
        return data;
      }),
    },
  };
  const v2: any = { completeSsoLogin: jest.fn().mockResolvedValue({ access_token: 'a', refresh_token: 'r', user: { id: 'u-sa' } }) };
  return { service: new PlatformSsoService(prisma, new JwtService({}), v2), prisma, v2 };
}

describe('PlatformSsoService', () => {
  it('route fermée (404) si le secret est absent ou trop court', async () => {
    const { service, prisma } = make();
    delete process.env.PLATFORM_SSO_SECRET;
    await expect(service.login(sign(), 'web')).rejects.toBeInstanceOf(NotFoundException);
    process.env.PLATFORM_SSO_SECRET = 'court';
    await expect(service.login(sign(), 'web')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('assertion valide : ouvre la session du SUPER_ADMIN (e-mail insensible à la casse) et consomme le jti', async () => {
    const { service, prisma, v2 } = make();
    const r = await service.login(sign(), 'web');
    expect(r.access_token).toBe('a');
    expect(prisma.user.findUnique.mock.calls[0][0].where).toEqual({ email: 'doniko@example.com' });
    expect(v2.completeSsoLogin).toHaveBeenCalledWith(expect.objectContaining({ id: 'u-sa' }), SSO_ISSUER);
    expect(prisma.platformSsoAssertion.create).toHaveBeenCalledTimes(1);
  });

  it('refuse mauvaise signature, mauvais émetteur / audience, assertion expirée, algorithme « none »', async () => {
    const { service, v2 } = make();
    await expect(service.login(sign({}, {}, 'y'.repeat(40)), 'web')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.login(sign({}, { issuer: 'autre' }), 'web')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.login(sign({}, { audience: 'autre' }), 'web')).rejects.toBeInstanceOf(UnauthorizedException);
    const now = Math.floor(Date.now() / 1000);
    const expired = jwtLib.sign({ email: 'doniko@example.com', jti: 'jti-0123456789abcdef', iat: now - 100, exp: now - 10 }, SECRET, { algorithm: 'HS256', issuer: SSO_ISSUER, audience: SSO_AUDIENCE });
    await expect(service.login(expired, 'web')).rejects.toBeInstanceOf(UnauthorizedException);
    const none = jwtLib.sign({ email: 'doniko@example.com', jti: 'jti-0123456789abcdef' }, '', { algorithm: 'none' as any, issuer: SSO_ISSUER, audience: SSO_AUDIENCE, expiresIn: 60 });
    await expect(service.login(none, 'web')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.login('pas.un.jwt', 'web')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(v2.completeSsoLogin).not.toHaveBeenCalled();
  });

  it('refuse une assertion à longue durée de vie ou sans jti / e-mail', async () => {
    const { service } = make();
    await expect(service.login(sign({}, { expiresIn: 3600 }), 'web')).rejects.toThrow(/trop longue/);
    await expect(service.login(sign({ jti: 'court' }), 'web')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.login(sign({ email: '' }), 'web')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejeu : la même assertion ne marche qu’une fois, même en parallèle', async () => {
    const { service, v2 } = make();
    const a = sign();
    const res = await Promise.allSettled([service.login(a, 'web'), service.login(a, 'web')]);
    expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((res.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(UnauthorizedException);
    expect(v2.completeSsoLogin).toHaveBeenCalledTimes(1);
    await expect(service.login(a, 'web')).rejects.toThrow(/déjà utilisée/);
  });

  it.each([
    ['rôle COMPANY_ADMIN', { role: 'COMPANY_ADMIN' }],
    ['rôle USER', { role: 'USER' }],
    ['compte suspendu', { isSuspended: true }],
    ['compte désactivé', { isActive: false }],
    ['compte supprimé', { deletedAt: new Date() }],
    ['e-mail non vérifié', { isEmailVerified: false }],
    ['compte verrouillé', { lockedUntil: new Date(Date.now() + 60_000) }],
  ])('refuse un compte : %s', async (_n, over) => {
    const { service, prisma, v2 } = make(superAdmin(over));
    await expect(service.login(sign(), 'web')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.platformSsoAssertion.create).not.toHaveBeenCalled(); // assertion non brûlée
    expect(v2.completeSsoLogin).not.toHaveBeenCalled();
  });

  it('refuse un e-mail inconnu', async () => {
    const { service } = make(null);
    await expect(service.login(sign(), 'web')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('PLATFORM_SSO_ALLOWED_EMAILS : liste blanche facultative', async () => {
    process.env.PLATFORM_SSO_ALLOWED_EMAILS = ' autre@example.com , DONIKO@example.com ';
    const ok = make();
    await expect(ok.service.login(sign(), 'web')).resolves.toBeDefined();
    process.env.PLATFORM_SSO_ALLOWED_EMAILS = 'autre@example.com';
    const ko = make();
    await expect(ko.service.login(sign({ jti: 'jti-aaaaaaaaaaaaaaaa' }), 'web')).rejects.toBeInstanceOf(ForbiddenException);
    expect(ko.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('exige l’en-tête x-app-client: web (comme le login du portail)', async () => {
    const { service, v2 } = make();
    await expect(service.login(sign(), null)).rejects.toBeInstanceOf(HttpException);
    await expect(service.login(sign({ jti: 'jti-bbbbbbbbbbbbbbbb' }), 'mobile')).rejects.toBeInstanceOf(HttpException);
    expect(v2.completeSsoLogin).not.toHaveBeenCalled();
  });
});
