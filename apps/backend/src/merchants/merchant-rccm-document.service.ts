// apps/backend/src/merchants/merchant-rccm-document.service.ts
// =========================================================
// PIÈCE JUSTIFICATIVE DU RCCM — en plus du numéro, le marchand envoie le document (photo ou PDF) ; l'administrateur le consulte.
//   PUT /merchants/me/rccm-document { file }   envoi / remplacement (propriétaire du commerce)
//   GET /merchants/me/rccm-document            octets de MON document ; 404 si aucun
//   GET /merchants-admin/:userId/rccm-document octets du document (administrateur de la société du commerce)
// Règles : JPEG, PNG, WebP ou PDF (type RÉEL lu dans les premiers octets), 6 Mo au plus. Stocké à part (table merchant_rccm_documents).
// Le marchand peut REMPLACER le document (pièce périmée, mauvaise photo) mais pas le supprimer : la trace reste pour l'administrateur.
// Chaque dépôt est inscrit au journal d'audit (empreinte du fichier, pas son contenu).
// =========================================================

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { decodeUpload, KycFileError } from '../kyc/kyc-rules';
import { PrismaService } from '../prisma/prisma.service';
import { MerchantsService } from './merchants.service';

export interface RccmDocFile {
  buffer: Buffer;
  mimeType: string;
  sha256: string;
  sizeBytes: number;
}

@Injectable()
export class MerchantRccmDocumentService {
  private readonly logger = new Logger(MerchantRccmDocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly merchants: MerchantsService,
  ) {}

  /** Le propriétaire dépose ou remplace son document (même si son compte est suspendu : il doit pouvoir régulariser). */
  async save(userId: string, file: unknown): Promise<{ mimeType: string; sizeBytes: number; version: string; uploadedAt: string }> {
    const profile = await this.prisma.merchantProfile.findUnique({ where: { userId }, select: { id: true, clientId: true } });
    if (!profile) throw new NotFoundException("Ce compte n'est pas un compte marchand.");
    let f;
    try {
      f = decodeUpload(file, 'Le document RCCM');
    } catch (err) {
      if (err instanceof KycFileError) throw new BadRequestException(err.message);
      throw err;
    }
    const row = await this.prisma.merchantRccmDocument.upsert({
      where: { merchantId: profile.id },
      create: { merchantId: profile.id, mimeType: f.mimeType, sizeBytes: f.sizeBytes, sha256: f.sha256, data: f.buffer },
      update: { mimeType: f.mimeType, sizeBytes: f.sizeBytes, sha256: f.sha256, data: f.buffer },
      select: { updatedAt: true },
    });
    try {
      await this.prisma.auditLog.create({
        data: {
          userId, clientId: profile.clientId, action: 'MERCHANT_UPDATE' as never, entity: 'MerchantProfile', entityId: profile.id,
          details: { rccmDocument: { sha256: f.sha256, mimeType: f.mimeType, sizeBytes: f.sizeBytes } } as Prisma.InputJsonValue, successful: true,
        },
      });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (document RCCM, ${profile.id}) : ${(err as Error).message}`);
    }
    return { mimeType: f.mimeType, sizeBytes: f.sizeBytes, version: f.sha256, uploadedAt: row.updatedAt.toISOString() };
  }

  /** Document du propriétaire. */
  async readMine(userId: string): Promise<RccmDocFile> {
    const row = await this.prisma.merchantRccmDocument.findFirst({ where: { merchant: { userId } }, select: { data: true, mimeType: true, sha256: true, sizeBytes: true } });
    return this.toFile(row);
  }

  /** Document vu par l'administrateur : uniquement pour un commerce de SA société (le super-administrateur précise la société). */
  async readForAdmin(actor: AuthUserPayload, merchantUserId: string, clientIdParam?: number): Promise<RccmDocFile> {
    const clientId = this.merchants.scopeForAdmin(actor, clientIdParam);
    const row = await this.prisma.merchantRccmDocument.findFirst({
      where: { merchant: { userId: merchantUserId, clientId } },
      select: { data: true, mimeType: true, sha256: true, sizeBytes: true },
    });
    return this.toFile(row);
  }

  private toFile(row: { data: Uint8Array | Buffer; mimeType: string; sha256: string; sizeBytes: number } | null): RccmDocFile {
    if (!row) throw new NotFoundException('Aucun document RCCM.');
    return { buffer: Buffer.from(row.data), mimeType: row.mimeType, sha256: row.sha256, sizeBytes: row.sizeBytes };
  }
}
