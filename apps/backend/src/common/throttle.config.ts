// apps/backend/src/common/throttle.config.ts
// =========================================================
// Configuration du rate limiting (@nestjs/throttler v5)
//
// PROBLÈME CORRIGÉ
//   Dans @nestjs/throttler v5, TOUS les throttlers nommés déclarés dans
//   ThrottlerModule.forRoot([...]) s'appliquent à CHAQUE route. Avec
//   `auth` (5 req / 60 s) et `otp` (10 req / 1 h) déclarés globalement, une
//   route ordinaire comme GET /clients était donc limitée à 5 requêtes par
//   minute ET 10 requêtes par heure et par IP : le back-office web (qui
//   charge plusieurs ressources par page) et l'app mobile prenaient un 429
//   « Trop de tentatives » après quelques clics.
//
// COMPORTEMENT VOULU
//   - `default` : 100 req / 60 s sur toutes les routes.
//   - `auth` et `otp` : actifs UNIQUEMENT sur les routes qui les demandent
//     explicitement avec @Throttle({ auth: {...} }) / @Throttle({ otp: {...} }).
// =========================================================

import type { ExecutionContext } from '@nestjs/common';
import type { ThrottlerOptions } from '@nestjs/throttler';

/** Clé de métadonnée posée par @Throttle({ <nom>: {...} }) (voir throttler.constants). */
const THROTTLER_LIMIT = 'THROTTLER:LIMIT';

/** Vrai si la route (ou son contrôleur) a demandé le throttler `name` via @Throttle. */
function isRequestedByRoute(name: string, context: ExecutionContext): boolean {
  const key = THROTTLER_LIMIT + name;
  return (
    Reflect.getMetadata(key, context.getHandler()) !== undefined ||
    Reflect.getMetadata(key, context.getClass()) !== undefined
  );
}

/** Throttler qui ne s'applique que sur les routes qui le réclament explicitement. */
function onlyWhenRequested(name: string): Pick<ThrottlerOptions, 'skipIf'> {
  return { skipIf: (context) => !isRequestedByRoute(name, context) };
}

export const THROTTLERS: ThrottlerOptions[] = [
  {
    name: 'default',
    ttl: 60_000, // 1 minute
    limit: 100, // 100 req/min → APIs standard
  },
  {
    name: 'auth',
    ttl: 60_000,
    limit: 5, // surchargé par @Throttle({ auth }) sur les routes de connexion
    ...onlyWhenRequested('auth'),
  },
  {
    name: 'otp',
    ttl: 3_600_000, // 1 heure
    limit: 10, // surchargé par @Throttle({ otp }) sur les routes d'envoi d'OTP
    ...onlyWhenRequested('otp'),
  },
];
