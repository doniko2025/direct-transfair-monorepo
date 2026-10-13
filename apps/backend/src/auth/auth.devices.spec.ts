// apps/backend/src/auth/auth.devices.spec.ts
// Passe 2 (phase 6) — un jeton push n'appartient qu'à un compte ; champs appareil validés.
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { AuthController } from './auth.controller';

function make() {
  const prisma: any = {
    userDevice: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      upsert: jest.fn().mockResolvedValue({ id: 'd1' }),
    },
  };
  const controller = new (AuthController as any)({}, prisma) as AuthController;
  const req: any = { user: { id: 'u2' } };
  return { controller, prisma, req };
}

describe('POST /auth/devices', () => {
  it('retire le jeton push aux autres comptes avant de l\'enregistrer', async () => {
    const { controller, prisma, req } = make();
    await controller.registerDevice(req, { deviceId: 'phone-1', platform: 'ANDROID', pushToken: 'tok' });
    expect(prisma.userDevice.updateMany).toHaveBeenCalledWith({
      where: { pushToken: 'tok', userId: { not: 'u2' } },
      data: { pushToken: null, pushEnabled: false },
    });
    expect(prisma.userDevice.upsert).toHaveBeenCalledTimes(1);
  });

  it('sans jeton : rien à retirer aux autres', async () => {
    const { controller, prisma, req } = make();
    await controller.registerDevice(req, { deviceId: 'phone-1', platform: 'IOS' });
    expect(prisma.userDevice.updateMany).not.toHaveBeenCalled();
  });

  it('plateforme inconnue ou champ trop long → 400, aucune écriture', async () => {
    const { controller, prisma, req } = make();
    await expect(controller.registerDevice(req, { deviceId: 'p', platform: 'PLAYSTATION' as any })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.registerDevice(req, { deviceId: 'x'.repeat(300), platform: 'IOS' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.userDevice.upsert).not.toHaveBeenCalled();
  });
});
