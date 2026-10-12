// apps/backend/src/auth/refresh-token.util.ts
// =========================================================
// Outils communs aux jetons de renouvellement (refresh tokens) — v1.0 (phase 6)
//
// Un refresh token n'est JAMAIS stocké en clair : on garde son empreinte SHA-256.
// AuthService.refreshTokens() cherche la session par empreinte ; toute création de
// session (v1 comme v2) doit donc passer par ces fonctions, sinon la session ne
// pourra jamais être renouvelée (c'était le cas des connexions v2, voir
// v2-auth.service.ts v2.5).
// =========================================================

import * as crypto from 'crypto';

/** Génère un refresh token aléatoire (96 caractères hexadécimaux). */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

/** Empreinte SHA-256 stockée en base à la place du refresh token. */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
