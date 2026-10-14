// apps/direct-transfair-mobile/components/auth/authTheme.ts
// =========================================================
// THÈME DES ÉCRANS D'AUTHENTIFICATION v1.0 — Direct Transf'air
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Une seule source pour les couleurs, polices, rayons et ombres des
// écrans de connexion / inscription / mot de passe / vérification.
// La palette dérive de la couleur de marque du tenant (white-label) :
// chaque société garde son identité, la structure reste identique.
// =========================================================

import { Platform } from 'react-native';

export const DEFAULT_BRAND = '#059669';

// ─── Utilitaires couleur ─────────────────────────────────
function hexToRgb(hex: string): [number, number, number] | null {
  const c = hex.replace('#', '');
  if (c.length !== 6) return null;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return Number.isNaN(r + g + b) ? null : [r, g, b];
}
const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
}
export function darken(hex: string, f: number): string {
  const rgb = hexToRgb(hex);
  return rgb ? toHex(rgb[0] * (1 - f), rgb[1] * (1 - f), rgb[2] * (1 - f)) : hex;
}
export function lighten(hex: string, f: number): string {
  const rgb = hexToRgb(hex);
  return rgb
    ? toHex(rgb[0] + (255 - rgb[0]) * f, rgb[1] + (255 - rgb[1]) * f, rgb[2] + (255 - rgb[2]) * f)
    : hex;
}
/** Couleur avec transparence (#RRGGBB + alpha 0..1). */
export function alpha(hex: string, a: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

// ─── Palette dérivée de la marque ────────────────────────
export type AuthPalette = {
  /** Dégradé d'arrière-plan, du plus sombre au plus clair. */
  bg1: string; bg2: string; bg3: string;
  /** Couleur d'action (boutons) : assez foncée pour un texte blanc lisible. */
  action: string;
  /** Couleur d'accent (liens, focus, icônes). */
  accent: string;
  /** Teinte très claire pour les fonds d'icônes et de badges. */
  tint: string;
  tintBorder: string;
};

export function buildPalette(primary?: string | null): AuthPalette {
  const p = primary && /^#[0-9A-Fa-f]{6}$/.test(primary) ? primary : DEFAULT_BRAND;
  return {
    bg1: darken(p, 0.86),
    bg2: darken(p, 0.72),
    bg3: darken(p, 0.5),
    action: darken(p, 0.2),
    accent: darken(p, 0.1),
    tint: lighten(p, 0.9),
    tintBorder: lighten(p, 0.7),
  };
}

// ─── Couleurs neutres et sémantiques ─────────────────────
export const N = {
  page:      '#F3F6F5',
  surface:   '#FFFFFF',
  field:     '#F7FAF9',
  ink:       '#0B1F1A',
  inkSub:    '#42564F',
  muted:     '#7C8E88',
  border:    '#DAE3E0',
  danger:    '#B42318',
  dangerBg:  '#FEF3F2',
  dangerBd:  '#FECDCA',
  warn:      '#B54708',
  warnBg:    '#FFFAEB',
  warnBd:    '#FEDF89',
  ok:        '#067647',
  okBg:      '#ECFDF3',
  okBd:      '#ABEFC6',
  white:     '#FFFFFF',
} as const;

// ─── Typographie ─────────────────────────────────────────
export const FONT = {
  display: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }) as string,
  body:    Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui, sans-serif' }) as string,
  medium:  Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'system-ui, sans-serif' }) as string,
};

export const RADIUS = { sm: 10, md: 14, lg: 18, xl: 28 } as const;

/** Largeur maximale du contenu (web / tablette). */
export const MAX_WIDTH = 520;

export const SHADOW = {
  card: {
    shadowColor: '#06231C',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  button: {
    shadowColor: '#06231C',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
} as const;

/** Neutralise le contour bleu et le fond jaune d'autofill des navigateurs (web uniquement). */
export const WEB_INPUT_RESET: any =
  Platform.OS === 'web'
    ? { outlineStyle: 'none', outlineWidth: 0, WebkitBoxShadow: '0 0 0px 1000px #F7FAF9 inset', WebkitTextFillColor: '#0B1F1A' }
    : {};
