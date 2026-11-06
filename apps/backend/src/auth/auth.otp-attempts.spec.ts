// OTP v1 — plafond d'essais, comparaison, consommation unique, sessions fermées après réinitialisation du mot de passe.
import 'reflect-metadata';
import { BadRequestException, HttpException } from '@nestjs/common';
import { AuthService } from './auth.service';

type Json = Record<string, any>;

function setup(code = '123456', attempts = 0) {
  const row: Json = { id: 'o1', userId: 'u1', code, purpose: 'PASSWORD_RESET', channel: 'SMS', attempts, isUsed: false, isExpired: false };
  const prisma: Json = {
    otpLog: {
      findFirst: jest.fn().mockImplementation(async () => (row.isUsed || row.isExpired ? null : { ...row })),
      updateMany: jest.fn().mockImplementation(async ({ where, data }: Json) => {
        if (where.id !== row.id) return { count: 0 };
        if (where.isUsed === false && row.isUsed) return { count: 0 };
        if (where.attempts?.lt !== undefined && !(row.attempts < where.attempts.lt)) return { count: 0 };
        for (const [k, v] of Object.entries(data)) {
          row[k] = (v as Json)?.increment ? row[k] + (v as Json).increment : v;
        }
        return { count: 1 };
      }),
    },
    user: {
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue({ id: 'u1', clientId: 1 }),
    },
    userSession: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const service: any = Object.create(AuthService.prototype);
  service.prisma = prisma;
  service.audit = jest.fn().mockResolvedValue(undefined);
  return { service, prisma, row };
}

describe('AuthService — codes OTP (v1)', () => {
  it('un bon code est accepté une seule fois', async () => {
    const { service } = setup();
    await expect(service.consumeOtp('u1', '123456', 'PASSWORD_RESET')).resolves.toMatchObject({ id: 'o1' });
    await expect(service.consumeOtp('u1', '123456', 'PASSWORD_RESET')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un mauvais code consomme un essai et indique ce qu\'il reste', async () => {
    const { service, row } = setup();
    await expect(service.consumeOtp('u1', '000000', 'PASSWORD_RESET')).rejects.toThrow(/4 tentative/);
    expect(row.attempts).toBe(1);
    expect(row.isUsed).toBe(false);
  });

  it('au-delà du plafond, même le bon code est refusé (429) et le code est invalidé', async () => {
    const { service, row } = setup('123456', 5);
    await expect(service.consumeOtp('u1', '123456', 'PASSWORD_RESET')).rejects.toBeInstanceOf(HttpException);
    expect(row.isExpired).toBe(true);
    expect(row.isUsed).toBe(false);
  });

  it('cinq mauvais essais d\'affilée invalident le code', async () => {
    const { service, row } = setup();
    for (let i = 0; i < 5; i++) await service.consumeOtp('u1', '000000', 'PASSWORD_RESET').catch(() => undefined);
    expect(row.isExpired).toBe(true);
    await expect(service.consumeOtp('u1', '123456', 'PASSWORD_RESET')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un objet à la place du code ne passe pas', async () => {
    const { service } = setup();
    await expect(service.consumeOtp('u1', { $ne: '' } as any, 'PASSWORD_RESET')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('réinitialisation du mot de passe : toutes les sessions ouvertes sont fermées', async () => {
    const { service, prisma } = setup();
    await service.resetPassword('u1', '123456', 'nouveau-secret');
    expect(prisma.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', status: 'ACTIVE' }, data: expect.objectContaining({ status: 'REVOKED' }) }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ mustChangePassword: false, failedLoginAttempts: 0 }) }));
  });
});
