// apps/backend/src/kyc/kyc-guard.service.ts
// =========================================================
// KYC GUARD v1.0 — « pas d'identité vérifiée, pas d'opération sortante ».
//
// Un client wallet (rôle USER) dont le niveau KYC est LEVEL_0 ne peut pas envoyer d'argent, programmer un virement ni
// retirer. Il peut recevoir, se faire déposer du cash (dans la limite des plafonds du niveau 0) et recharger son wallet.
// Le niveau passe à LEVEL_1 quand un administrateur valide sa pièce d'identité ET son selfie (kyc.service.ts).
//
// ✅ lot 8 — le contrôle est fait EN DIRECT sur la date d'expiration de la pièce : un client vérifié dont la pièce d'identité a expiré
// (et qu'aucune autre pièce valable ne remplace) est bloqué comme un client non vérifié, avec le statut EXPIRED.
//
// Erreur renvoyée : 403 { code: 'KYC_REQUIRED', kycStatus, kycLevel, message } — l'application mobile ouvre alors l'écran de
// vérification. KYC_ENFORCEMENT=off désactive le blocage (recette / déploiement progressif).
// =========================================================

import { ForbiddenException, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { enforcementEnabled, identityLapsed, mustBeVerified, overallStatus, type KycStatusName } from './kyc-rules';

export const KYC_REQUIRED_CODE = 'KYC_REQUIRED';

export function kycRequiredMessage(status: KycStatusName): string {
  switch (status) {
    case 'PENDING':
      return "Votre pièce d'identité est en cours de vérification : l'opération sera possible dès sa validation. Vous serez prévenu.";
    case 'REJECTED':
      return "Votre dernière pièce d'identité a été refusée. Envoyez-en une nouvelle depuis Profil › Vérification d'identité pour pouvoir effectuer cette opération.";
    case 'EXPIRED':
      return "Votre pièce d'identité est expirée. Envoyez-en une nouvelle depuis Profil › Vérification d'identité pour pouvoir effectuer cette opération.";
    default:
      return "Vérifiez votre identité pour envoyer de l'argent : envoyez votre pièce d'identité et un selfie depuis Profil › Vérification d'identité. Un administrateur les validera.";
  }
}

@Injectable()
export class KycGuardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Refuse l'opération (403 KYC_REQUIRED) si ce client n'a pas d'identité vérifiée.
   * Sans effet pour les agents, administrateurs et pour les comptes déjà vérifiés.
   */
  async assertVerified(user: { id: string; role: string; kycLevel: string }): Promise<void> {
    if (!enforcementEnabled()) return;
    if (user.role !== 'USER') return;

    const now = new Date();
    const docs = await this.prisma.kycDocument.findMany({
      where: { userId: user.id },
      select: { type: true, status: true, expiryDate: true },
    });
    // lot 8 — vérifié ne suffit pas : une pièce d'identité arrivée à expiration bloque dès le jour même, sans attendre la tâche
    // de nuit qui ramène le niveau à 0 (et même si cette tâche était en panne).
    if (!mustBeVerified(user) && !identityLapsed(docs, now)) return;

    const status = overallStatus(user.kycLevel, docs, now);
    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      code: KYC_REQUIRED_CODE,
      message: kycRequiredMessage(status),
      kycStatus: status,
      kycLevel: user.kycLevel,
    });
  }
}
