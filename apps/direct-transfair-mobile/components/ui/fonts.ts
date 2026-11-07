// apps/direct-transfair-mobile/components/ui/fonts.ts
// =========================================================
// POLICES v2.0 — Direct Transf'air (Lot 12)
// Une seule police partout : Inter (celle de la maquette « Envoyer de l'argent »), 400 → 800.
// Les TTF (sous-ensemble latin, ≈ 55 Ko chacun) sont embarqués dans assets/fonts : aucune dépendance réseau.
// Sur Android et le web, une famille = un poids : on choisit donc la bonne famille d'après le `fontWeight`
// demandé et on retire `fontWeight` du style (sinon faux gras).
// Les anciennes polices (Manrope, Fraunces) ne sont plus chargées : tout nom de police « serif », Georgia, Fraunces ou
// Manrope demandé par un écran est résolu vers Inter, sans changer ces écrans.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

/** Noms « logiques » utilisables dans les styles (résolus vers la vraie famille par resolveFont). */
export const SANS = 'Inter';
export const SERIF = 'Inter';

export const FONT_FILES = {
  Inter_400Regular: require('../../assets/fonts/Inter_400Regular.ttf'),
  Inter_500Medium: require('../../assets/fonts/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('../../assets/fonts/Inter_600SemiBold.ttf'),
  Inter_700Bold: require('../../assets/fonts/Inter_700Bold.ttf'),
  Inter_800ExtraBold: require('../../assets/fonts/Inter_800ExtraBold.ttf'),
} as const;

function weightOf(w: TextStyle['fontWeight']): number {
  if (w === 'bold') return 700;
  if (w === 'normal' || w == null) return 400;
  const n = parseInt(String(w), 10);
  return Number.isFinite(n) ? n : 400;
}

/** Famille réelle pour un poids (l'italique n'existe pas dans le design : le texte reste droit). */
export function resolveFont(_family: string | undefined, weight: TextStyle['fontWeight'], _italic = false): string {
  const w = weightOf(weight);
  if (w >= 800) return 'Inter_800ExtraBold';
  if (w >= 700) return 'Inter_700Bold';
  if (w >= 600) return 'Inter_600SemiBold';
  if (w >= 500) return 'Inter_500Medium';
  return 'Inter_400Regular';
}

/** Aplatit le style, choisit la bonne police, retire fontWeight/fontStyle (déjà portés par la famille). */
export function withFont(style: StyleProp<TextStyle>): TextStyle {
  const flat = (StyleSheet.flatten(style) || {}) as TextStyle;
  const { fontWeight, fontStyle, ...rest } = flat;
  return { ...rest, fontFamily: resolveFont(flat.fontFamily, fontWeight) };
}
