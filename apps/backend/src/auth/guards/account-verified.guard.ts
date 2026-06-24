// apps/backend/src/auth/guards/account-verified.guard.ts
// =========================================================
// ACCOUNT VERIFIED GUARD
// Usage : @UseGuards(JwtAuthGuard, AccountVerifiedGuard)
// Bloque toute route protégée si email ou téléphone non vérifiés.
// ─────────────────────────────────────────────────────────
// Exemption : @SkipVerification() sur un handler ou un controller
// =========================================================

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PrismaService } from '../../prisma/prisma.service';

export const SKIP_VERIFICATION_KEY = 'skipVerification';

/**
 * Décorateur pour exempter une route de la vérification.
 * Exemple : routes de profil basique accessibles avant vérification.
 *
 * @example
 * @SkipVerification()
 * @Get('me/basic')
 * getBasicProfile() { ... }
 */
export const SkipVerification = () =>
  SetMetadata(SKIP_VERIFICATION_KEY, true);

@Injectable()
export class AccountVerifiedGuard implements CanActivate {
  constructor(
    private readonly prisma:    PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Vérifier si la route est exemptée
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_VERIFICATION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const req    = context.switchToHttp().getRequest<any>();
    const userId = req.user?.id;

    // Si pas d'utilisateur → le JwtAuthGuard gère déjà le rejet
    if (!userId) return true;

    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: {
        isEmailVerified: true,
        isPhoneVerified: true,
        phone:           true,
      },
    });

    if (!user) return true;

    const emailOk = user.isEmailVerified;
    const phoneOk = !user.phone || user.isPhoneVerified;

    if (!emailOk || !phoneOk) {
      throw new ForbiddenException({
        code:          'VERIFICATION_REQUIRED',
        message:       'Vérifiez votre email et votre téléphone avant de continuer.',
        emailVerified: user.isEmailVerified,
        phoneVerified: user.isPhoneVerified,
        hasPhone:      !!user.phone,
      });
    }

    return true;
  }
}