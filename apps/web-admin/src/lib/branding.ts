// src/lib/branding.ts
// ✅ phase 8 (logo « t’ ») : le portail plateforme (et la console embarquée) affichent le monogramme « t’ » (PLATFORM_LOGO_URL) ; une société garde son logo ou sa lettre.
// ✅ phase 7 : nom, accroche et couleurs de la plateforme lus dans config.ts (VITE_PLATFORM_* / VITE_BRAND_* / VITE_CONSOLE_PORTAL_*).
// Applique le branding d'une société (couleurs, police, titre) via des
// variables CSS : les composants ne connaissent jamais une couleur en dur.

import { PLATFORM_TENANT, type TenantBranding } from '@direct-transfair/shared';
import {
  CONSOLE_EMBEDDED, PLATFORM_LOGO_URL, PLATFORM_NAME, PLATFORM_TAGLINE, BRAND_PRIMARY, BRAND_SECONDARY,
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
}
