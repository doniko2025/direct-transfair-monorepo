// apps/backend/src/clients/client-documents.service.ts
// =========================================================
// DOCUMENTS LÉGAUX D'UNE SOCIÉTÉ — RCCM, pièce d'identité du représentant, statuts, agrément…
//   GET    /clients/:id/documents              liste (sans les octets)
//   POST   /clients/:id/documents              { kind, label?, file } — ajout (JPEG, PNG, WebP ou PDF, 6 Mo au plus)
//   GET    /clients/:id/documents/:docId/file  octets du document
//   DELETE /clients/:id/documents/:docId
// Réservé au SUPER_ADMIN. Le type réel du fichier est lu dans ses premiers octets. Chaque ajout / suppression est inscrit au journal
// d'audit (empreinte du fichier, jamais son contenu).
// =========================================================

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { decodeUpload, KycFileError } from '../kyc/kyc-rules';
import { PrismaService } from '../prisma/prisma.service';
import { CLIENT_DOC_KINDS, CLIENT_DOC_LABEL, isClientDocKind, MAX_CLIENT_DOCS, type ClientDocKind } from './client-documents.rules';

export interface ClientDocumentView {
  id: string;
  kind: ClientDocKind;
  kindLabel: string;
  label: string | null;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ClientDocumentFile {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

@Injectable()
export class ClientDocumentsService {
  private readonly logger = new Logger(ClientDocumentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async assertClient(clientId: number): Promise<void> {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, deletedAt: null }, select: { id: true } });
    if (!client) throw new NotFoundException('Société introuvable.');
  }

  private async audit(actorId: string | null, clientId: number, entityId: string, details: Record<string, unknown>): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: actorId, clientId, action: 'CLIENT_UPDATE', entity: 'ClientDocument', entityId,
          details: details as Prisma.InputJsonValue, successful: true,
        },
      });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (document société ${clientId}) : ${(err as Error).message}`);
    }
  }

  async list(clientId: number): Promise<{ documents: ClientDocumentView[] }> {
    await this.assertClient(clientId);
    const rows = await this.prisma.clientDocument.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, kind: true, label: true, mimeType: true, sizeBytes: true, createdAt: true },
    });
    return {
      documents: rows.map((r) => {
        const kind = (isClientDocKind(r.kind) ? r.kind : 'OTHER') as ClientDocKind;
        return { id: r.id, kind, kindLabel: CLIENT_DOC_LABEL[kind], label: r.label, mimeType: r.mimeType, sizeBytes: r.sizeBytes, createdAt: r.createdAt.toISOString() };
      }),
    };
  }

  async add(actorId: string | null, clientId: number, input: { kind?: unknown; label?: unknown; file?: unknown }): Promise<ClientDocumentView> {
    await this.assertClient(clientId);
    if (!isClientDocKind(input.kind)) {
      throw new BadRequestException(`Type de document invalide. Types acceptés : ${CLIENT_DOC_KINDS.join(', ')}.`);
    }
    const kind = input.kind;
    const label = typeof input.label === 'string' && input.label.trim() ? input.label.trim().slice(0, 120) : null;
    if (kind === 'OTHER' && !label) throw new BadRequestException('Précisez le nom du document (type « Autre document »).');

    const count = await this.prisma.clientDocument.count({ where: { clientId } });
    if (count >= MAX_CLIENT_DOCS) throw new BadRequestException(`Une société ne peut pas avoir plus de ${MAX_CLIENT_DOCS} documents.`);

    let f;
    try {
      f = decodeUpload(input.file, CLIENT_DOC_LABEL[kind]);
    } catch (err) {
      if (err instanceof KycFileError) throw new BadRequestException(err.message);
      throw err;
    }
    const row = await this.prisma.clientDocument.create({
      data: { clientId, kind, label, mimeType: f.mimeType, sizeBytes: f.sizeBytes, sha256: f.sha256, data: f.buffer, uploadedById: actorId },
      select: { id: true, createdAt: true },
    });
    await this.audit(actorId, clientId, row.id, { event: 'DOCUMENT_ADDED', kind, sha256: f.sha256, mimeType: f.mimeType, sizeBytes: f.sizeBytes });
    return { id: row.id, kind, kindLabel: CLIENT_DOC_LABEL[kind], label, mimeType: f.mimeType, sizeBytes: f.sizeBytes, createdAt: row.createdAt.toISOString() };
  }

  async read(clientId: number, docId: string): Promise<ClientDocumentFile> {
    const row = await this.prisma.clientDocument.findFirst({
      where: { id: docId, clientId },
      select: { data: true, mimeType: true, kind: true, label: true },
    });
    if (!row) throw new NotFoundException('Document introuvable.');
    const kind = (isClientDocKind(row.kind) ? row.kind : 'OTHER') as ClientDocKind;
    const base = (row.label || CLIENT_DOC_LABEL[kind]).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'document';
    return { buffer: Buffer.from(row.data), mimeType: row.mimeType, fileName: `${base}.${EXT[row.mimeType] ?? 'bin'}` };
  }

  async remove(actorId: string | null, clientId: number, docId: string): Promise<{ id: string }> {
    const row = await this.prisma.clientDocument.findFirst({ where: { id: docId, clientId }, select: { id: true, kind: true, sha256: true } });
    if (!row) throw new NotFoundException('Document introuvable.');
    await this.prisma.clientDocument.delete({ where: { id: row.id } });
    await this.audit(actorId, clientId, row.id, { event: 'DOCUMENT_REMOVED', kind: row.kind, sha256: row.sha256 });
    return { id: row.id };
  }
}
