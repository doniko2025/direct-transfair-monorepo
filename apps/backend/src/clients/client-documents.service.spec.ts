// apps/backend/src/clients/client-documents.service.spec.ts
// Documents légaux d'une société : types contrôlés, fichier réel vérifié, audit, lecture / suppression bornées à la société.
import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClientDocumentsService } from './client-documents.service';
import { normalizeRccm } from './client-documents.rules';

/** PDF factice assez long pour passer le contrôle de taille minimale (8 Ko) et reconnu par ses premiers octets. */
const pdfB64 = (n = 9000) => 'data:application/pdf;base64,' + Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(n, 0x20)]).toString('base64');

function make(over: { client?: any; count?: number; doc?: any } = {}) {
  const prisma: any = {
    client: { findFirst: jest.fn().mockResolvedValue(over.client === undefined ? { id: 5 } : over.client) },
    clientDocument: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(over.count ?? 0),
      create: jest.fn(async () => ({ id: 'd1', createdAt: new Date('2026-11-15') })),
      findFirst: jest.fn().mockResolvedValue(over.doc === undefined ? null : over.doc),
      delete: jest.fn().mockResolvedValue({}),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return { service: new ClientDocumentsService(prisma), prisma };
}

describe('ClientDocumentsService', () => {
  it('ajoute un document RCCM : octets + empreinte stockés, audit sans le contenu', async () => {
    const { service, prisma } = make();
    const r = await service.add('sa1', 5, { kind: 'RCCM', file: pdfB64() });
    expect(r).toMatchObject({ id: 'd1', kind: 'RCCM', mimeType: 'application/pdf' });
    const data = prisma.clientDocument.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ clientId: 5, kind: 'RCCM', uploadedById: 'sa1' });
    expect(Buffer.isBuffer(data.data)).toBe(true);
    expect(data.sha256).toMatch(/^[0-9a-f]{64}$/);
    const audit = prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ clientId: 5, action: 'CLIENT_UPDATE', entity: 'ClientDocument' });
    expect(JSON.stringify(audit.details)).not.toContain('JVBER');
  });

  it('refuse un type inconnu, un fichier qui n\'est pas une image/PDF, « Autre » sans nom, une société absente', async () => {
    const { service } = make();
    await expect(service.add('sa1', 5, { kind: 'NOPE', file: pdfB64() })).rejects.toBeInstanceOf(BadRequestException);
    const bad = 'data:application/pdf;base64,' + Buffer.alloc(9000, 0x41).toString('base64');
    await expect(service.add('sa1', 5, { kind: 'RCCM', file: bad })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.add('sa1', 5, { kind: 'OTHER', file: pdfB64() })).rejects.toBeInstanceOf(BadRequestException);
    await expect(make({ client: null }).service.add('sa1', 5, { kind: 'RCCM', file: pdfB64() })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('plafonne le nombre de documents par société', async () => {
    const { service } = make({ count: 20 });
    await expect(service.add('sa1', 5, { kind: 'IDENTITY', file: pdfB64() })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lecture et suppression : bornées à la société (document d\'une autre société → 404)', async () => {
    const a = make({ doc: null });
    await expect(a.service.read(5, 'dX')).rejects.toBeInstanceOf(NotFoundException);
    await expect(a.service.remove('sa1', 5, 'dX')).rejects.toBeInstanceOf(NotFoundException);
    expect(a.prisma.clientDocument.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'dX', clientId: 5 } }));
    const b = make({ doc: { id: 'd1', kind: 'RCCM', sha256: 'h', data: Buffer.from('%PDF-1.4'), mimeType: 'application/pdf', label: null } });
    const f = await b.service.read(5, 'd1');
    expect(f.fileName).toBe('extrait-rccm-registre-du-commerce.pdf');
    await b.service.remove('sa1', 5, 'd1');
    expect(b.prisma.clientDocument.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
  });
});

describe('normalizeRccm', () => {
  it('formats usuels acceptés, espaces réduits, vide → null', () => {
    expect(normalizeRccm('GN.TCC.2021.A.12345')).toBe('GN.TCC.2021.A.12345');
    expect(normalizeRccm('SN  DKR 2020 B 1234')).toBe('SN DKR 2020 B 1234');
    expect(normalizeRccm('CI-ABJ-2019-B-12345')).toBe('CI-ABJ-2019-B-12345');
    expect(normalizeRccm('   ')).toBeNull();
    expect(normalizeRccm(undefined)).toBeNull();
  });
  it('trop court ou caractères étranges → erreur claire', () => {
    expect(() => normalizeRccm('A1')).toThrow(/RCCM/);
    expect(() => normalizeRccm('<script>alert(1)</script>')).toThrow(/RCCM/);
  });
});
