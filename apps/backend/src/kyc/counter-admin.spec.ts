// apps/backend/src/kyc/counter-admin.spec.ts
// Consultation des clients de passage par les administrateurs : cloisonnement par société, numéro masqué en liste, journalisation.
import 'reflect-metadata';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { CounterAdminService, maskIdNumber } from './counter-admin.service';

type J = Record<string, any>;

const admin = { id: 'adm', role: 'COMPANY_ADMIN', clientId: 7 } as any;
const otherAdmin = { id: 'adm2', role: 'COMPANY_ADMIN', clientId: 9 } as any;
const superAdmin = { id: 'sa', role: 'SUPER_ADMIN' } as any;
const agent = { id: 'ag', role: 'AGENT', clientId: 7 } as any;

function setup() {
  const audits: J[] = [];
  const row = {
    id: 'cc1', clientId: 7, firstName: 'Awa', lastName: 'Diop', phone: '+33612345678', birthDate: new Date('1990-05-12'), idType: 'PASSPORT', idNumber: 'AB123456', idCountry: 'SN',
    idExpiry: new Date('2099-01-01'), idPhotoAt: new Date('2026-11-01'), createdAt: new Date('2026-10-01'), createdById: 'ag',
    files: [{ kind: 'FRONT', mimeType: 'image/jpeg', sizeBytes: 9004, createdAt: new Date(), capturedById: 'ag' }],
    transactions: [], _count: { transactions: 3 },
  };
  const prisma: J = {
    counterCustomer: {
      findFirst: jest.fn(async ({ where }: J) => (where.id === row.id && (where.clientId === undefined || where.clientId === row.clientId) ? row : null)),
      findMany: jest.fn(async () => [row]),
      count: jest.fn(async () => 1),
    },
    counterIdFile: { findUnique: jest.fn(async ({ where }: J) => (where.counterCustomerId_kind.kind === 'FRONT' ? { data: Buffer.from('img'), mimeType: 'image/jpeg', sha256: 'x' } : null)) },
    user: { findUnique: jest.fn(async () => ({ firstName: 'Gora', lastName: 'Ba' })) },
    auditLog: {
      create: jest.fn(async ({ data }: J) => { audits.push({ createdAt: new Date(), ...data }); return data; }),
      findMany: jest.fn(async ({ where }: J) => audits.filter((a) => a.userId === where.userId && a.entityId === where.entityId).map((a) => ({ details: a.details }))),
    },
  };
  return { service: new CounterAdminService(prisma as any), prisma, audits };
}

describe('CounterAdminService', () => {
  it('numéro de pièce masqué en liste (seuls les 4 derniers caractères)', () => {
    expect(maskIdNumber('AB123456')).toBe('••••3456');
    expect(maskIdNumber('123')).toBe('••••');
  });

  it('liste réservée aux administrateurs, limitée à leur société', async () => {
    const { service, prisma } = setup();
    const r = await service.list(admin, { search: ' diop ' });
    expect(r.items[0]).toMatchObject({ name: 'Awa Diop', idNumberMasked: '••••3456', hasPhoto: true, sends: 3, idExpired: false });
    expect(JSON.stringify(r)).not.toContain('AB123456');
    expect(prisma.counterCustomer.findMany.mock.calls[0][0].where).toMatchObject({ clientId: 7 });
    await expect(service.list(agent, {})).rejects.toBeInstanceOf(ForbiddenException);
    await service.list(superAdmin, { clientId: 9 });
    expect(prisma.counterCustomer.findMany.mock.calls[1][0].where).toMatchObject({ clientId: 9 });
  });

  it('fiche détaillée : numéro complet + consultation journalisée KYC_VIEW', async () => {
    const { service, audits } = setup();
    const d = await service.detail(admin, 'cc1');
    expect(d).toMatchObject({ idNumber: 'AB123456', birthDate: '1990-05-12', registeredBy: 'Gora Ba', files: [{ kind: 'front' }] });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: 'KYC_VIEW', userId: 'adm', clientId: 7, entity: 'CounterCustomer', entityId: 'cc1', details: { what: 'dossier' } });
  });

  it('administrateur d\'une autre société, agent : 404 / 403, rien n\'est journalisé', async () => {
    const { service, audits } = setup();
    await expect(service.detail(otherAdmin, 'cc1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getFile(otherAdmin, 'cc1', 'front')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.detail(agent, 'cc1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(audits).toHaveLength(0);
  });

  it('photo : octets renvoyés et consultation journalisée avec le côté ; verso absent → 404 sans journal', async () => {
    const { service, audits } = setup();
    const f = await service.getFile(admin, 'cc1', 'front');
    expect(f).toMatchObject({ mimeType: 'image/jpeg' });
    expect(f.buffer.toString()).toBe('img');
    expect(audits[0]).toMatchObject({ action: 'KYC_VIEW', details: { what: 'front' } });
    await expect(service.getFile(admin, 'cc1', 'back')).rejects.toBeInstanceOf(NotFoundException);
    expect(audits).toHaveLength(1);
  });
});
