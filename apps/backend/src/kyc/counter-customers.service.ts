// apps/backend/src/kyc/counter-customers.service.ts
// =========================================================
// COUNTER CUSTOMERS v1.0 — fiche du client de passage d'un envoi au comptoir.
//
//  • Une personne = une fiche par société (clé : numéro de pièce normalisé), quel que soit l'agent ou l'agence.
//  • Même numéro de pièce mais nom / date de naissance différents → refus (403 COUNTER_ID_MISMATCH) : faute de saisie ou fraude,
//    dans les deux cas l'agent doit revérifier la pièce.
//  • Même téléphone avec une AUTRE pièce → accepté mais signalé à la conformité (fractionnement / usurpation possible).
//  • Le cumul des plafonds porte sur TOUTES les fiches de la même personne (même pièce, ou même téléphone, ou mêmes
//    nom + date de naissance) : changer de téléphone ou de pièce ne remet pas le compteur à zéro.
// =========================================================
import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { KycDocumentType, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { KycFileError, NEEDS_BACK, decodeUpload, type DecodedFile } from './kyc-rules';
import { parseCounterSender, sameIdentity, type CounterSender, type CounterSenderInput } from './counter-rules';

/** Photos de la pièce, en base64, telles que reçues de l'agent. */
export interface CounterIdPhotosInput {
  senderIdFront?: string;
  senderIdBack?: string;
}

export interface ResolvedCounterCustomer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  /** Toutes les fiches de cette personne (la sienne comprise) : base du calcul des plafonds. */
  relatedIds: string[];
  /** Anomalies à transmettre à la conformité (jamais bloquantes). */
  notes: string[];
  firstSeenAt: Date;
}

