// apps/direct-transfair-mobile/components/ui/theme.ts
// =========================================================
// DESIGN SYSTEM « CORRIDOR » v3.0 — Direct Transf'air (white-label)
// ✅ v3.0 : refonte visuelle « Corridor » — fond brume, vert forêt, feuille, jaune soleil ;
//    polices Manrope (interface, montants) + Fraunces (salutation, titres) ; coins 28 / 20 / pilule ;
//    ombres teintées vert forêt ; CTA principal jaune. Les clés de palette existantes sont conservées :
//    aucun écran n'a besoin d'être réécrit pour recevoir le nouveau style.
// v2.0 : refonte totale en thème clair.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
//
// Une seule source pour tous les écrans mobiles :
//   • useUI()  → { C, R, S, T, accent, accentInk, brandName, logoUrl, tagline }
//   • C : couleurs, R : rayons, S : ombres, T : styles de texte
// White-label : avec la marque par défaut (#059669) on obtient EXACTEMENT la palette Corridor ;
// pour une autre société, toute la palette est dérivée de sa couleur primaire (forêt, feuille, brume,
// trait) et de sa couleur secondaire (bouton principal) — rien n'est figé par société.
// =========================================================

import { useMemo } from 'react';
import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import { useTenant } from '../../providers/TenantProvider';
import { setBrandPrimary } from '../wallet/brand';
import { SANS, SERIF } from './fonts';

export const DEFAULT_ACCENT = '#059669';
export const DEFAULT_SECONDARY = '#10B981';
export { SANS, SERIF } from './fonts';

