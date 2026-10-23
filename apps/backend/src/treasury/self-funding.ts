// apps/backend/src/treasury/self-funding.ts
// =========================================================
// INTERRUPTEUR D'AUTO-ALIMENTATION v1.0 — Direct Transf'air
//
// Trois routes créent de l'argent sans contrepartie réelle : POST /transactions/admin/fund-self,
// POST /treasury/admin/inject et POST /treasury/admin/inject-all (réservées aux COMPANY_ADMIN). Elles servent pendant le
// développement et les démonstrations ; en production elles doivent être coupées.
//
//   ALLOW_SELF_FUNDING  (défaut : ouvert, comportement historique)
//     - non défini / "true"  → routes ouvertes
//     - "false"              → routes fermées (403), sans autre changement
//
// En NODE_ENV=production, tant que les routes sont ouvertes, un avertissement est écrit une fois au démarrage du service.
// =========================================================

import { ForbiddenException, Logger } from '@nestjs/common';

const logger = new Logger('SelfFunding');
let warned = false;

export function selfFundingEnabled(): boolean {
  return String(process.env.ALLOW_SELF_FUNDING ?? 'true').trim().toLowerCase() !== 'false';
}

/** Lève 403 si l'auto-alimentation est coupée ; avertit une fois quand elle reste ouverte en production. */
export function assertSelfFundingAllowed(): void {
  if (!selfFundingEnabled()) {
    throw new ForbiddenException(
      "L'auto-alimentation est désactivée. Alimentez le portefeuille par un paiement réel (recharge ou virement B2B).",
    );
  }
  if (!warned && process.env.NODE_ENV === 'production') {
    warned = true;
    logger.warn(
      "⚠️ ALLOW_SELF_FUNDING est ouvert en production : un admin société peut s'ajouter de l'argent sans paiement. " +
      'Définissez ALLOW_SELF_FUNDING=false avant la mise en service.',
    );
  }
}

/** Pour les tests : réarme l'avertissement. */
export function resetSelfFundingWarning(): void {
  warned = false;
}
