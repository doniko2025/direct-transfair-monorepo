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
