// apps/direct-transfair-mobile/components/ui/theme.ts
// =========================================================
// DESIGN SYSTEM v4.0 — Direct Transf'air (white-label) — Lot 12
// ✅ v4.0 : FOND BLANC PUR (#FFFFFF, écrit en dur : aucune couleur de société ne le teinte), police Inter, noir doux pour
//    le texte, champs gris clair. Les couleurs de l'administrateur PILOTENT l'interface :
//      • « Couleur principale »  → bouton principal, onglet actif, barre de progression, éléments de marque ;
//      • « Couleur d'accent »    → liens, interrupteurs, icônes et pastilles d'accent.
//    Tant que l'administrateur n'a pas choisi une couleur différente du vert par défaut de la plateforme
//    (#059669 / #10B981), l'orange par défaut (#D9650E) s'applique. Les clés de palette existantes sont conservées.
// (historique) DESIGN SYSTEM « CORRIDOR » v3.0
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
import { useTheme } from '../../providers/ThemeProvider';
import type { Scheme } from './themeMode';
import { SANS, SERIF } from './fonts';

/** Couleurs par défaut de la plateforme (celles qu'une société reçoit tant qu'elle n'a rien choisi). */
export const DEFAULT_ACCENT = '#059669';
export const DEFAULT_SECONDARY = '#10B981';
/** Couleur de marque appliquée quand l'administrateur n'a pas choisi la sienne (bouton principal de la maquette). */
export const DEFAULT_BRAND_COLOR = '#D9650E';
/** Fond de toutes les pages : blanc pur, jamais dérivé d'une couleur de société. */
export const PAGE_BG = '#FFFFFF';
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
/** Texte lisible posé sur `bg` : celui des deux (sombre / clair) qui offre le meilleur contraste. */
export function inkOn(bg: string, dark = '#111111', light = '#FFFFFF'): string {
  const L = luminance(bg);
  const darkRatio = (L + 0.05) / (luminance(dark) + 0.05);
  const lightRatio = (luminance(light) + 0.05) / (L + 0.05);
  return darkRatio >= lightRatio ? dark : light;
}

// ─── Palette ─────────────────────────────────────────────
const isHex = (v?: string | null): v is string => /^#[0-9a-f]{6}$/i.test(v || '');

/** Couleur principale effective : celle de l'administrateur si elle diffère du vert par défaut, sinon l'orange par défaut. */
export function effectivePrimary(primary?: string | null): string {
  return isHex(primary) && primary.toUpperCase() !== DEFAULT_ACCENT ? primary.toUpperCase() : DEFAULT_BRAND_COLOR;
}
/** Couleur d'accent effective : celle de l'administrateur si elle diffère du vert par défaut, sinon la couleur principale. */
export function effectiveAccent(primary?: string | null, secondary?: string | null): string {
  return isHex(secondary) && secondary.toUpperCase() !== DEFAULT_SECONDARY ? secondary.toUpperCase() : effectivePrimary(primary);
}

export function buildColors(primary?: string | null, secondary?: string | null, scheme: Scheme = 'light') {
  if (scheme === 'dark') return buildDarkColors(primary, secondary);
  return buildLightColors(primary, secondary);
}

