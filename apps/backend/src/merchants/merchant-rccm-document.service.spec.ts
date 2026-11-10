// apps/backend/src/merchants/merchant-rccm-document.service.spec.ts
import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MerchantRccmDocumentService } from './merchant-rccm-document.service';

// Octets minimaux reconnus : un JPEG (FFD8FF) et un PDF (%PDF-) complétés pour dépasser la taille minimale.
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(9000, 7)]).toString('base64');
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(9000, 65)]).toString('base64');

function setup(over: { profile?: any; row?: any } = {}) {
  const store: { row: any } = { row: over.row ?? null };
  const prisma: any = {
    merchantProfile: { findUnique: jest.fn(async () => (over.profile === undefined ? { id: 'm1', clientId: 5 } : over.profile)) },
    merchantRccmDocument: {
      upsert: jest.fn(async ({ create }: any) => { store.row = { ...create }; return { updatedAt: new Date('2026-11-10T08:00:00Z') }; }),
      findFirst: jest.fn(async ({ where }: any) => (store.row && (!where.merchant?.clientId || where.merchant.clientId === 5) ? store.row : null)),
    },
    auditLog: { create: jest.fn(async () => ({})) },
  };
  const merchants: any = { scopeForAdmin: jest.fn((actor: any, c?: number) => (actor.role === 'SUPER_ADMIN' ? (c as number) : actor.clientId)) };
  return { service: new MerchantRccmDocumentService(prisma, merchants), prisma, store, merchants };
}

describe('MerchantRccmDocumentService', () => {
  it('enregistre une photo ou un PDF, avec empreinte et type réel, et journalise le dépôt', async () => {
    const a = setup();
    const r = await a.service.save('u1', JPEG);
    expect(r.mimeType).toBe('image/jpeg');
    expect(r.version).toMatch(/^[0-9a-f]{64}$/);
    expect(a.prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(a.prisma.auditLog.create.mock.calls[0][0].data.details)).not.toContain(JPEG.slice(0, 20));
    const b = setup();
    expect((await b.service.save('u1', `data:application/pdf;base64,${PDF}`)).mimeType).toBe('application/pdf');
  });

  it('refuse un fichier vide, illisible ou d\'un autre type (un texte renommé en .jpg)', async () => {
    const { service } = setup();
    await expect(service.save('u1', '')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.save('u1', '%%%')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.save('u1', Buffer.alloc(9000, 66).toString('base64'))).rejects.toThrow(/JPEG, PNG, WEBP ou un PDF/);
  });

  it('un compte sans commerce ne peut rien déposer', async () => {
    const { service, prisma } = setup({ profile: null });
    await expect(service.save('u1', JPEG)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.merchantRccmDocument.upsert).not.toHaveBeenCalled();
  });

  it('le remplacement écrase le document précédent (une seule pièce par commerce)', async () => {
    const { service, prisma } = setup();
    await service.save('u1', JPEG);
    await service.save('u1', PDF);
    expect(prisma.merchantRccmDocument.upsert.mock.calls.every((c: any[]) => c[0].where.merchantId === 'm1')).toBe(true);
  });

  it('l\'administrateur lit le document de SA société ; une autre société ou aucun document : 404', async () => {
    const { service, store } = setup();
    await service.save('u1', JPEG);
    const f = await service.readForAdmin({ id: 'adm', role: 'COMPANY_ADMIN', clientId: 5 } as any, 'u1');
    expect(f.mimeType).toBe('image/jpeg');
    expect(f.buffer.length).toBeGreaterThan(8000);
    await expect(service.readForAdmin({ id: 'adm2', role: 'COMPANY_ADMIN', clientId: 9 } as any, 'u1')).rejects.toBeInstanceOf(NotFoundException);
    store.row = null;
    await expect(service.readMine('u1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
