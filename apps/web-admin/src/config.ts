// src/config.ts — lecture unique des variables d'environnement Vite.
// ✅ phase 8 (logo « t’ ») : PLATFORM_LOGO_URL (VITE_PLATFORM_LOGO_URL, défaut <base>/brand/logo-mark.svg) — logo « t’ » du portail plateforme.
// ✅ phase 7 : identité de la plateforme (nom, accroche, couleurs, nom du portail embarqué) pilotée par VITE_* — plus rien en dur dans branding.ts.
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

// ─── Identité de la plateforme (valeurs par défaut du portail plateforme) ───
const envText = (v: string | undefined, fallback: string): string => (v ?? '').trim() || fallback;

export const PLATFORM_NAME: string = envText(import.meta.env.VITE_PLATFORM_NAME, "Direct Transf'air");
export const PLATFORM_TAGLINE: string = envText(import.meta.env.VITE_PLATFORM_TAGLINE, 'Espace de gestion de la plateforme');
export const BRAND_PRIMARY: string = envText(import.meta.env.VITE_BRAND_PRIMARY, '#0b7a5b');
export const BRAND_SECONDARY: string = envText(import.meta.env.VITE_BRAND_SECONDARY, '#f7931e');
/** Logo du portail plateforme (monogramme « t’ »). Surchargeable : VITE_PLATFORM_LOGO_URL (adresse absolue ou chemin). */
export const PLATFORM_LOGO_URL: string = envText(import.meta.env.VITE_PLATFORM_LOGO_URL, `${BASE_PATH}/brand/logo-mark.svg`);

/** Identité du portail plateforme quand il est embarqué dans la console. */
export const CONSOLE_PORTAL_NAME: string = envText(import.meta.env.VITE_CONSOLE_PORTAL_NAME, 'Sociétés de transfert');
export const CONSOLE_PORTAL_TAGLINE: string = envText(
  import.meta.env.VITE_CONSOLE_PORTAL_TAGLINE,
  'Pilotage des sociétés de transfert d’argent',
);
