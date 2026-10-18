// apps/direct-transfair-mobile/components/auth/authTheme.ts
// ✅ v2.1 : (web) texte d'exemple des champs plus foncé que prévu — voir WEB_INPUT_RESET.
// =========================================================
// THÈME DES ÉCRANS D'AUTHENTIFICATION v2.0 — Direct Transf'air
// ✅ v2.0 : THÈME CLAIR (refonte totale) — neutres chauds (fond crème #FAF9F5, champs sable, encre
//    quasi noire), police système (plus de Georgia), rayons plus généreux, ombres légères.
//    Les noms d'exports sont inchangés : tous les écrans et composants qui l'utilisent passent
//    automatiquement au thème clair. buildPalette() garde action/accent/tint dérivés de la marque.
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
  page:      '#FAF9F5',
  surface:   '#FFFFFF',
  field:     '#F2EFE8',
  ink:       '#111214',
  inkSub:    '#4A4945',
  muted:     '#8B887F',
  border:    '#E3DFD5',
  danger:    '#C62828',
  dangerBg:  '#FDECEA',
  dangerBd:  '#F5C6C2',
  warn:      '#B26A00',
  warnBg:    '#FFF4DB',
  warnBd:    '#F1D79A',
  ok:        '#2E8B57',
  okBg:      '#DFF3E6',
  okBd:      '#BFE5CD',
  white:     '#FFFFFF',
} as const;

// ─── Typographie ─────────────────────────────────────────
export const FONT = {
  display: Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }) as string,
  body:    Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui, sans-serif' }) as string,
  medium:  Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'system-ui, sans-serif' }) as string,
};

export const RADIUS = { sm: 12, md: 16, lg: 20, xl: 32 } as const;

/** Largeur maximale du contenu (web / tablette). */
export const MAX_WIDTH = 520;

export const SHADOW = {
  card: {
    shadowColor: '#111214',
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  button: {
    shadowColor: '#111214',
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;

/**
 * Neutralise le contour bleu et le fond jaune d'autofill des navigateurs (web uniquement).
 * v2.1 : `WebkitTextFillColor` retiré — il forçait le texte d'exemple (placeholder) à la couleur de la saisie
 * (les champs vides paraissaient déjà remplis).
 */
export const WEB_INPUT_RESET: any =
  Platform.OS === 'web'
    ? { outlineStyle: 'none', outlineWidth: 0, WebkitBoxShadow: '0 0 0px 1000px #F2EFE8 inset' }
    : {};
