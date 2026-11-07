// Lot 13 — connexion /auth/v2/login-password par TÉLÉPHONE + code à 6 chiffres, et code de test 000000 (désactivé par défaut).
import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { V2AuthService } from './v2-auth.service';

async function setup(overrides: Record<string, unknown> = {}) {
  const row: any = {
    id: 'u1', email: 'a@b.fr', phone: '+33612345678', role: 'USER', clientId: 1, client: { isActive: true },
    password: await bcrypt.hash('486213', 4), isEmailVerified: true, isPhoneVerified: true,
    isActive: true, isSuspended: false, deletedAt: null, lockedUntil: null, failedLoginAttempts: 0, wallets: [], ...overrides,
  };
  const prisma: any = {
    user: {
      findUnique: jest.fn(async () => row),
      findFirst: jest.fn(async () => row),
      update: jest.fn(async () => row),
    },
  };
  const service = new V2AuthService(prisma, {} as any, {} as any, {} as any);
  jest.spyOn(service as any, 'buildLoginResponse').mockResolvedValue({ access_token: 'a', refresh_token: 'r', user: {} });
  jest.spyOn(service as any, 'markLastLogin').mockResolvedValue(undefined);
  jest.spyOn(service as any, 'audit').mockResolvedValue(undefined);
  jest.spyOn(service as any, 'buildVerificationNeeded').mockReturnValue(null);
  jest.spyOn(service as any, 'handleFailedLogin').mockResolvedValue(undefined);
  return { service, prisma, row };
}

describe('V2AuthService.loginWithPassword — téléphone + code', () => {
  const saved = process.env.TEST_PIN_ENABLED;
  afterEach(() => { if (saved === undefined) delete process.env.TEST_PIN_ENABLED; else process.env.TEST_PIN_ENABLED = saved; });

  it('connecte avec le téléphone (écrit avec espaces) et le bon code', async () => {
    const { service, prisma } = await setup();
    const res: any = await service.loginWithPassword({ phone: '+33 6 12 34 56 78', password: '486213' }, 'ACME', 'mobile');
    expect(res.access_token).toBe('a');
    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { phone: '+33612345678' } }));
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('l’email fonctionne toujours (web-admin et option « email + mot de passe »)', async () => {
    const { service, prisma } = await setup();
    await service.loginWithPassword({ email: ' A@B.fr ', password: '486213' }, 'ACME', 'mobile');
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: 'a@b.fr' } }));
  });

  it('ni email ni téléphone : 400', async () => {
    const { service } = await setup();
    await expect(service.loginWithPassword({ password: '486213' } as any, 'ACME', 'mobile')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('mauvais code : 401 « Identifiants incorrects »', async () => {
    const { service } = await setup();
    await expect(service.loginWithPassword({ phone: '+33612345678', password: '111111' }, 'ACME', 'mobile')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('000000 refusé tant que TEST_PIN_ENABLED n’est pas « true »', async () => {
    delete process.env.TEST_PIN_ENABLED;
    const { service } = await setup();
    await expect(service.loginWithPassword({ phone: '+33612345678', password: '000000' }, 'ACME', 'mobile')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('000000 accepté quand TEST_PIN_ENABLED=true (client), refusé pour un administrateur', async () => {
    process.env.TEST_PIN_ENABLED = 'true';
    const ok = await setup();
    await expect(ok.service.loginWithPassword({ phone: '+33612345678', password: '000000' }, 'ACME', 'mobile')).resolves.toBeDefined();
    const admin = await setup({ role: 'COMPANY_ADMIN' });
    await expect(admin.service.loginWithPassword({ phone: '+33612345678', password: '000000' }, 'ACME', 'web')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
