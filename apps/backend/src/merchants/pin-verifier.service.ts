// apps/backend/src/merchants/pin-verifier.service.ts
// =========================================================
// CODE SECRET — confirmation d'une opération sensible (payer un marchand, retirer, changer la destination des retraits).
// Le code secret est le mot de passe à 6 chiffres du client (lot 10), haché en bcrypt dans User.password.
// Mêmes compteurs que la connexion : 5 erreurs → compte verrouillé 30 minutes. Une réussite remet le compteur à zéro.
// Erreur renvoyée en 403 avec un `code` : le mobile ne déconnecte pas l'utilisateur (le 401 est réservé à la session).
// =========================================================

import { ForbiddenException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';
import { matchesTestPin } from '../common/test-pin'; // lot 13 : code de test 000000 (désactivé par défaut)

export const PIN_MAX_FAILURES = 5;
export const PIN_LOCK_MINUTES = 30;
export const PIN_INVALID_CODE = 'PIN_INVALID';
export const PIN_LOCKED_CODE = 'PIN_LOCKED';

@Injectable()
export class PinVerifierService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lève une 403 si le code est faux ou le compte verrouillé. Sans effet si le code est bon. */
  async assertPin(userId: string, pin: unknown): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, password: true, failedLoginAttempts: true, lockedUntil: true },
    });
    if (!user) throw new ForbiddenException({ statusCode: 403, code: PIN_INVALID_CODE, message: 'Compte introuvable.' });

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60_000);
      throw new ForbiddenException({ statusCode: 403, code: PIN_LOCKED_CODE, message: `Trop d'essais. Code secret bloqué pendant ${minutes} minute(s).` });
    }

    const value = typeof pin === 'string' ? pin : '';
    if (/^\d{6}$/.test(value) && (matchesTestPin(user, value) || (await bcrypt.compare(value, user.password)))) {
      if ((user.failedLoginAttempts ?? 0) > 0 || user.lockedUntil) {
        await this.prisma.user.update({ where: { id: userId }, data: { failedLoginAttempts: 0, lockedUntil: null } }).catch(() => undefined);
      }
      return;
    }

    // Le compteur est incrémenté en une seule requête atomique : deux essais simultanés comptent tous les deux.
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 }, lastFailedLoginAt: now },
      select: { failedLoginAttempts: true },
    });
    const count = updated.failedLoginAttempts ?? 0;
    if (count >= PIN_MAX_FAILURES) {
      await this.prisma.user.update({ where: { id: userId }, data: { lockedUntil: new Date(now.getTime() + PIN_LOCK_MINUTES * 60_000) } }).catch(() => undefined);
      throw new ForbiddenException({ statusCode: 403, code: PIN_LOCKED_CODE, message: `Trop d'essais. Code secret bloqué pendant ${PIN_LOCK_MINUTES} minutes.` });
    }
    throw new ForbiddenException({
      statusCode: 403,
      code: PIN_INVALID_CODE,
      message: `Code secret incorrect. Il vous reste ${PIN_MAX_FAILURES - count} essai(s).`,
      attemptsLeft: PIN_MAX_FAILURES - count,
    });
  }
}
