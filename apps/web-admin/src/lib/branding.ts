// src/lib/branding.ts
// ✅ phase 8 (logo « t’ ») : le portail plateforme (et la console embarquée) affichent le monogramme « t’ » (PLATFORM_LOGO_URL) ; une société garde son logo ou sa lettre.
// ✅ phase 7 : nom, accroche et couleurs de la plateforme lus dans config.ts (VITE_PLATFORM_* / VITE_BRAND_* / VITE_CONSOLE_PORTAL_*).
// Applique le branding d'une société (couleurs, police, titre) via des
// variables CSS : les composants ne connaissent jamais une couleur en dur.

import { PLATFORM_TENANT, type TenantBranding } from '@direct-transfair/shared';
import {
  BASE_PATH, CONSOLE_EMBEDDED, PLATFORM_LOGO_URL, PLATFORM_NAME, PLATFORM_TAGLINE, BRAND_PRIMARY, BRAND_SECONDARY,
  CONSOLE_PORTAL_NAME, CONSOLE_PORTAL_TAGLINE,
} from '../config';
import { parseHex, readableOn } from './colors';

export const DEFAULT_BRANDING: TenantBranding = {
  code: PLATFORM_TENANT,
  name: PLATFORM_NAME,
  logoUrl: PLATFORM_LOGO_URL,
  primaryColor: BRAND_PRIMARY,
  secondaryColor: BRAND_SECONDARY,
  tagline: PLATFORM_TAGLINE,
  fontFamily: null,
  welcomeMessage: null,
  subdomain: null,
  customDomain: null,
};

/**
 * Identité du portail plateforme quand il est servi dans la console du Grand Chef : nom, logo et
 * couleurs propres, distincts de ceux du côté associations (violet). Les portails de société gardent
 * le branding de leur société.
 */
export function consoleBranding(): TenantBranding {
  return {
    ...DEFAULT_BRANDING,
    name: CONSOLE_PORTAL_NAME,
    tagline: CONSOLE_PORTAL_TAGLINE,
    logoUrl: PLATFORM_LOGO_URL,
  };
}

export const platformBranding = (): TenantBranding => (CONSOLE_EMBEDDED ? consoleBranding() : DEFAULT_BRANDING);

const BASE_FONT = 'Bricolage Grotesque';
const FONT_LINK_ID = 'dt-font-tenant';

/** Charge une police Google demandée par la société (nom nettoyé, jamais injecté tel quel). */
function applyFont(family: string | null): void {
  const root = document.documentElement;
  const clean = (family ?? '').replace(/[^A-Za-z0-9 ]/g, '').trim();

  document.getElementById(FONT_LINK_ID)?.remove();

  if (!clean || clean.toLowerCase() === BASE_FONT.toLowerCase()) {
    root.style.removeProperty('--font');
    return;
  }

  const link = document.createElement('link');
  link.id = FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(clean).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);

  root.style.setProperty(
    '--font',
    `"${clean}", "${BASE_FONT}", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`,
  );
}

/**
 * Icône et nom d'installation du portail (onglet, « Ajouter à l'écran d'accueil »).
 *   • société avec logo → son logo (adresse https, ou image importée servie par /api/icon) ;
 *   • plateforme (Grand Chef), société sans logo → « t’ ».
 * Le manifeste d'installation est fabriqué par /api/manifest selon l'adresse du portail (voir api/_branding.js) ; il n'est
 * branché qu'à la racine du site (sous un chemin « /transfert » derrière la console, le fichier statique reste utilisé).
 */
function setLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.removeAttribute('type');
  el.removeAttribute('sizes');
  el.href = href;
}

export function installIconOf(branding: TenantBranding): string | null {
  const logo = (branding.logoUrl ?? '').trim();
  if (/^https:\/\/\S+$/i.test(logo)) return logo;
  // Image importée : servie par la fonction /api/icon, qui n'existe qu'à la racine du site.
  if (BASE_PATH === '' && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(logo)) return '/api/icon';
  return null;
}

function applyInstallIdentity(branding: TenantBranding): void {
  const isPlatform = branding.code === DEFAULT_BRANDING.code;
  const icon = isPlatform ? null : installIconOf(branding);
  if (icon) {
    // Un favicon « svg » de la plateforme resterait prioritaire : on retire les icônes déclarées pour ne garder que celle de la société.
    document.head.querySelectorAll('link[rel="icon"]').forEach((el) => el.remove());
    setLink('icon', icon);
    setLink('apple-touch-icon', icon);
  }
  const shortName = isPlatform ? 'Gestion' : branding.name.slice(0, 12);
  document.head.querySelector('meta[name="application-name"]')?.setAttribute('content', isPlatform ? 'Espace de gestion' : branding.name);
  let title = document.head.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
  if (!title) {
    title = document.createElement('meta');
    title.name = 'apple-mobile-web-app-title';
    document.head.appendChild(title);
  }
  title.content = shortName;
  if (BASE_PATH === '' && !isPlatform) {
    const manifest = document.head.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (manifest) manifest.href = '/api/manifest';
  }
}

export function applyBranding(branding: TenantBranding): void {
  const root = document.documentElement;

  const primary = parseHex(branding.primaryColor) ?? parseHex(DEFAULT_BRANDING.primaryColor)!;
  const accent = parseHex(branding.secondaryColor) ?? parseHex(DEFAULT_BRANDING.secondaryColor)!;

  root.style.setProperty('--brand', primary);
  root.style.setProperty('--brand-ink', readableOn(primary));
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-ink', readableOn(accent));

  applyFont(branding.fontFamily);

  document.title = `Espace de gestion — ${branding.name}`;
  applyInstallIdentity(branding);
}
