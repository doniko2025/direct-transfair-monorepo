// apps/direct-transfair-mobile/components/ui/fonts.ts
// =========================================================
// POLICES v1.0 — Direct Transf'air (design « Corridor »)
// Manrope  : interface, chiffres, montants (400 → 800).
// Fraunces : salutation, titres d'écran, noms de villes (700, 600 italique).
// Les TTF sont embarqués dans assets/fonts (aucune dépendance réseau, aucun nouveau paquet).
// Sur Android et le web, une famille = un poids : on choisit donc la bonne famille
// d'après le `fontWeight` demandé et on retire `fontWeight` du style (sinon faux gras).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

/** Noms « logiques » utilisables dans les styles (résolus vers la vraie famille par resolveFont). */
export const SANS = 'Manrope';
export const SERIF = 'Fraunces';

export const FONT_FILES = {
  Manrope_400Regular: require('../../assets/fonts/Manrope_400Regular.ttf'),
  Manrope_500Medium: require('../../assets/fonts/Manrope_500Medium.ttf'),
  Manrope_600SemiBold: require('../../assets/fonts/Manrope_600SemiBold.ttf'),
  Manrope_700Bold: require('../../assets/fonts/Manrope_700Bold.ttf'),
  Manrope_800ExtraBold: require('../../assets/fonts/Manrope_800ExtraBold.ttf'),
  Fraunces_600SemiBold: require('../../assets/fonts/Fraunces_600SemiBold.ttf'),
  Fraunces_600SemiBold_Italic: require('../../assets/fonts/Fraunces_600SemiBold_Italic.ttf'),
  Fraunces_700Bold: require('../../assets/fonts/Fraunces_700Bold.ttf'),
  Fraunces_700Bold_Italic: require('../../assets/fonts/Fraunces_700Bold_Italic.ttf'),
} as const;

const SERIF_NAMES = /fraunces|georgia|playfair|times/i;
const isSerif = (f?: string) => !!f && (SERIF_NAMES.test(f) || (/\bserif\b/i.test(f) && !/sans-serif/i.test(f)));

function weightOf(w: TextStyle['fontWeight']): number {
  if (w === 'bold') return 700;
  if (w === 'normal' || w == null) return 400;
  const n = parseInt(String(w), 10);
  return Number.isFinite(n) ? n : 400;
}

/** Famille réelle pour une famille « logique » + poids + italique. */
export function resolveFont(family: string | undefined, weight: TextStyle['fontWeight'], italic: boolean): string {
  const w = weightOf(weight);
  const wantsSerif = isSerif(family);
  if (wantsSerif) {
    if (w >= 700) return italic ? 'Fraunces_700Bold_Italic' : 'Fraunces_700Bold';
    return italic ? 'Fraunces_600SemiBold_Italic' : 'Fraunces_600SemiBold';
  }
  if (w >= 800) return 'Manrope_800ExtraBold';
  if (w >= 700) return 'Manrope_700Bold';
  if (w >= 600) return 'Manrope_600SemiBold';
  if (w >= 500) return 'Manrope_500Medium';
  return 'Manrope_400Regular';
}

/** Aplatit le style, choisit la bonne police, retire fontWeight/fontStyle (déjà portés par la famille). */
export function withFont(style: StyleProp<TextStyle>): TextStyle {
  const flat = (StyleSheet.flatten(style) || {}) as TextStyle;
  const italic = flat.fontStyle === 'italic';
  const { fontWeight, fontStyle, ...rest } = flat;
  return { ...rest, fontFamily: resolveFont(flat.fontFamily, fontWeight, italic) };
}
