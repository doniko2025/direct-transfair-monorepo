// apps/backend/src/support/support-staff.service.spec.ts
// Toggles du service client : liste filtrée, clés inconnues ignorées, changement tracé avant/après, cloisonnement par société, suspension ferme les sessions.
import 'reflect-metadata';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { SupportStaffService } from './support-staff.service';

type J = Record<string, any>;
const admin = { id: 'adm', role: 'COMPANY_ADMIN', clientId: 7 } as any;
const otherAdmin = { id: 'adm9', role: 'COMPANY_ADMIN', clientId: 9 } as any;

function setup(perms: string[] = ['KYC_REVIEW']) {
  const audits: J[] = [];
  const row = { id: 'sp1', email: 'sup@x.fr', phone: null, firstName: 'Fatou', lastName: 'Ba', isActive: true, isSuspended: false, mustChangePassword: true, lastLoginAt: null, createdAt: new Date(), clientId: 7, supportPermissions: perms };
  const prisma: J = {
    user: {
      findFirst: jest.fn(async ({ where }: J) => ((where.id === row.id || where.id === 'new') && where.clientId === row.clientId && where.role === 'SUPPORT' ? row : null)),
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => [row]),
      create: jest.fn(async ({ data }: J) => ({ id: 'new' , ...data })),
      update: jest.fn(async ({ data }: J) => Object.assign(row, data)),
    },
    userSession: { deleteMany: jest.fn(async () => ({ count: 2 })) },
    auditLog: { create: jest.fn(async ({ data }: J) => { audits.push(data); return data; }) },
    $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
  };
  const mail = { sendEmail: jest.fn(async () => undefined) };
  return { service: new SupportStaffService(prisma as any, mail as any), prisma, audits, mail, row };
}

describe('SupportStaffService', () => {
  it('liste : droits posés ET droits effectifs (implications)', async () => {
    const { service } = setup(['DISPUTES_RESOLVE']);
    const r = await service.list(admin);
    expect(r.data[0].permissions).toEqual(['DISPUTES_RESOLVE']);
    expect(r.data[0].effectivePermissions).toEqual(['TICKETS_HANDLE', 'DISPUTES_RESOLVE', 'TRANSACTIONS_VIEW'].sort((a, b) => ['CLIENTS_VIEW','KYC_REVIEW','KYC_COUNTER','ACCOUNT_SUSPEND','ACCOUNT_REACTIVATE','TICKETS_HANDLE','DISPUTES_RESOLVE','REFUNDS_DECIDE','TRANSACTIONS_VIEW'].indexOf(a) - ['CLIENTS_VIEW','KYC_REVIEW','KYC_COUNTER','ACCOUNT_SUSPEND','ACCOUNT_REACTIVATE','TICKETS_HANDLE','DISPUTES_RESOLVE','REFUNDS_DECIDE','TRANSACTIONS_VIEW'].indexOf(b)));
  });

  it('interrupteurs : clés inconnues ignorées, changement tracé (activé / désactivé)', async () => {
    const { service, prisma, audits } = setup(['KYC_REVIEW']);
    const v = await service.setPermissions(admin, 'sp1', { permissions: ['ACCOUNT_SUSPEND', 'PIRATE', 'ACCOUNT_SUSPEND'] });
    expect(prisma.user.update.mock.calls[0][0].data).toEqual({ supportPermissions: ['ACCOUNT_SUSPEND'] });
    expect(audits[0]).toMatchObject({ action: 'SUPPORT_PERMISSIONS_UPDATE', details: { before: ['KYC_REVIEW'], after: ['ACCOUNT_SUSPEND'], enabled: ['ACCOUNT_SUSPEND'], disabled: ['KYC_REVIEW'] } });
    expect(v.permissions).toEqual(['ACCOUNT_SUSPEND']);
  });

  it('aucun changement : rien n\'est écrit ni tracé', async () => {
    const { service, prisma, audits } = setup(['KYC_REVIEW']);
    await service.setPermissions(admin, 'sp1', { permissions: ['KYC_REVIEW'] });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(audits).toHaveLength(0);
  });

  it('cloisonné par société', async () => {
    const { service } = setup();
    await expect(service.setPermissions(otherAdmin, 'sp1', { permissions: [] })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.setPermissions({ id: 'x', role: 'COMPANY_ADMIN' } as any, 'sp1', { permissions: [] })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('création : rôle SUPPORT, mot de passe temporaire à changer, délégations nettoyées, e-mail envoyé, tracé', async () => {
    const { service, prisma, audits, mail } = setup();
    const r = await service.create(admin, { email: ' Sup2@X.fr ', firstName: 'Awa', lastName: 'Sy', permissions: ['CLIENTS_VIEW', 'HACK'] });
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ email: 'sup2@x.fr', role: 'SUPPORT', mustChangePassword: true, clientId: 7, supportPermissions: ['CLIENTS_VIEW'] });
    expect(data.password).not.toBe(r.generatedPassword); // haché
    expect(r.generatedPassword).toHaveLength(24);
    expect(audits[0]).toMatchObject({ action: 'SUPPORT_STAFF_CREATE' });
    expect(mail.sendEmail).toHaveBeenCalled();
  });

  it('e-mail déjà utilisé → 409', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'x' });
    await expect(service.create(admin, { email: 'a@b.fr', firstName: 'A', lastName: 'B' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('suspension : compte gelé ET sessions fermées ; réactivation : levée', async () => {
    const { service, prisma } = setup();
    await service.setActive(admin, 'sp1', false);
    expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({ where: { userId: 'sp1' } });
    expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({ isSuspended: true });
    await service.setActive(admin, 'sp1', true);
    expect(prisma.user.update.mock.calls[1][0].data).toMatchObject({ isSuspended: false, suspendedReason: null });
  });
});
