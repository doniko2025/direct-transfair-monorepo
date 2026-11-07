// apps/backend/src/common/test-pin.ts
// =========================================================
// CODE SECRET DE TEST (lot 13) — « 000000 » accepté pour tous les comptes portefeuille / marchand.
//
// ⚠️ OUTIL DE TEST UNIQUEMENT. Désactivé par défaut : il faut poser TEST_PIN_ENABLED=true dans l'environnement du serveur.
//    Pour le retirer : supprimer la variable (ou la mettre à autre chose que « true ») puis redémarrer. Rien d'autre à défaire.
//
// Garde-fous :
//  • limité aux comptes clients du portefeuille et marchands (Role.USER) — jamais SUPER_ADMIN, COMPANY_ADMIN, AGENT, service client ;
//  • ne remplace pas le vrai code : le code réel de chaque client continue de fonctionner ;
//  • l'inscription et le changement de code refusent toujours 000000 (pin-policy) : il ne peut pas devenir un vrai code ;
//  • un avertissement est écrit dans les journaux au démarrage et à chaque utilisation.
// =========================================================

import { Logger } from '@nestjs/common';
import { Role } from '@prisma/client';

export const TEST_PIN = '000000';

const logger = new Logger('TestPin');
let warnedAtBoot = false;

export function isTestPinEnabled(): boolean {
  const on = process.env.TEST_PIN_ENABLED === 'true';
  if (on && !warnedAtBoot) {
    warnedAtBoot = true;
    logger.warn(
      `⚠️ TEST_PIN_ENABLED=true : le code ${TEST_PIN} est accepté pour TOUS les comptes clients et marchands. À retirer avant la mise en production.`,
    );
  }
  return on;
}

/** Vrai si le code saisi est le code de test ET que le compte est un client / marchand du portefeuille. */
export function matchesTestPin(user: { id?: string; role?: Role | string | null } | null | undefined, secret: unknown): boolean {
  if (!user || typeof secret !== 'string' || secret !== TEST_PIN) return false;
  if (!isTestPinEnabled()) return false;
  if (user.role !== Role.USER) return false;
  logger.warn(`Code de test utilisé pour le compte ${user.id ?? '?'}`);
  return true;
}
