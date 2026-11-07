// apps/backend/src/kyc/counter-admin.service.ts
// =========================================================
// CLIENTS DE PASSAGE — consultation par les administrateurs (lot 8).
//
//  • Liste (recherche nom / téléphone / n° de pièce), fiche détaillée, contenu des photos recto / verso.
//  • Réservé aux COMPANY_ADMIN (leur société), SUPER_ADMIN et au service client délégué (KYC_COUNTER). Une fiche d'une autre société répond 404.
//  • La liste masque le numéro de pièce ; la fiche l'affiche en entier et CHAQUE consultation (fiche, recto, verso) est journalisée
//    (KYC_VIEW) avec le nom de l'administrateur et l'heure.
// =========================================================
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import { recordView } from './kyc-audit';
import { hasPermission, SUPPORT_NOT_DELEGATED } from '../support/support-permissions';
import { DOC_LABEL, isExpired, type KycDocType } from './kyc-rules';

export const maskIdNumber = (n: string): string => (n.length <= 4 ? '••••' : `${'•'.repeat(Math.min(n.length - 4, 8))}${n.slice(-4)}`);

type FileKind = 'front' | 'back';

@Injectable()
export class CounterAdminService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(admin: AuthUserPayload, clientId?: number): { clientId?: number } {
    if (admin.role === 'SUPER_ADMIN') return clientId ? { clientId } : {};
    if (admin.role === 'SUPPORT') {
      if (!hasPermission(admin, 'KYC_COUNTER')) throw new ForbiddenException(SUPPORT_NOT_DELEGATED); // lot 9
    } else if (admin.role !== 'COMPANY_ADMIN') throw new ForbiddenException('Réservé aux administrateurs.');
    if (!admin.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    return { clientId: admin.clientId };
  }

  async list(admin: AuthUserPayload, q: { search?: string; page?: number; limit?: number; clientId?: number }) {
    const scope = this.scope(admin, q.clientId);
    const page = Math.max(1, Math.floor(q.page ?? 1));
    const limit = Math.min(50, Math.max(1, Math.floor(q.limit ?? 20)));
    const search = q.search?.trim();
    const where: Prisma.CounterCustomerWhereInput = {
      ...scope,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search.replace(/[^\d+]/g, '') || search } },
              { idNumber: { contains: search.replace(/\s+/g, '').toUpperCase() } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.counterCustomer.count({ where }),
      this.prisma.counterCustomer.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, clientId: true, firstName: true, lastName: true, phone: true, idType: true, idNumber: true, idExpiry: true, idPhotoAt: true, createdAt: true,
          files: { select: { kind: true } },
          _count: { select: { transactions: true } },
        },
      }),
    ]);
    const now = new Date();
    return {
      page, limit, total,
      items: rows.map((r) => ({
        id: r.id,
        clientId: r.clientId,
        name: `${r.firstName} ${r.lastName}`.trim(),
        phone: r.phone,
        idType: r.idType,
        idTypeLabel: DOC_LABEL[r.idType as KycDocType] ?? r.idType,
        idNumberMasked: maskIdNumber(r.idNumber),
        idExpiry: r.idExpiry.toISOString().slice(0, 10),
        idExpired: isExpired(r.idExpiry, now),
        hasPhoto: r.files.length > 0,
        photoAt: r.idPhotoAt,
        sends: r._count.transactions,
        createdAt: r.createdAt,
      })),
    };
  }

  async detail(admin: AuthUserPayload, id: string) {
    const scope = this.scope(admin);
    const r = await this.prisma.counterCustomer.findFirst({
      where: { id, ...scope },
      select: {
        id: true, clientId: true, firstName: true, lastName: true, phone: true, birthDate: true, idType: true, idNumber: true, idCountry: true, idExpiry: true,
        idPhotoAt: true, createdAt: true, createdById: true,
        files: { select: { kind: true, mimeType: true, sizeBytes: true, createdAt: true, capturedById: true } },
        transactions: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, amount: true, currency: true, status: true, createdAt: true } },
        _count: { select: { transactions: true } },
      },
    });
    if (!r) throw new NotFoundException('Client de passage introuvable.');
    await recordView(this.prisma, { actorId: admin.id, clientId: r.clientId, entity: 'CounterCustomer', entityId: r.id, what: 'dossier', subjectId: r.id });
    const agent = await this.prisma.user.findUnique({ where: { id: r.createdById }, select: { firstName: true, lastName: true } });
    return {
      id: r.id,
      name: `${r.firstName} ${r.lastName}`.trim(),
      firstName: r.firstName,
      lastName: r.lastName,
      phone: r.phone,
      birthDate: r.birthDate.toISOString().slice(0, 10),
      idType: r.idType,
      idTypeLabel: DOC_LABEL[r.idType as KycDocType] ?? r.idType,
      idNumber: r.idNumber,
      idCountry: r.idCountry,
      idExpiry: r.idExpiry.toISOString().slice(0, 10),
      idExpired: isExpired(r.idExpiry, new Date()),
      photoAt: r.idPhotoAt,
      files: r.files.map((f) => ({ kind: f.kind === 'BACK' ? 'back' : 'front', mimeType: f.mimeType, sizeBytes: f.sizeBytes, at: f.createdAt })),
      registeredBy: agent ? `${agent.firstName ?? ''} ${agent.lastName ?? ''}`.trim() || null : null,
      createdAt: r.createdAt,
      sends: r._count.transactions,
      recent: r.transactions.map((t) => ({ id: t.id, amount: Number(t.amount), currency: t.currency, status: t.status, createdAt: t.createdAt })),
    };
  }

  async getFile(admin: AuthUserPayload, id: string, kind: FileKind) {
    const scope = this.scope(admin);
    const c = await this.prisma.counterCustomer.findFirst({ where: { id, ...scope }, select: { id: true, clientId: true } });
    if (!c) throw new NotFoundException('Client de passage introuvable.');
    const file = await this.prisma.counterIdFile.findUnique({
      where: { counterCustomerId_kind: { counterCustomerId: id, kind: kind === 'back' ? 'BACK' : 'FRONT' } },
      select: { data: true, mimeType: true, sha256: true },
    });
    if (!file) throw new NotFoundException('Photo introuvable.');
    await recordView(this.prisma, { actorId: admin.id, clientId: c.clientId, entity: 'CounterCustomer', entityId: c.id, what: kind, subjectId: c.id });
    return { buffer: Buffer.from(file.data), mimeType: file.mimeType, sha256: file.sha256, name: `piece-passage-${kind}` };
  }
}
