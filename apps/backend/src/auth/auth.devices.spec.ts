// apps/backend/src/auth/auth.devices.spec.ts
// Passe 2 (phase 6) — un jeton push n'appartient qu'à un compte ; champs appareil validés.
import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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

describe('DELETE /auth/devices/:deviceId', () => {
  function makeRevoke(found: any) {
    const prisma: any = {
      userDevice: {
        findFirst: jest.fn().mockResolvedValue(found),
        update: jest.fn().mockResolvedValue({}),
      },
      userSession: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const controller = new (AuthController as any)({}, prisma, {}) as AuthController;
    return { controller, prisma, req: { user: { id: 'u1', sid: 'sess-now' } } as any };
  }

  it("trouve l'appareil par son id de fiche OU son identifiant matériel, limité à l'utilisateur", async () => {
    const { controller, prisma, req } = makeRevoke({ id: 'cuid1', deviceId: 'hw-1' });
    await controller.revokeDevice(req, 'cuid1');
    expect(prisma.userDevice.findFirst.mock.calls[0][0].where).toEqual({
      userId: 'u1',
      OR: [{ id: 'cuid1' }, { deviceId: 'cuid1' }],
    });
  });

  it('révoque la fiche, coupe le jeton push et ferme les sessions liées sauf la session courante', async () => {
    const { controller, prisma, req } = makeRevoke({ id: 'cuid1', deviceId: 'hw-1' });
    const r = await controller.revokeDevice(req, 'hw-1');
    expect(prisma.userDevice.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'cuid1' },
      data: { status: 'REVOKED', pushEnabled: false, pushToken: null },
    });
    const w = prisma.userSession.updateMany.mock.calls[0][0].where;
    expect(w).toMatchObject({ userId: 'u1', status: 'ACTIVE', deviceId: { in: ['cuid1', 'hw-1'] }, id: { not: 'sess-now' } });
    expect(r).toEqual({ success: true, sessionsClosed: 2 });
  });

  it('appareil inconnu ou à un autre compte → 404, rien de modifié', async () => {
    const { controller, prisma, req } = makeRevoke(null);
    await expect(controller.revokeDevice(req, 'x')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.userDevice.update).not.toHaveBeenCalled();
    expect(prisma.userSession.updateMany).not.toHaveBeenCalled();
  });
});
