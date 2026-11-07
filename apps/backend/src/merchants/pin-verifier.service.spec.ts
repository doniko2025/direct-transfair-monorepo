import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { PIN_INVALID_CODE, PIN_LOCKED_CODE, PinVerifierService } from './pin-verifier.service';

async function setup(user: Record<string, unknown> = {}) {
  const row: any = { password: await bcrypt.hash('486213', 4), failedLoginAttempts: 0, lockedUntil: null, ...user };
  const prisma: any = {
    user: {
      findUnique: jest.fn(async () => row),
      update: jest.fn(async ({ data }: any) => {
        if (data.failedLoginAttempts?.increment) row.failedLoginAttempts += data.failedLoginAttempts.increment;
        else if (data.failedLoginAttempts !== undefined) row.failedLoginAttempts = data.failedLoginAttempts;
        if ('lockedUntil' in data) row.lockedUntil = data.lockedUntil;
        return row;
      }),
    },
  };
  return { service: new PinVerifierService(prisma), row, prisma };
}
const code = (e: any) => e.getResponse().code;

describe('PinVerifierService', () => {
  it('bon code : passe, et remet le compteur à zéro', async () => {
    const { service, row } = await setup({ failedLoginAttempts: 3 });
    await expect(service.assertPin('u', '486213')).resolves.toBeUndefined();
    expect(row.failedLoginAttempts).toBe(0);
  });

  it('mauvais code : 403 PIN_INVALID avec le nombre d’essais restants', async () => {
    const { service } = await setup();
    const err: any = await service.assertPin('u', '111111').catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(code(err)).toBe(PIN_INVALID_CODE);
    expect(err.getResponse().attemptsLeft).toBe(4);
  });

  it('format invalide (lettres, 5 chiffres, vide, non texte) : refusé comme un mauvais code', async () => {
    const { service } = await setup();
    for (const bad of ['abcdef', '12345', '', 486213, null, undefined]) {
      await expect(service.assertPin('u', bad)).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it('5 erreurs : compte bloqué 30 min, même le bon code est refusé ensuite', async () => {
    const { service, row } = await setup();
    for (let i = 0; i < 4; i++) await service.assertPin('u', '000000').catch(() => undefined);
    const fifth: any = await service.assertPin('u', '000000').catch((e) => e);
    expect(code(fifth)).toBe(PIN_LOCKED_CODE);
    expect(row.lockedUntil.getTime()).toBeGreaterThan(Date.now() + 29 * 60_000);
    const withGood: any = await service.assertPin('u', '486213').catch((e) => e);
    expect(code(withGood)).toBe(PIN_LOCKED_CODE);
  });

  it('verrouillage échu : le bon code passe et débloque', async () => {
    const { service, row } = await setup({ failedLoginAttempts: 5, lockedUntil: new Date(Date.now() - 1000) });
    await expect(service.assertPin('u', '486213')).resolves.toBeUndefined();
    expect(row.lockedUntil).toBeNull();
    expect(row.failedLoginAttempts).toBe(0);
  });
});
