// apps/backend/src/tenants/admin-tenants.spec.ts
// Passe 2 (phase 6) — /admin/tenants réservé au super admin ; l'adresse des bases ne sort plus avec son mot de passe.
import 'reflect-metadata';

// Le client Prisma « platform » est généré au build (absent en test) : on remplace le service par une coquille vide.
jest.mock('../platform/platform-prisma.service', () => ({ PlatformPrismaService: class {} }));

import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/roles.guard';
import { AdminTenantsController } from './admin-tenants.controller';
import { TenantProvisioningService, maskDatabaseUrl } from './tenant-provisioning.service';

function ctx(handler: string, role: string): ExecutionContext {
  return {
    getClass: () => AdminTenantsController,
    getHandler: () => (AdminTenantsController.prototype as any)[handler],
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  } as unknown as ExecutionContext;
}

describe('AdminTenantsController — accès', () => {
  const guard = new RolesGuard(new Reflector());
  it.each(['list', 'provision', 'setActive'])('%s : refusé à un admin de société, au client, à l\'agent', (h) => {
    for (const role of ['COMPANY_ADMIN', 'AGENT', 'USER']) expect(guard.canActivate(ctx(h, role))).toBe(false);
  });
  it.each(['list', 'provision', 'setActive'])('%s : autorisé au super admin', (h) => {
    expect(guard.canActivate(ctx(h, 'SUPER_ADMIN'))).toBe(true);
  });
});

describe('TenantProvisioningService', () => {
  it('maskDatabaseUrl masque le mot de passe', () => {
    expect(maskDatabaseUrl('postgresql://app:s3cret@db.example.com:5432/tenant1')).toBe('postgresql://app:***@db.example.com:5432/tenant1');
    expect(maskDatabaseUrl('pas une url')).toBe('***');
  });

  it('la liste ne renvoie jamais le mot de passe', async () => {
    process.env.DATABASE_URL_PLATFORM = 'x';
    const platform: any = {
      connect: jest.fn(),
      tenant: { findMany: jest.fn().mockResolvedValue([{ code: 'A', name: 'A', databaseUrl: 'postgresql://u:topsecret@h/db', isActive: true, createdAt: new Date() }]) },
    };
    const rows: any[] = await new TenantProvisioningService(platform).listTenants();
    expect(JSON.stringify(rows)).not.toContain('topsecret');
  });

  it('provision : code, URL et nom de base invalides refusés avant toute connexion', async () => {
    process.env.DATABASE_URL_PLATFORM = 'x';
    const platform: any = { connect: jest.fn(), tenant: { findUnique: jest.fn(), upsert: jest.fn() } };
    const svc = new TenantProvisioningService(platform);
    await expect(svc.provisionTenant({ code: 'a b', name: 'n', databaseUrl: 'postgresql://u:p@h/db' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.provisionTenant({ code: 'OK', name: 'n', databaseUrl: 'http://evil/db' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.provisionTenant({ code: 'OK', name: 'n', databaseUrl: 'postgresql://u:p@h/db";DROP', createDatabase: true })).rejects.toBeInstanceOf(BadRequestException);
    expect(platform.connect).not.toHaveBeenCalled();
  });
});