/** Thème sombre : mêmes clés que le thème clair (aucun écran n'a besoin de le savoir). Les teintes de marque se mélangent à la surface sombre. */
function buildDarkColors(primary?: string | null, secondary?: string | null) {
  const brand = effectivePrimary(primary);
  const accent = effectiveAccent(primary, secondary);
  const BG = '#0D0F12';
  const SURFACE = '#16191E';
  const ink = '#F4F5F7';
  // Texte / icônes d'accent posés sur fond sombre : on éclaircit la couleur jusqu'à un contraste lisible (≥ 4,8 : 1) avec la surface.
  const ratio = (a: string, b: string) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  let accentText = accent;
  for (const k of [0.2, 0.38, 0.55, 0.7, 0.85]) { if (ratio(accentText, SURFACE) >= 4.8) break; accentText = mix(accent, '#FFFFFF', k); }
  return {
    brume: BG, forest: ink, leaf: accent, sun: brand,
    sunInk: inkOn(brand),
    sunSoft: mix(brand, SURFACE, 0.86),
    sunLine: mix(brand, SURFACE, 0.6),
    bg: BG,
    surface: SURFACE,
    field: '#1F232A',
    sunken: '#12151A',
    beige: '#1A1D23',
    ink,
    text: '#E4E6EA',
    muted: '#9CA3AF',
    faint: '#8A93A1',
    line: '#262B33',
    lineStrong: '#343A45',
    accent,
    accentInk: inkOn(accent),
    accentSoft: mix(accent, SURFACE, 0.88),
    accentLine: mix(accent, SURFACE, 0.62),
    accentDeep: accentText,
    // sélection (chips actives, boutons « sombres ») = clair en thème sombre : texte foncé posé dessus
    dark: ink,
    darkInk: '#111111',
    pos: '#46D483', posBg: '#12301F', posLine: '#1F5A38',
    danger: '#FF7A7A', dangerBg: '#3B1D1F', dangerLine: '#6B2F33',
    warn: '#F2B24C', warnBg: '#3A2D12', warnLine: '#6B5320',
    info: '#6AA2FF', infoBg: '#14233F', infoLine: '#2A4A80',
    violet: '#A78BFA', violetBg: '#241B3D',
    white: '#FFFFFF',
    scrim: 'rgba(0,0,0,0.65)',
    isDark: true as boolean,
  };
}

function buildLightColors(primary?: string | null, secondary?: string | null) {
  const brand = effectivePrimary(primary);
  const accent = effectiveAccent(primary, secondary);
  // Texte / icônes d'accent posés sur blanc : on fonce la couleur si elle est trop claire pour rester lisible.
  const accentText = luminance(accent) > 0.3 ? mix(accent, '#000000', 0.42) : mix(accent, '#000000', 0.12);
  const ink = '#111111';
  const POS = '#1B8A4B';
  return {
    // couleur de marque
    brume: PAGE_BG, forest: ink, leaf: accent, sun: brand,
    sunInk: inkOn(brand),
    sunSoft: mix(brand, '#FFFFFF', 0.88),
    sunLine: mix(brand, '#FFFFFF', 0.5),
    // surfaces : blanc pur partout
    bg: PAGE_BG,
    surface: '#FFFFFF',
    field: '#F2F2F2',
    sunken: '#F7F7F7',
    beige: '#F3F3F3',
    // texte
    ink,
    text: '#222222',
    muted: '#6B6B6B',
    faint: '#9A9A9A',
    // traits
    line: '#E8E8E8',
    lineStrong: '#D6D6D6',
    // accent de la société (liens, icônes, interrupteurs)
    accent,
    accentInk: inkOn(accent),
    accentSoft: mix(accent, '#FFFFFF', 0.9),
    accentLine: mix(accent, '#FFFFFF', 0.65),
    accentDeep: accentText,
    // sélection (chips actives, boutons sombres) = noir doux
    dark: ink,
    darkInk: '#FFFFFF',
    // sémantique
    pos: POS, posBg: '#E8F5ED', posLine: '#BFE5CD',
    danger: '#C62828', dangerBg: '#FDECEA', dangerLine: '#F5C6C2',
    warn: '#A86400', warnBg: '#FFF4DB', warnLine: '#F1D79A',
    info: '#1D5FD1', infoBg: '#E8F0FE', infoLine: '#C3D6FA',
    violet: '#6941C6', violetBg: '#F4EDFF',
    white: '#FFFFFF',
    scrim: 'rgba(17,17,17,0.5)',
    isDark: false as boolean,
  };
}

