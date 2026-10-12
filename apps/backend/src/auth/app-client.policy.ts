// apps/backend/src/auth/app-client.policy.ts
// =========================================================
// POLITIQUE « APPLICATION CLIENTE » v1.0 — Direct Transf'air
//
// Sépare les deux publics de la plateforme :
//   - le portail web (apps/web-admin) : SUPER_ADMIN, COMPANY_ADMIN, AGENT ;
//   - l'application mobile            : clients wallet (rôle USER) uniquement.
//
// Le portail web s'identifie en envoyant l'en-tête `x-app-client: web`
// (voir packages/shared/src/http.ts). Les trois rôles « web » ne peuvent
// ouvrir ni renouveler une session que si cet en-tête est présent.
// Une requête sans en-tête (ancienne version du mobile, script, outil
// de test) est donc refusée pour ces rôles — le rôle USER, lui, n'est
// jamais concerné.
//
// ⚠️ L'en-tête est déclaratif : ce n'est PAS une barrière
// d'authentification (un compte du personnel authentifié peut déjà tout
// faire depuis le web). C'est une règle de séparation des publics qui
// ferme le mobile aux comptes du personnel, y compris les anciennes
// versions de l'app.
// =========================================================

import { HttpException } from '@nestjs/common';
import { Role } from '@prisma/client';

export const APP_CLIENT_HEADER = 'x-app-client';
export const APP_CLIENT_WEB = 'web';

/** Code d'erreur renvoyé au client (le web et le mobile peuvent s'y fier). */
export const USE_WEB_PORTAL_CODE = 'USE_WEB_PORTAL';

export const USE_WEB_PORTAL_MESSAGE =
  "Ce compte est réservé au portail web. L'application mobile est réservée aux clients : " +
  'connectez-vous depuis le portail web de votre société.';

const WEB_ONLY_ROLES: ReadonlySet<string> = new Set<string>([
  Role.SUPER_ADMIN,
  Role.COMPANY_ADMIN,
  Role.AGENT,
]);

/** Vrai pour les rôles qui n'ont le droit de se connecter que depuis le web. */
export function isWebOnlyRole(role: string | null | undefined): boolean {
  return !!role && WEB_ONLY_ROLES.has(role);
}

/**
 * Normalise la valeur brute de l'en-tête (Express peut fournir un tableau
 * si l'en-tête est répété). Retourne null si absent ou vide.
 */
export function normalizeAppClient(
  raw: string | string[] | null | undefined,
): string | null {
  const first = Array.isArray(raw) ? raw[0] : raw;
  const value = (first ?? '').trim().toLowerCase();
  return value || null;
}

/**
 * Lève un 403 USE_WEB_PORTAL si le compte est un compte « web » et que la
 * requête ne s'identifie pas comme venant du portail web.
 * Sans effet pour le rôle USER.
 */
export function assertAppClientAllowed(
  role: string | null | undefined,
  appClientHeader: string | string[] | null | undefined,
): void {
  if (!isWebOnlyRole(role)) return;
  if (normalizeAppClient(appClientHeader) === APP_CLIENT_WEB) return;

  throw new HttpException(
    {
      statusCode: 403,
      code: USE_WEB_PORTAL_CODE,
      message: USE_WEB_PORTAL_MESSAGE,
    },
    403,
  );
}
