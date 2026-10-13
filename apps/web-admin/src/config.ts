// src/config.ts — lecture unique des variables d'environnement Vite.
import { normalizeHost, normalizeTenantCode } from '@direct-transfair/shared';

const rawApiUrl = (import.meta.env.VITE_API_URL ?? '').trim();

/** URL du backend. Vide en production si VITE_API_URL n'est pas définie. */
export const API_URL: string = rawApiUrl || (import.meta.env.DEV ? 'http://localhost:3000' : '');

export const API_CONFIGURED: boolean = API_URL !== '';

/** Domaines qui affichent le portail plateforme (super admin). */
export const PLATFORM_HOSTS: string[] = (import.meta.env.VITE_PLATFORM_HOSTS ?? '')
  .split(',')
  .map((h) => normalizeHost(h))
  .filter(Boolean);

/** Code société imposé (tests). */
export const FIXED_TENANT: string | null = normalizeTenantCode(import.meta.env.VITE_TENANT_CODE);

/** ?tenant=CODE accepté dans l'URL (toujours en dev, en prod seulement si activé). */
export const ALLOW_TENANT_QUERY: boolean =
  import.meta.env.DEV || import.meta.env.VITE_ALLOW_TENANT_QUERY === 'true';

// ─── Mode « console » : ce portail est servi sous /transfert derrière la console dkmoney.store ───

/** Préfixe d'URL du portail ('' à la racine, '/transfert' derrière la console). Vient de `base` de Vite. */
export const BASE_PATH: string = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '');

/**
 * URL de la console du Grand Chef (ex. « / » : même domaine). Renseignée ⇒ le portail est « embarqué » :
 * bouton « Retour à la console », identité visuelle propre, connexion unique acceptée sur /sso.
 */
export const CONSOLE_URL: string = (import.meta.env.VITE_CONSOLE_URL ?? '').trim();
export const CONSOLE_EMBEDDED: boolean = CONSOLE_URL !== '';
export const CONSOLE_NAME: string = (import.meta.env.VITE_CONSOLE_NAME ?? '').trim() || 'Console Grand Chef';