export type UIColors = ReturnType<typeof buildLightColors>;

/** Rayons : champs 14 (md), cartes 20 (lg), boutons et pastilles = pilule. */
export const R = { xs: 8, sm: 12, md: 14, lg: 20, xl: 28, pill: 999 } as const;

const SHADOW_RGB = '0,0,0';
export const S: Record<'none' | 'sm' | 'md' | 'lg', ViewStyle> = {
  none: {},
  sm: Platform.select<ViewStyle>({
    web: { boxShadow: `0 1px 2px rgba(${SHADOW_RGB},0.05)` } as any,
    default: { shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  }) as ViewStyle,
  md: Platform.select<ViewStyle>({
    web: { boxShadow: `0 8px 24px rgba(${SHADOW_RGB},0.07)` } as any,
    default: { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 4 },
  }) as ViewStyle,
  lg: Platform.select<ViewStyle>({
    web: { boxShadow: `0 16px 40px rgba(${SHADOW_RGB},0.12)` } as any,
    default: { shadowColor: '#000000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.16, shadowRadius: 40, elevation: 10 },
  }) as ViewStyle,
};

/** Police d'interface (nom logique résolu en Manrope au poids demandé — voir fonts.ts). */
export const SYSTEM_FONT = SANS;
/** Police d'accent (Fraunces) : salutation, titres d'écran, noms de villes. */
export const SERIF_FONT = SERIF;

export type TextVariant =
  | 'display' | 'hero' | 'title' | 'heading' | 'subheading' | 'body' | 'bodyStrong'
  | 'caption' | 'label' | 'overline' | 'button';

/** Échelle de la maquette « Envoyer de l'argent » : titre 28 gras, libellé 16 normal, valeur 24 gras, bouton 18 semi-gras. */
export const T: Record<TextVariant, TextStyle> = {
  display:    { fontFamily: SANS, fontSize: 46, lineHeight: 52, fontWeight: '800', letterSpacing: -1.5 },
  hero:       { fontFamily: SANS, fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.6 },
  title:      { fontFamily: SANS, fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.4 },
  heading:    { fontFamily: SANS, fontSize: 19, lineHeight: 25, fontWeight: '700', letterSpacing: -0.2 },
  subheading: { fontFamily: SANS, fontSize: 17, lineHeight: 23, fontWeight: '600', letterSpacing: -0.1 },
  body:       { fontFamily: SANS, fontSize: 16, lineHeight: 23, fontWeight: '400' },
  bodyStrong: { fontFamily: SANS, fontSize: 16, lineHeight: 23, fontWeight: '600' },
  caption:    { fontFamily: SANS, fontSize: 14, lineHeight: 19, fontWeight: '400' },
  label:      { fontFamily: SANS, fontSize: 13, lineHeight: 17, fontWeight: '600', letterSpacing: 0 },
  overline:   { fontFamily: SANS, fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0 },
  button:     { fontFamily: SANS, fontSize: 18, lineHeight: 23, fontWeight: '600', letterSpacing: -0.1 },
};

/** Espace à réserver en bas des écrans pour la barre d'onglets (80 + marge). */
export const TAB_SPACE = 104;

export function useUI() {
  const { branding } = useTenant();
  // garde les anciens écrans (brand()/themed()) synchronisés pendant la migration
  setBrandPrimary(effectivePrimary(branding.primaryColor));
  // useTheme() : le composant se redessine au changement de thème clair / sombre.
  const { scheme } = useTheme();
  const C = useMemo(() => buildColors(branding.primaryColor, branding.secondaryColor, scheme), [branding.primaryColor, branding.secondaryColor, scheme]);
  return {
    C, R, S, T, scheme, isDark: scheme === 'dark',
    accent: C.accent,
    accentInk: C.accentInk,
    brandName: branding.name,
    logoUrl: branding.logoUrl,
    tagline: branding.tagline,
  };
}
