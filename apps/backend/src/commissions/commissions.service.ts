//apps/backend/src/commissions/commissions.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCommissionDto } from './dto/update-commission.dto';
import { CommissionSourceType, CommissionDestType } from '@prisma/client';

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère toutes les règles configurées pour une société
   */
  async getClientRules(clientId: number) {
    return this.prisma.commissionConfig.findMany({
      where: { clientId },
      orderBy: [{ sourceType: 'asc' }, { destType: 'asc' }],
    });
  }

  /**
   * Crée ou met à jour une règle de commission
   */
  async upsertRule(clientId: number, dto: UpdateCommissionDto) {
    // 1. Vérification logique : Wallet ne touche rien
    if (dto.sourceType === CommissionSourceType.WALLET && dto.senderShare > 0) {
      throw new BadRequestException("Le Client Wallet ne peut pas percevoir de commission.");
    }

    // 2. Calcul du reste pour la plateforme
    const platformShare = 100 - (dto.senderShare + dto.payerShare);

    if (platformShare < 0) {
      throw new BadRequestException("Le total des parts (Envoyeur + Payeur) ne peut pas dépasser 100%.");
    }

    // 3. Sauvegarde (Upsert = Update si existe, Create sinon)
    return this.prisma.commissionConfig.upsert({
      where: {
        clientId_sourceType_destType: {
          clientId,
          sourceType: dto.sourceType,
          destType: dto.destType,
        },
      },
      update: {
        senderShare: dto.senderShare,
        payerShare: dto.payerShare,
        platformShare: platformShare, // Calcul automatique
      },
      create: {
        clientId,
        sourceType: dto.sourceType,
        destType: dto.destType,
        senderShare: dto.senderShare,
        payerShare: dto.payerShare,
        platformShare: platformShare,
      },
    });
  }

  /**
   * Initialise les règles par défaut si elles n'existent pas
   * (Optionnel, utile pour les nouveaux clients)
   */
  async initDefaultRules(clientId: number) {
    const defaults = [
        { s: CommissionSourceType.SUBSIDIARY, d: CommissionDestType.SUBSIDIARY, sender: 0, payer: 0 }, // Tout à la société
        { s: CommissionSourceType.SUBSIDIARY, d: CommissionDestType.PARTNER, sender: 0, payer: 30 },   // 30% au partenaire payeur
        { s: CommissionSourceType.PARTNER, d: CommissionDestType.SUBSIDIARY, sender: 30, payer: 0 },   // 30% au partenaire envoyeur
        { s: CommissionSourceType.WALLET, d: CommissionDestType.PARTNER, sender: 0, payer: 30 },       // 30% au partenaire payeur
    ];

    for (const rule of defaults) {
        await this.upsertRule(clientId, {
            sourceType: rule.s,
            destType: rule.d,
            senderShare: rule.sender,
            payerShare: rule.payer
        });
    }
  }
}