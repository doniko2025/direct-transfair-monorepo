import { ConflictException, ForbiddenException } from '@nestjs/common';
import { AccountDeletionService } from './account-deletion.service';

function make(over: { user?: any; pinError?: any; payouts?: number; softDelete?: () => Promise<any> } = {}) {
  const user = over.user === undefined ? { id: 'u1', role: 'USER', phone: '+33751244722', deletedAt: null, clientId: 1 } : over.user;
  const prisma: any = {
    user: { findUnique: jest.fn(async () => user) },
    merchantPayout: { count: jest.fn(async () => over.payouts ?? 0) },
    userSession: { updateMany: jest.fn(async () => ({ count: 2 })) },
    merchantProfile: { updateMany: jest.fn(async () => ({ count: 1 })) },
    userPhoto: { deleteMany: jest.fn(async () => ({ count: 1 })) },
    auditLog: { create: jest.fn(async () => ({})) },
  };
  const users: any = { softDelete: jest.fn(over.softDelete ?? (async () => ({ deleted: true }))) };
  const pins: any = { assertPin: jest.fn(async () => { if (over.pinError) throw over.pinError; }) };
  return { svc: new AccountDeletionService(prisma, users, pins), prisma, users, pins };
}

describe('AccountDeletionService', () => {
  it('supprime le compte quand le téléphone et le code secret sont bons, ferme les sessions et efface la photo', async () => {
    const { svc, prisma, users, pins } = make();
    const r = await svc.deleteMyAccount('u1', { phone: '07 51 24 47 22', pin: '123456' }).catch((e) => e);
    // « 07… » sans indicatif ne correspond pas au +33… stocké : refus
    expect(r).toBeInstanceOf(ForbiddenException);
    expect(pins.assertPin).not.toHaveBeenCalled();

    const ok = await svc.deleteMyAccount('u1', { phone: '+33 7 51 24 47 22', pin: '123456' });
    expect(ok.deleted).toBe(true);
    expect(pins.assertPin).toHaveBeenCalledWith('u1', '123456');
    expect(users.softDelete).toHaveBeenCalledWith('u1');
    expect(prisma.userSession.updateMany).toHaveBeenCalled();
    expect(prisma.userPhoto.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.merchantProfile.updateMany).toHaveBeenCalled();
  });

  it("un mauvais numéro est refusé sans consommer d'essai de code secret", async () => {
    const { svc, pins, users } = make();
    await expect(svc.deleteMyAccount('u1', { phone: '+33600000000', pin: '123456' })).rejects.toMatchObject({ response: { code: 'PHONE_MISMATCH' } });
    expect(pins.assertPin).not.toHaveBeenCalled();
    expect(users.softDelete).not.toHaveBeenCalled();
  });

  it('un code secret faux empêche la suppression', async () => {
    const { svc, users } = make({ pinError: new ForbiddenException({ code: 'PIN_INVALID' }) });
    await expect(svc.deleteMyAccount('u1', { phone: '+33751244722', pin: '000001' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(users.softDelete).not.toHaveBeenCalled();
  });

  it('refuse tant qu\'un retrait marchand est en attente', async () => {
    const { svc, users } = make({ payouts: 1 });
    await expect(svc.deleteMyAccount('u1', { phone: '+33751244722', pin: '123456' })).rejects.toMatchObject({ response: { code: 'PENDING_OPERATIONS' } });
    expect(users.softDelete).not.toHaveBeenCalled();
  });

  it('refuse (409) quand il reste de l\'argent : rien n\'est nettoyé', async () => {
    const { svc, prisma } = make({ softDelete: async () => { throw new ConflictException({ code: 'BALANCE_NOT_EMPTY' }); } });
    await expect(svc.deleteMyAccount('u1', { phone: '+33751244722', pin: '123456' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.userSession.updateMany).not.toHaveBeenCalled();
    expect(prisma.userPhoto.deleteMany).not.toHaveBeenCalled();
  });

  it('réservée aux clients (rôle USER)', async () => {
    const { svc } = make({ user: { id: 'a1', role: 'AGENT', phone: '+33751244722', deletedAt: null } });
    await expect(svc.deleteMyAccount('a1', { phone: '+33751244722', pin: '123456' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
