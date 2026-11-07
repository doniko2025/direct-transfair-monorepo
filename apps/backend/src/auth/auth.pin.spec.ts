// apps/backend/src/auth/auth.pin.spec.ts
// Lot 10 — le code secret à 6 chiffres est exigé des clients du portefeuille (rôle USER) à l'inscription, au changement et à la
// réinitialisation ; les comptes web gardent leur règle de mot de passe.
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

const svc = (name: 'changePassword' | 'resetPassword') => (AuthService.prototype as any)[name] as (...a: any[]) => Promise<any>;

async function hashed(pw: string) {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(pw, 4);
}

async function changeCtx(user: Record<string, unknown>) {
  const update = jest.fn().mockResolvedValue({});
  const self: any = {
    prisma: { user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', clientId: 7, email: null, ...user }), update } },
    audit: jest.fn().mockResolvedValue(undefined),
    mail: { sendEmail: jest.fn().mockResolvedValue(undefined) },
    logger: { warn: jest.fn() },
  };
  return { self, update };
}

describe('changePassword — client du portefeuille', () => {
  it('refuse un code faible (400 PIN_WEAK) sans rien écrire', async () => {
    const { self, update } = await changeCtx({ role: 'USER', password: await hashed('AncienMotDePasse1') });
    const err: any = await svc('changePassword').call(self, 'u1', 'AncienMotDePasse1', '123456').catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.getResponse()).toMatchObject({ code: 'PIN_WEAK' });
    expect(update).not.toHaveBeenCalled();
  });

  it('refuse un ancien mot de passe en guise de nouveau code (pas 6 chiffres)', async () => {
    const { self } = await changeCtx({ role: 'USER', password: await hashed('739204') });
    await expect(svc('changePassword').call(self, 'u1', '739204', 'MotDePasseLong9')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse la date de naissance et le téléphone du client', async () => {
    const { self } = await changeCtx({ role: 'USER', password: await hashed('739204'), birthDate: '1990-05-12', phone: '+33612345678' });
    await expect(svc('changePassword').call(self, 'u1', '739204', '120590')).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc('changePassword').call(self, 'u1', '739204', '234567')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lot 13 : avec TEST_PIN_ENABLED=true, 000000 vaut « mot de passe actuel » ; sinon il est refusé', async () => {
    const saved = process.env.TEST_PIN_ENABLED;
    try {
      delete process.env.TEST_PIN_ENABLED;
      const off = await changeCtx({ role: 'USER', password: await hashed('Temporaire1'), mustChangePassword: true });
      await expect(svc('changePassword').call(off.self, 'u1', '000000', '486213')).rejects.toBeInstanceOf(BadRequestException);

      process.env.TEST_PIN_ENABLED = 'true';
      const on = await changeCtx({ role: 'USER', password: await hashed('Temporaire1'), mustChangePassword: true });
      await svc('changePassword').call(on.self, 'u1', '000000', '486213');
      expect(on.update.mock.calls[0][0].data).toMatchObject({ mustChangePassword: false });
    } finally {
      if (saved === undefined) delete process.env.TEST_PIN_ENABLED; else process.env.TEST_PIN_ENABLED = saved;
    }
  });

  it('accepte un bon code, enregistre pinSetAt et lève le drapeau mustChangePassword', async () => {
    const { self, update } = await changeCtx({ role: 'USER', password: await hashed('Temporaire1'), mustChangePassword: true });
    await svc('changePassword').call(self, 'u1', 'Temporaire1', '486213');
    const data = update.mock.calls[0][0].data;
    expect(data).toMatchObject({ mustChangePassword: false });
    expect(data.pinSetAt).toBeInstanceOf(Date);
  });

  it('refuse un nouveau code identique à l\'ancien', async () => {
    const { self } = await changeCtx({ role: 'USER', password: await hashed('486213') });
    await expect(svc('changePassword').call(self, 'u1', '486213', '486213')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un compte web (COMPANY_ADMIN) garde sa règle : pas de pinSetAt, mot de passe libre', async () => {
    const { self, update } = await changeCtx({ role: 'COMPANY_ADMIN', password: await hashed('Temporaire1') });
    await svc('changePassword').call(self, 'u1', 'Temporaire1', 'MotDePasseLongEtSolide9');
    expect(update.mock.calls[0][0].data.pinSetAt).toBeUndefined();
  });
});

describe('resetPassword — client du portefeuille', () => {
  function resetCtx(user: Record<string, unknown>) {
    const consumeOtp = jest.fn().mockResolvedValue({});
    const update = jest.fn().mockResolvedValue({});
    const self: any = {
      prisma: {
        user: { findUnique: jest.fn().mockResolvedValue({ clientId: 7, ...user }), update },
        userSession: { updateMany: jest.fn().mockResolvedValue({}) },
      },
      consumeOtp,
      audit: jest.fn().mockResolvedValue(undefined),
    };
    return { self, consumeOtp, update };
  }

  it('un code faible est refusé AVANT de consommer le code SMS', async () => {
    const { self, consumeOtp } = resetCtx({ role: 'USER' });
    await expect(svc('resetPassword').call(self, 'u1', '123456', '111111')).rejects.toBeInstanceOf(BadRequestException);
    expect(consumeOtp).not.toHaveBeenCalled();
  });

  it('un bon code est enregistré avec pinSetAt', async () => {
    const { self, consumeOtp, update } = resetCtx({ role: 'USER' });
    await svc('resetPassword').call(self, 'u1', '123456', '905371');
    expect(consumeOtp).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].data.pinSetAt).toBeInstanceOf(Date);
    expect(update.mock.calls[0][0].data).toMatchObject({ mustChangePassword: false, failedLoginAttempts: 0 });
  });
});
