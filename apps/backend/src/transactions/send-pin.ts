// apps/backend/src/transactions/send-pin.ts
// =========================================================
// CODE SECRET AVANT UN ENVOI (audit argent I1)
// Un envoi déplace de l'argent : sans code secret, un téléphone déverrouillé ou une session volée suffirait à vider un
// portefeuille. Le client (rôle USER, seul à avoir un code à 6 chiffres) doit donc le saisir à chaque envoi.
// Les comptes web (agent, admin société, support) n'ont pas de code à 6 chiffres : leurs envois au comptoir sont déjà
// encadrés par la vérification d'identité de l'expéditeur (lot 7/8).
// Même compteur d'erreurs que la connexion : 5 essais ratés → blocage 30 minutes (PinVerifierService).
// =========================================================

import { ForbiddenException } from '@nestjs/common';

export const PIN_REQUIRED_CODE = 'PIN_REQUIRED';

export interface PinChecker {
  assertPin(userId: string, pin: unknown): Promise<void>;
}

/** Les rôles dont l'envoi exige le code secret. */
export function sendRequiresPin(role: string | undefined | null): boolean {
  return role === 'USER';
}

export async function assertSendPin(
  pins: PinChecker,
  user: { id?: string; role?: string } | undefined | null,
  pin: unknown,
): Promise<void> {
  if (!user?.id) throw new ForbiddenException('Non authentifié');
  if (!sendRequiresPin(user.role)) return;
  if (pin === undefined || pin === null || pin === '') {
    throw new ForbiddenException({ statusCode: 403, code: PIN_REQUIRED_CODE, message: 'Code secret requis pour envoyer de l’argent.' });
  }
  await pins.assertPin(user.id, pin);
}
