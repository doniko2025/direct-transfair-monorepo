// apps/backend/src/account-deletion/account-deletion.service.ts
// =========================================================
// SUPPRESSION DE SON PROPRE COMPTE v1.0 — « Supprimer mon compte » (application mobile).
// La personne confirme par SON NUMÉRO DE TÉLÉPHONE (celui du compte) ET son CODE SECRET à 6 chiffres :
//   1. téléphone : doit correspondre au numéro du compte (comparaison après normalisation) ;
//   2. code secret : mêmes compteurs que la connexion (5 erreurs → verrouillage 30 min), via PinVerifierService ;
//   3. refusée (409) tant qu'il reste de l'argent (portefeuille personnel ou du commerce) ou un retrait marchand en attente ;
//   4. suppression « douce » (UsersService.softDelete : e-mail libéré, téléphone vidé, données gardées pour l'audit) ;
//   5. toutes les sessions sont fermées, le commerce éventuel est suspendu, la photo de profil est effacée.
// Réservée aux clients (rôle USER) : agents et administrateurs passent par leur administrateur.
// =========================================================

import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditAction, Role } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { PinVerifierService } from '../merchants/pin-verifier.service';
import { isSamePhone, normalizePhoneE164 } from '../common/utils/phone.util';

export const PHONE_MISMATCH_CODE = 'PHONE_MISMATCH';

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly pins: PinVerifierService,
  ) {}

  async deleteMyAccount(userId: string, input: { phone: unknown; pin: unknown }): Promise<{ deleted: true; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, phone: true, deletedAt: true, clientId: true },
    });
    if (!user || user.deletedAt) throw new NotFoundException('Compte introuvable.');
    if (user.role !== Role.USER) {
      throw new ForbiddenException('La suppression de ce type de compte se fait par votre administrateur.');
    }
    if (!user.phone) {
      throw new BadRequestException("Aucun numéro de téléphone n'est enregistré sur ce compte. Contactez l'assistance pour le supprimer.");
    }

    // 1. Numéro de téléphone du compte (aucun essai de code secret n'est consommé si le numéro est faux).
    const typed = typeof input.phone === 'string' ? input.phone : '';
    if (!normalizePhoneE164(typed) || !isSamePhone(typed, user.phone)) {
      throw new ForbiddenException({
        statusCode: 403,
        code: PHONE_MISMATCH_CODE,
        message: 'Ce numéro ne correspond pas à celui de votre compte.',
      });
    }

    // 2. Code secret.
    await this.pins.assertPin(userId, input.pin);

    // 3. Retrait marchand encore en cours : il faut attendre son issue (le montant est déjà débité du portefeuille).
    const pendingPayouts = await this.prisma.merchantPayout.count({ where: { userId, status: 'PENDING' } });
    if (pendingPayouts > 0) {
      throw new ConflictException({
        statusCode: 409,
        code: 'PENDING_OPERATIONS',
        message: 'Un retrait de votre commerce est en cours de traitement. Attendez son issue avant de supprimer le compte.',
      });
    }

    // 4. Suppression douce (409 BALANCE_NOT_EMPTY s'il reste de l'argent).
    await this.users.softDelete(userId);

    // 5. Nettoyage : sessions fermées, commerce suspendu, photo effacée, trace d'audit. Un échec ici n'annule pas la suppression.
    await this.prisma.userSession.updateMany({ where: { userId, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: new Date() } })
      .catch((e) => this.logger.warn(`Sessions non fermées (${userId}) : ${(e as Error).message}`));
    await this.prisma.merchantProfile.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'SUSPENDED', suspendedReason: 'Compte supprimé par son titulaire', suspendedAt: new Date() },
    }).catch((e) => this.logger.warn(`Commerce non suspendu (${userId}) : ${(e as Error).message}`));
    await this.prisma.userPhoto.deleteMany({ where: { userId } })
      .catch((e) => this.logger.warn(`Photo non effacée (${userId}) : ${(e as Error).message}`));
    await this.prisma.auditLog.create({
      data: { userId, clientId: user.clientId ?? null, action: AuditAction.USER_DELETE, details: { self: true } as any, successful: true },
    }).catch((e) => this.logger.warn(`Audit non enregistré (${userId}) : ${(e as Error).message}`));

    return { deleted: true, message: 'Votre compte a été supprimé.' };
  }
}
