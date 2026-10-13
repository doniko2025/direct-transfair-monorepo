// apps/backend/src/agents-admin/agents-admin.reset.spec.ts
// Passe 2 (phase 6) — la réinitialisation du mot de passe d'un agent ferme ses sessions.
import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { AgentsAdminService } from './agents-admin.service';

function make(found: any) {
  const prisma: any = {
    user: {
      findFirst: jest.fn().mockResolvedValue(found),
      update: jest.fn().mockReturnValue('update-op'),
    },
    userSession: { deleteMany: jest.fn().mockReturnValue('delete-op') },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const mail: any = { sendEmail: jest.fn().mockResolvedValue(undefined) };
  return { service: new AgentsAdminService(prisma, mail), prisma, mail };
}

const admin: any = { id: 'adm', role: 'COMPANY_ADMIN', clientId: 5 };

describe('AgentsAdminService.resetPassword', () => {
  it('change le mot de passe ET supprime les sessions, dans la même transaction', async () => {
    const { service, prisma } = make({ id: 'ag1', email: 'a@x.com', firstName: 'A' });
    const r = await service.resetPassword(admin, 'ag1');
    expect(r.generatedPassword).toHaveLength(24);
    expect(prisma.$transaction).toHaveBeenCalledWith(['update-op', 'delete-op']);
    expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({ where: { userId: 'ag1' } });
    expect(prisma.user.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'ag1', clientId: 5, role: 'AGENT' });
  });

  it('agent d\'une autre société → 404, rien n\'est modifié', async () => {
    const { service, prisma } = make(null);
    await expect(service.resetPassword(admin, 'ag-autre')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
