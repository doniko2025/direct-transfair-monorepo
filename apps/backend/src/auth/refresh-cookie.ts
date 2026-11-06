// apps/backend/src/auth/refresh-cookie.ts
// =========================================================
// REFRESH TOKEN EN COOKIE httpOnly — portail web uniquement
//
// Avant : le portail web gardait le refresh token (valable 30 jours) dans localStorage, lisible par n'importe quel script de la
// page (une faille XSS suffisait à voler la session). Désormais, pour une requête qui porte `x-app-client: web` :
//   - le serveur pose le refresh token dans un cookie httpOnly (illisible depuis JavaScript) et le retire du corps de la réponse ;
//   - POST /auth/refresh lit le cookie ; POST /auth/logout l'efface.
// Le mobile ne change pas (il n'envoie pas cet en-tête : tokens dans le corps comme avant).
//
// Protection CSRF : le cookie n'est utilisé que si la requête porte l'en-tête personnalisé `x-app-client: web`. Un formulaire ou
// une image d'un autre site ne peut pas l'envoyer, et une requête fetch/XHR avec cet en-tête déclenche une pré-vérification
// CORS que le serveur n'accepte que pour ses origines connues.
//
// Réglages (variables d'environnement, toutes facultatives) :
//   AUTH_COOKIE_SAMESITE  lax | strict | none   défaut : none en production (portail et API sur des sites différents), lax sinon
//                         → choisir « lax » si le portail appelle l'API par le même domaine (réécriture /api côté hébergeur) :
//                           les cookies tiers sont de plus en plus bloqués par les navigateurs (Safari, Chrome).
//   AUTH_COOKIE_SECURE    true | false          défaut : true en production, ou si SameSite=none (obligatoire pour « none »)
//   AUTH_COOKIE_DOMAIN    ex. .exemple.com      défaut : aucun (cookie propre à l'hôte de l'API)
//   AUTH_COOKIE_NAME      défaut : dt_rt
// =========================================================

import type { Request, Response } from 'express';

import { APP_CLIENT_HEADER, APP_CLIENT_WEB } from './app-client.policy';

export const REFRESH_COOKIE_DAYS = 30;
const COOKIE_PATH = '/api/auth';

export function cookieName(): string {
  return (process.env.AUTH_COOKIE_NAME || 'dt_rt').trim();
}

/** La requête vient-elle du portail web (en-tête x-app-client: web) ? */
export function isWebClient(req: Pick<Request, 'headers'>): boolean {
  const v = req.headers?.[APP_CLIENT_HEADER];
  const value = Array.isArray(v) ? v[0] : v;
  return typeof value === 'string' && value.trim().toLowerCase() === APP_CLIENT_WEB;
}

type SameSite = 'lax' | 'strict' | 'none';

export function cookieOptions(): { httpOnly: true; secure: boolean; sameSite: SameSite; path: string; domain?: string } {
  const prod = process.env.NODE_ENV === 'production';
  const raw = (process.env.AUTH_COOKIE_SAMESITE || '').trim().toLowerCase();
  const sameSite: SameSite = raw === 'lax' || raw === 'strict' || raw === 'none' ? raw : prod ? 'none' : 'lax';
  const secureEnv = (process.env.AUTH_COOKIE_SECURE || '').trim().toLowerCase();
  const secure = sameSite === 'none' ? true : secureEnv ? secureEnv !== 'false' : prod;
  const domain = (process.env.AUTH_COOKIE_DOMAIN || '').trim();
  return { httpOnly: true, secure, sameSite, path: COOKIE_PATH, ...(domain ? { domain } : {}) };
}

export function setRefreshCookie(res: Pick<Response, 'cookie'>, token: string): void {
  res.cookie(cookieName(), token, { ...cookieOptions(), maxAge: REFRESH_COOKIE_DAYS * 24 * 60 * 60 * 1000 });
}

export function clearRefreshCookie(res: Pick<Response, 'clearCookie'>): void {
  res.clearCookie(cookieName(), cookieOptions());
}

/** Lit le refresh token du cookie (analyse minimale de l'en-tête Cookie : pas de dépendance cookie-parser). */
export function readRefreshCookie(req: Pick<Request, 'headers'>): string | undefined {
  const header = req.headers?.cookie;
  if (typeof header !== 'string' || !header) return undefined;
  const name = cookieName();
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() !== name) continue;
    const value = part.slice(i + 1).trim();
    try {
      return decodeURIComponent(value) || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