// ─── utilitaires couleur ─────────────────────────────────
function parse(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return [5, 150, 105];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const h2 = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
export function toHex(r: number, g: number, b: number): string { return `#${h2(r)}${h2(g)}${h2(b)}`.toUpperCase(); }

/** Mélange `hex` avec `mixWith` (0 = hex, 1 = mixWith). */
export function mix(hex: string, mixWith: string, t: number): string {
  const a = parse(hex), b = parse(mixWith);
  return toHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}
export function alpha(hex: string, a: number): string {
  const [r, g, b] = parse(hex);
  return `rgba(${r},${g},${b},${a})`;
}
export function luminance(hex: string): number {
  const [r, g, b] = parse(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Texte lisible posé sur `bg` : noir sur fond clair, blanc sur fond foncé. */
export function inkOn(bg: string, dark = '#111214', light = '#FFFFFF'): string {
  return luminance(bg) > 0.38 ? dark : light;
}

// ─── Palette ─────────────────────────────────────────────
export type UIColors = ReturnType<typeof buildColors>;

const isHex = (v?: string | null): v is string => /^#[0-9a-f]{6}$/i.test(v || '');

/** Les 7 teintes Corridor (palette de la maquette validée). */
const CORRIDOR = {
  brume: '#E8F0EA', forest: '#0E3B2D', leaf: '#1F8A5B', sun: '#F5C32C',
  ink: '#10231B', soft: '#5E7468', fil: '#D3E0D7',
};

function baseTints(primary?: string | null) {
  const p = isHex(primary) ? primary.toUpperCase() : DEFAULT_ACCENT;
  if (p === DEFAULT_ACCENT) return CORRIDOR;
  const forest = mix(p, '#000000', 0.62);
  return {
    brume: mix(p, '#FFFFFF', 0.91),
    forest,
    leaf: luminance(p) > 0.3 ? mix(p, '#000000', 0.32) : p,
    sun: CORRIDOR.sun,
    ink: mix(p, '#000000', 0.84),
    soft: mix(forest, '#FFFFFF', 0.3),
    fil: mix(p, '#FFFFFF', 0.8),
  };
}

export function buildColors(primary?: string | null, secondary?: string | null) {
  const t = baseTints(primary);
  const custom = (isHex(primary) ? primary.toUpperCase() : DEFAULT_ACCENT) !== DEFAULT_ACCENT;
  // Bouton principal : jaune soleil, ou la couleur secondaire de la société si elle en a une propre.
  const sun = custom && isHex(secondary) && secondary.toUpperCase() !== DEFAULT_SECONDARY ? secondary.toUpperCase() : t.sun;
  const leaf = t.leaf;
  return {
    // marque Corridor
    brume: t.brume, forest: t.forest, leaf, sun,
    sunInk: inkOn(sun, t.forest, '#FFFFFF'),
    sunSoft: mix(sun, '#FFFFFF', 0.86),
    sunLine: mix(sun, '#FFFFFF', 0.4),
    // surfaces
    bg: t.brume,
    surface: '#FFFFFF',
    field: mix(t.brume, '#FFFFFF', 0.55),
    sunken: mix(t.brume, '#FFFFFF', 0.35),
    beige: mix(t.brume, t.forest, 0.07),
    // texte
    ink: t.ink,
    text: mix(t.ink, '#FFFFFF', 0.12),
    muted: t.soft,
    faint: mix(t.soft, '#FFFFFF', 0.45),
    // traits
    line: t.fil,
    lineStrong: mix(t.fil, t.forest, 0.14),
    // accent de la société (texte, icônes, liens, interrupteurs) = feuille
    accent: leaf,
    accentInk: inkOn(leaf, t.ink, '#FFFFFF'),
    accentSoft: mix(leaf, '#FFFFFF', 0.88),
    accentLine: mix(leaf, '#FFFFFF', 0.62),
    accentDeep: t.forest,
    // sélection (chips actives, onglet actif) = forêt
    dark: t.forest,
    darkInk: '#FFFFFF',
    // sémantique
    pos: leaf, posBg: mix(leaf, '#FFFFFF', 0.86),
    danger: '#C62828', dangerBg: '#FDECEA', dangerLine: '#F5C6C2',
    warn: '#A86400', warnBg: '#FFF4DB', warnLine: '#F1D79A',
    info: '#1D5FD1', infoBg: '#E8F0FE', infoLine: '#C3D6FA',
    violet: '#6941C6', violetBg: '#F4EDFF',
    white: '#FFFFFF',
    scrim: alpha(t.forest, 0.5),
  };
}

/** Rayons Corridor : cartes 28 (lg), bouton principal 20 (md), pastilles = pilule. */
export const R = { xs: 10, sm: 14, md: 20, lg: 28, xl: 32, pill: 999 } as const;

const SHADOW_RGB = '14,59,45';
export const S: Record<'none' | 'sm' | 'md' | 'lg', ViewStyle> = {
  none: {},
  sm: Platform.select<ViewStyle>({
    web: { boxShadow: `0 1px 2px rgba(${SHADOW_RGB},0.06)` } as any,
    default: { shadowColor: '#0E3B2D', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  }) as ViewStyle,
  md: Platform.select<ViewStyle>({
    web: { boxShadow: `0 8px 24px rgba(${SHADOW_RGB},0.08)` } as any,
    default: { shadowColor: '#0E3B2D', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 4 },
  }) as ViewStyle,
  lg: Platform.select<ViewStyle>({
    web: { boxShadow: `0 16px 40px rgba(${SHADOW_RGB},0.16)` } as any,
    default: { shadowColor: '#0E3B2D', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.16, shadowRadius: 40, elevation: 10 },
  }) as ViewStyle,
};

/** Police d'interface (nom logique résolu en Manrope au poids demandé — voir fonts.ts). */
export const SYSTEM_FONT = SANS;
/** Police d'accent (Fraunces) : salutation, titres d'écran, noms de villes. */
export const SERIF_FONT = SERIF;

export type TextVariant =
  | 'display' | 'hero' | 'title' | 'heading' | 'subheading' | 'body' | 'bodyStrong'
  | 'caption' | 'label' | 'overline' | 'button';

export const T: Record<TextVariant, TextStyle> = {
  display:    { fontFamily: SANS,  fontSize: 40, lineHeight: 46, fontWeight: '800', letterSpacing: -1.2 },
  hero:       { fontFamily: SERIF, fontSize: 31, lineHeight: 37, fontWeight: '700', letterSpacing: -0.4 },
  title:      { fontFamily: SERIF, fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.2 },
  heading:    { fontFamily: SANS,  fontSize: 18, lineHeight: 24, fontWeight: '800', letterSpacing: -0.2 },
  subheading: { fontFamily: SANS,  fontSize: 16, lineHeight: 22, fontWeight: '700', letterSpacing: -0.1 },
  body:       { fontFamily: SANS,  fontSize: 15, lineHeight: 22, fontWeight: '500' },
  bodyStrong: { fontFamily: SANS,  fontSize: 15, lineHeight: 22, fontWeight: '700' },
  caption:    { fontFamily: SANS,  fontSize: 13, lineHeight: 18, fontWeight: '500' },
  label:      { fontFamily: SANS,  fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.1 },
  overline:   { fontFamily: SANS,  fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 0 },
  button:     { fontFamily: SANS,  fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: -0.1 },
};

/** Espace à réserver en bas des écrans pour la barre d'onglets (80 + marge). */
export const TAB_SPACE = 104;

export function useUI() {
  const { branding } = useTenant();
  // garde les anciens écrans (brand()/themed()) synchronisés pendant la migration
  setBrandPrimary(branding.primaryColor);
  const C = useMemo(() => buildColors(branding.primaryColor, branding.secondaryColor), [branding.primaryColor, branding.secondaryColor]);
  return {
    C, R, S, T,
    accent: C.accent,
    accentInk: C.accentInk,
    brandName: branding.name,
    logoUrl: branding.logoUrl,
    tagline: branding.tagline,
  };
}
