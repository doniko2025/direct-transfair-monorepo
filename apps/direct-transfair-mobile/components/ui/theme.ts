// apps/direct-transfair-mobile/components/ui/theme.ts
// =========================================================
// DESIGN SYSTEM CLAIR v2.0 — Direct Transf'air (white-label)
// v2.0 : refonte totale en thème clair (fond crème, texte noir, accent = couleur de la société).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
//
// Une seule source pour tous les écrans mobiles :
//   • useUI()  → { C, R, S, T, accentInk, brandName, logoUrl }
//   • C        : couleurs (toutes dérivées de la couleur de marque du tenant — rien en dur par société)
//   • R        : rayons, S : ombres, T : styles de texte
// L'accent est la couleur primaire du tenant ; la couleur du texte posé dessus est calculée
// automatiquement (noir sur accent clair, blanc sur accent foncé).
// =========================================================

import { useMemo } from 'react';
import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import { useTenant } from '../../providers/TenantProvider';
import { setBrandPrimary } from '../wallet/brand';

export const DEFAULT_ACCENT = '#059669';

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

export function buildColors(primary?: string | null) {
  const accent = /^#[0-9a-f]{6}$/i.test(primary || '') ? (primary as string).toUpperCase() : DEFAULT_ACCENT;
  const ink = '#111214';
  return {
    // surfaces
    bg: '#FAF9F5',
    surface: '#FFFFFF',
    field: '#F2EFE8',
    sunken: '#F5F3EC',
    beige: '#EFEBE1',
    // texte
    ink,
    text: '#2A2B2E',
    muted: '#8B887F',
    faint: '#B9B6AD',
    // traits
    line: '#E9E6DF',
    lineStrong: '#D9D5CB',
    // accent de la société
    accent,
    accentInk: inkOn(accent),
    accentSoft: mix(accent, '#FFFFFF', 0.86),
    accentLine: mix(accent, '#FFFFFF', 0.6),
    accentDeep: mix(accent, '#000000', 0.35),
    // sélection (chips, tuile active) — noir comme sur les maquettes
    dark: ink,
    darkInk: '#FFFFFF',
    // sémantique
    pos: '#2E8B57', posBg: '#DFF3E6',
    danger: '#C62828', dangerBg: '#FDECEA', dangerLine: '#F5C6C2',
    warn: '#B26A00', warnBg: '#FFF4DB', warnLine: '#F1D79A',
    info: '#1D5FD1', infoBg: '#E8F0FE', infoLine: '#C3D6FA',
    violet: '#6941C6', violetBg: '#F4EDFF',
    white: '#FFFFFF',
    scrim: 'rgba(17,18,20,0.45)',
  };
}

export const R = { xs: 8, sm: 12, md: 16, lg: 24, xl: 32, pill: 999 } as const;

export const S: Record<'none' | 'sm' | 'md' | 'lg', ViewStyle> = {
  none: {},
  sm: Platform.select<ViewStyle>({
    web: { boxShadow: '0 1px 2px rgba(17,18,20,0.05)' } as any,
    default: { shadowColor: '#111214', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  }) as ViewStyle,
  md: Platform.select<ViewStyle>({
    web: { boxShadow: '0 6px 18px rgba(17,18,20,0.07)' } as any,
    default: { shadowColor: '#111214', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.07, shadowRadius: 18, elevation: 4 },
  }) as ViewStyle,
  lg: Platform.select<ViewStyle>({
    web: { boxShadow: '0 14px 36px rgba(17,18,20,0.12)' } as any,
    default: { shadowColor: '#111214', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.12, shadowRadius: 36, elevation: 10 },
  }) as ViewStyle,
};

/** Police : celle de la société si fournie (déjà chargée), sinon la police système. */
export const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }) as string;

export type TextVariant =
  | 'display' | 'hero' | 'title' | 'heading' | 'subheading' | 'body' | 'bodyStrong'
  | 'caption' | 'label' | 'overline' | 'button';

export const T: Record<TextVariant, TextStyle> = {
  display:    { fontSize: 44, lineHeight: 48, fontWeight: '800', letterSpacing: -1.5 },
  hero:       { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -1 },
  title:      { fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.6 },
  heading:    { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.3 },
  subheading: { fontSize: 16, lineHeight: 22, fontWeight: '700', letterSpacing: -0.15 },
  body:       { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  caption:    { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  label:      { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.1 },
  overline:   { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  button:     { fontSize: 16, lineHeight: 20, fontWeight: '700', letterSpacing: -0.1 },
};

/** Espace à réserver en bas des écrans pour la barre d'onglets. */
export const TAB_SPACE = 104;

export function useUI() {
  const { branding } = useTenant();
  // garde les anciens écrans (brand()/themed()) synchronisés pendant la migration
  setBrandPrimary(branding.primaryColor);
  const C = useMemo(() => buildColors(branding.primaryColor), [branding.primaryColor]);
  return {
    C, R, S, T,
    accent: C.accent,
    accentInk: C.accentInk,
    brandName: branding.name,
    logoUrl: branding.logoUrl,
    tagline: branding.tagline,
  };
}
