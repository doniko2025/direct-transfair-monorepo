// Refresh token du portail web : cookie httpOnly, retiré du corps de la réponse ; mobile inchangé.
import 'reflect-metadata';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';

import { AuthController } from './auth.controller';
import { RefreshCookieInterceptor } from './refresh-cookie.interceptor';
import { cookieOptions, readRefreshCookie } from './refresh-cookie';

const ENV = { ...process.env };
afterEach(() => { process.env = { ...ENV }; });

function ctx(headers: Record<string, string>, res: any): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ headers }), getResponse: () => res }),
  } as unknown as ExecutionContext;
}
const run = (headers: Record<string, string>, body: unknown, res: any) =>
  lastValueFrom(new RefreshCookieInterceptor().intercept(ctx(headers, res), { handle: () => of(body) }));

describe('RefreshCookieInterceptor', () => {
  it('web : pose le cookie httpOnly et retire refresh_token du corps', async () => {
    const res = { cookie: jest.fn() };
    const out: any = await run({ 'x-app-client': 'web' }, { access_token: 'A', refresh_token: 'R', user: { id: 1 } }, res);
    expect(out).toEqual({ access_token: 'A', user: { id: 1 } });
    expect(res.cookie).toHaveBeenCalledTimes(1);
    const [name, value, opts] = res.cookie.mock.calls[0];
    expect(name).toBe('dt_rt');
    expect(value).toBe('R');
    expect(opts).toMatchObject({ httpOnly: true, path: '/api/auth' });
    expect(opts.maxAge).toBe(30 * 24 * 3600 * 1000);
  });

  it('mobile (sans en-tête web) : corps inchangé, aucun cookie', async () => {
    const res = { cookie: jest.fn() };
    const body = { access_token: 'A', refresh_token: 'R' };
    await expect(run({}, body, res)).resolves.toEqual(body);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('web : une réponse sans refresh_token passe telle quelle', async () => {
    const res = { cookie: jest.fn() };
    await expect(run({ 'x-app-client': 'web' }, { ok: true }, res)).resolves.toEqual({ ok: true });
    await expect(run({ 'x-app-client': 'web' }, [1, 2], res)).resolves.toEqual([1, 2]);
    expect(res.cookie).not.toHaveBeenCalled();
  });
});

describe('options du cookie', () => {
  it('production : Secure + SameSite=None par défaut ; réglable', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.AUTH_COOKIE_SAMESITE;
    expect(cookieOptions()).toMatchObject({ secure: true, sameSite: 'none', httpOnly: true });
    process.env.AUTH_COOKIE_SAMESITE = 'lax';
    expect(cookieOptions()).toMatchObject({ secure: true, sameSite: 'lax' });
    process.env.AUTH_COOKIE_DOMAIN = '.exemple.com';
    expect(cookieOptions().domain).toBe('.exemple.com');
  });

  it('développement : SameSite=Lax, non Secure (http://localhost)', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.AUTH_COOKIE_SAMESITE;
    expect(cookieOptions()).toMatchObject({ secure: false, sameSite: 'lax' });
  });

  it('SameSite=None impose Secure', () => {
    process.env.NODE_ENV = 'development';
    process.env.AUTH_COOKIE_SAMESITE = 'none';
    process.env.AUTH_COOKIE_SECURE = 'false';
    expect(cookieOptions().secure).toBe(true);
  });

  it('lit le cookie parmi d\'autres, ignore les valeurs illisibles', () => {
    expect(readRefreshCookie({ headers: { cookie: 'a=1; dt_rt=abc123; b=2' } } as any)).toBe('abc123');
    expect(readRefreshCookie({ headers: { cookie: 'a=1' } } as any)).toBeUndefined();
    expect(readRefreshCookie({ headers: { cookie: 'dt_rt=%E0%A4%A' } } as any)).toBeUndefined();
    expect(readRefreshCookie({ headers: {} } as any)).toBeUndefined();
  });
});

describe('AuthController.refresh / logout', () => {
  const make = () => {
    const authService: any = {
      refreshTokens: jest.fn().mockResolvedValue({ access_token: 'A2', refresh_token: 'R2' }),
      logout: jest.fn().mockResolvedValue({ success: true }),
    };
    const controller = new (AuthController as any)(authService) as AuthController;
    return { controller, authService };
  };
  const res = () => ({ cookie: jest.fn(), clearCookie: jest.fn() }) as any;

  it('web : utilise le cookie quand le corps est vide', async () => {
    const { controller, authService } = make();
    const r = await controller.refresh({} as any, 'web', { headers: { 'x-app-client': 'web', cookie: 'dt_rt=COOKIE_TOKEN' } } as any, res());
    expect(authService.refreshTokens).toHaveBeenCalledWith('COOKIE_TOKEN', 'web');
    expect(r).toEqual({ access_token: 'A2', refresh_token: 'R2' }); // l'intercepteur global retire refresh_token
  });

  it('un cookie sans l\'en-tête web est ignoré (CSRF) -> 401', async () => {
    const { controller, authService } = make();
    await expect(controller.refresh({} as any, undefined, { headers: { cookie: 'dt_rt=X' } } as any, res())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authService.refreshTokens).not.toHaveBeenCalled();
  });

  it('mobile : le refresh_token du corps fonctionne comme avant', async () => {
    const { controller, authService } = make();
    await controller.refresh({ refresh_token: 'BODY' } as any, undefined, { headers: {} } as any, res());
    expect(authService.refreshTokens).toHaveBeenCalledWith('BODY', null);
  });

  it('web : un refresh refusé efface le cookie', async () => {
    const { controller, authService } = make();
    authService.refreshTokens.mockRejectedValue(new UnauthorizedException('Session invalide'));
    const r = res();
    await expect(controller.refresh({} as any, 'web', { headers: { 'x-app-client': 'web', cookie: 'dt_rt=OLD' } } as any, r)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(r.clearCookie).toHaveBeenCalled();
  });

  it('logout web : efface le cookie et révoque par identifiant de session', async () => {
    const { controller, authService } = make();
    const r = res();
    await controller.logout({ headers: { 'x-app-client': 'web', authorization: 'Bearer T' }, user: { id: 'u1', sid: 'S1' } } as any, r);
    expect(r.clearCookie).toHaveBeenCalled();
    expect(authService.logout).toHaveBeenCalledWith('u1', 'T', 'S1');
  });
});