@Injectable()
export class CounterCustomersService {
  private readonly logger = new Logger(CounterCustomersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Valide la saisie, crée ou met à jour la fiche. Lève 400 (saisie incomplète) ou 403 (pièce déjà connue sous une autre identité). */
  async resolve(clientId: number, agentId: string, input: CounterSenderInput & CounterIdPhotosInput, db: Prisma.TransactionClient | PrismaService = this.prisma): Promise<ResolvedCounterCustomer> {
    const { errors, sender } = parseCounterSender(input);
    if (!sender) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'COUNTER_ID_REQUIRED',
        message: `Pièce d'identité de l'expéditeur obligatoire pour un envoi au comptoir. ${errors.join(' ')}`,
        fields: errors,
      });
    }

    const existing = await db.counterCustomer.findUnique({ where: { clientId_idNumber: { clientId, idNumber: sender.idNumber } } });
    if (existing && !sameIdentity(existing, sender)) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'COUNTER_ID_MISMATCH',
        message:
          `Ce numéro de pièce est déjà enregistré au nom de ${existing.firstName} ${existing.lastName} ` +
          `(né(e) le ${existing.birthDate.toISOString().slice(0, 10)}). Vérifiez la pièce et les informations saisies.`,
      });
    }

    // ✅ lot 8 — la pièce est PHOTOGRAPHIÉE, pas seulement recopiée. Photos exigées au 1er envoi de cette personne, ou si la pièce
    // a été renouvelée (date d'expiration différente) ; sinon celles déjà enregistrées font foi.
    const stored = existing ? await db.counterIdFile.findMany({ where: { counterCustomerId: existing.id }, select: { kind: true } }) : [];
    const hasFront = stored.some((f) => f.kind === 'FRONT');
    const hasBack = stored.some((f) => f.kind === 'BACK');
    const renewed = !!existing && (existing.idExpiry?.getTime() !== sender.idExpiry.getTime() || existing.idType !== sender.idType);
    const needsBack = (NEEDS_BACK as readonly string[]).includes(sender.idType);
    const photos = this.decodePhotos(input);
    const missing: string[] = [];
    if (!photos.front && (!hasFront || renewed)) missing.push('Photo du recto de la pièce');
    if (needsBack && !photos.back && (!hasBack || renewed)) missing.push('Photo du verso de la pièce');
    if (missing.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'COUNTER_ID_PHOTO_REQUIRED',
        message: `Photographiez la pièce d'identité de l'expéditeur avant d'encaisser. ${missing.join(' ; ')} manquante${missing.length > 1 ? 's' : ''}.`,
        fields: missing,
      });
    }

    const notes: string[] = [];
    const samePhoneOtherId = await db.counterCustomer.findFirst({
      where: { clientId, phone: sender.phone, idNumber: { not: sender.idNumber } },
      select: { id: true },
    });
    if (samePhoneOtherId) notes.push("Même téléphone déjà utilisé avec une autre pièce d'identité");

    const data = {
      phone: sender.phone, firstName: sender.firstName, lastName: sender.lastName, birthDate: sender.birthDate,
      idType: sender.idType as KycDocumentType, idExpiry: sender.idExpiry, idCountry: sender.idCountry, updatedById: agentId,
    };
    const row = existing
      ? await db.counterCustomer.update({ where: { id: existing.id }, data })
      : await db.counterCustomer.create({ data: { clientId, idNumber: sender.idNumber, createdById: agentId, ...data } });

    await this.storePhotos(db, row.id, agentId, photos);
    if (photos.front || photos.back) {
      try {
        await db.auditLog.create({
          data: {
            userId: agentId, clientId, action: 'KYC_COUNTER_ID', entity: 'CounterCustomer', entityId: row.id,
            details: { front: !!photos.front, back: !!photos.back, renewed, idType: sender.idType }, successful: true,
          },
        });
      } catch (err) {
        this.logger.error(`Journal d'audit non écrit (photo pièce comptoir ${row.id}) : ${(err as Error).message}`);
      }
    }

    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      relatedIds: await this.relatedIds(db, clientId, row, sender),
      notes,
      firstSeenAt: row.createdAt,
    };
  }

  private decodePhotos(input: CounterIdPhotosInput): { front?: DecodedFile; back?: DecodedFile } {
    try {
      return {
        front: input.senderIdFront ? decodeUpload(input.senderIdFront, 'La photo du recto') : undefined,
        back: input.senderIdBack ? decodeUpload(input.senderIdBack, 'La photo du verso') : undefined,
      };
    } catch (err) {
      if (err instanceof KycFileError) {
        throw new BadRequestException({ statusCode: 400, error: 'Bad Request', code: 'COUNTER_ID_PHOTO_INVALID', message: err.message });
      }
      throw err;
    }
  }

  private async storePhotos(db: Prisma.TransactionClient | PrismaService, counterCustomerId: string, agentId: string, photos: { front?: DecodedFile; back?: DecodedFile }): Promise<void> {
    const entries: Array<['FRONT' | 'BACK', DecodedFile]> = [];
    if (photos.front) entries.push(['FRONT', photos.front]);
    if (photos.back) entries.push(['BACK', photos.back]);
    if (entries.length === 0) return;
    for (const [kind, f] of entries) {
      const data = { mimeType: f.mimeType, sizeBytes: f.sizeBytes, sha256: f.sha256, data: f.buffer, capturedById: agentId };
      await db.counterIdFile.upsert({
        where: { counterCustomerId_kind: { counterCustomerId, kind } },
        create: { counterCustomerId, kind, ...data },
        update: data,
      });
    }
    await db.counterCustomer.update({ where: { id: counterCustomerId }, data: { idPhotoAt: new Date() } });
  }

  /** Fiches de la même personne : même pièce, même téléphone, ou mêmes nom + date de naissance. */
  private async relatedIds(db: Prisma.TransactionClient | PrismaService, clientId: number, row: { id: string }, s: CounterSender): Promise<string[]> {
    const rows = await db.counterCustomer.findMany({
      where: {
        clientId,
        OR: [
          { phone: s.phone },
          { idNumber: s.idNumber },
          { lastName: { equals: s.lastName, mode: 'insensitive' }, firstName: { equals: s.firstName, mode: 'insensitive' }, birthDate: s.birthDate },
        ],
      },
      select: { id: true },
      take: 50,
    });
    return [...new Set([row.id, ...rows.map((r) => r.id)])];
  }
}
