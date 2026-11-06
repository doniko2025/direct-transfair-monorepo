// Sessions actives : liste (appareil courant en tête, expirées exclues), révocation, « déconnecter les autres ».
import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserSessionsService } from './user-sessions.service';

function make(rows: any[] = [], updateCount = 1) {
  const prisma: any = {
    userSession: {
      findMany: jest.fn().mockResolvedValue(rows),
      updateMany: jest.fn().mockResolvedValue({ count: updateCount }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return { svc: new UserSessionsService(prisma), prisma };
}

const row = (id: string, createdAt: string) => ({
  id, device: null, ipAddress: '1.2.3.4', userAgent: 'UA', country: 'FR',
  createdAt: new Date(createdAt), expiresAt: new Date('2099-01-01'),
});

describe('UserSessionsService.list', () => {
  it('ne lit que les sessions actives non expirées de cet utilisateur', async () => {
    const { svc, prisma } = make([]);
    await svc.list('u1', 's1');
    const arg = prisma.userSession.findMany.mock.calls[0][0];
    expect(arg.where.userId).toBe('u1');
    expect(arg.where.status).toBe('ACTIVE');
    expect(arg.where.expiresAt.gt).toBeInstanceOf(Date);
    expect(arg.take).toBe(100);
  });

  it("marque l'appareil courant et le place en premier", async () => {
    const { svc } = make([row('a', '2026-11-03'), row('b', '2026-11-02'), row('c', '2026-11-01')]);
    const out = await svc.list('u1', 'b');
    expect(out.map((s) => s.id)).toEqual(['b', 'a', 'c']);
    expect(out.map((s) => s.current)).toEqual([true, false, false]);
  });

  it('sans identifiant de session (ancien jeton) : aucune session courante', async () => {
    const { svc } = make([row('a', '2026-11-03')]);
    const out = await svc.list('u1', undefined);
    expect(out[0].current).toBe(false);
  });
});

describe('UserSessionsService.revoke', () => {
  it("ne révoque que les sessions actives de l'utilisateur", async () => {
    const { svc, prisma } = make([], 1);
    const r = await svc.revoke('u1', 's2', 's1');
    expect(prisma.userSession.updateMany.mock.calls[0][0].where).toEqual({ id: 's2', userId: 'u1', status: 'ACTIVE' });
    expect(r).toEqual({ success: true, wasCurrent: false });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('indique quand la session fermée est celle de l\'appareil courant', async () => {
    const { svc } = make([], 1);
    expect((await svc.revoke('u1', 's1', 's1')).wasCurrent).toBe(true);
  });

  it('session inconnue, déjà fermée ou à un autre utilisateur → 404, pas d\'audit', async () => {
    const { svc, prisma } = make([], 0);
    await expect(svc.revoke('u1', 'zzz', 's1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe('UserSessionsService.revokeOthers', () => {
  it("ferme toutes les sessions actives sauf l'appareil courant", async () => {
    const { svc, prisma } = make([], 3);
    const r = await svc.revokeOthers('u1', 's1');
    expect(prisma.userSession.updateMany.mock.calls[0][0].where).toEqual({
      userId: 'u1', status: 'ACTIVE', id: { not: 's1' },
    });
    expect(r).toEqual({ success: true, revoked: 3 });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('aucune autre session : pas d\'écriture d\'audit', async () => {
    const { svc, prisma } = make([], 0);
    expect((await svc.revokeOthers('u1', 's1')).revoked).toBe(0);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("sans identifiant de session (ancien jeton) → 400 et rien n'est fermé", async () => {
    const { svc, prisma } = make([], 5);
    await expect(svc.revokeOthers('u1', undefined)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.userSession.updateMany).not.toHaveBeenCalled();
  });
});
