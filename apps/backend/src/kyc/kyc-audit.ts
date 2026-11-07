// apps/backend/src/kyc/kyc-audit.ts
// =========================================================
// JOURNAL D'AUDIT DES CONSULTATIONS (lot 8) — qui a regardé quelle pièce d'identité, et quand.
//
// Une pièce d'identité est une donnée très sensible : chaque consultation par un administrateur (dossier d'un client, photo recto/verso,
// pièce d'un client de passage) laisse une trace KYC_VIEW avec l'auteur, la société, l'objet consulté et le côté (recto/verso).
// Le propriétaire qui regarde sa propre pièce n'est pas journalisé.
//
// Pour ne pas noyer le journal, une même personne qui rouvre le même objet dans les 10 minutes n'ajoute pas de ligne (le recto puis le
// verso d'une même pièce sont deux lignes : le côté fait partie de l'objet consulté). Le journal ne doit jamais bloquer la consultation :
// une panne d'écriture est tracée dans les logs du serveur, la lecture se poursuit.
// =========================================================

import { Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { PrismaService } from '../prisma/prisma.service';

const logger = new Logger('KycAudit');

/** Fenêtre pendant laquelle une même consultation n'est journalisée qu'une fois. */
export const VIEW_DEDUPE_MS = 10 * 60 * 1000;

export interface ViewRecord {
  actorId: string;
  clientId: number | null;
  /** KycDocument | KycDossier | CounterCustomer */
  entity: string;
  entityId: string;
  /** front | back | dossier */
  what: string;
  /** Client ou client de passage concerné (pour retrouver les consultations d'une personne). */
  subjectId?: string | null;
}

export async function recordView(prisma: Pick<PrismaService, 'auditLog'>, rec: ViewRecord, now: Date = new Date()): Promise<boolean> {
  try {
    const recent = await prisma.auditLog.findMany({
      where: {
        userId: rec.actorId,
        action: 'KYC_VIEW',
        entity: rec.entity,
        entityId: rec.entityId,
        createdAt: { gte: new Date(now.getTime() - VIEW_DEDUPE_MS) },
      },
      select: { details: true },
      take: 10,
    });
    if (recent.some((r) => (r.details as { what?: string } | null)?.what === rec.what)) return false;
    await prisma.auditLog.create({
      data: {
        userId: rec.actorId,
        clientId: rec.clientId,
        action: 'KYC_VIEW',
        entity: rec.entity,
        entityId: rec.entityId,
        details: { what: rec.what, ...(rec.subjectId ? { subjectId: rec.subjectId } : {}) } as Prisma.InputJsonValue,
        successful: true,
      },
    });
    return true;
  } catch (err) {
    logger.error(`Consultation non journalisée (${rec.entity} ${rec.entityId}) : ${(err as Error).message}`);
    return false;
  }
}
