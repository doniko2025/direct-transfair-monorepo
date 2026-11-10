// apps/direct-transfair-mobile/components/ui/themeMode.ts
// =========================================================
// THÈME CLAIR / SOMBRE — état et palettes neutres (v1.0)
//   • `Scheme`  : le thème réellement appliqué ('light' | 'dark') ;
//   • `ThemeMode` : le choix de la personne ('light' | 'dark' | 'auto' = suit le téléphone) ;
//   • getScheme()/setScheme() : état partagé, lu par les couleurs « vivantes » (N, buildColors) ;
//     un changement invalide aussi les styles `themed()` (voir wallet/brand.ts) qui se recalculent au rendu suivant.
//   • LIGHT_N / DARK_N : neutres et couleurs sémantiques des écrans d'authentification et wallet.
// Le fournisseur React qui pilote ces valeurs est providers/ThemeProvider.tsx.
// =========================================================

import { bumpThemeVersion } from '../wallet/brand';

export type Scheme = 'light' | 'dark';
export type ThemeMode = 'light' | 'dark' | 'auto';

let scheme: Scheme = 'light';

export function getScheme(): Scheme { return scheme; }

/** Change le thème appliqué. Sans effet si identique ; sinon invalide les styles `themed()`. */
export function setScheme(next: Scheme): void {
  if (next === scheme) return;
  scheme = next;
  bumpThemeVersion();
}

export const LIGHT_N = {
  page:      '#FFFFFF',
  surface:   '#FFFFFF',
  field:     '#F2F2F2',
  ink:       '#111111',
  inkSub:    '#333333',
  muted:     '#6B6B6B',
  faint:     '#9A9A9A',
  border:    '#E0E0E0',
  danger:    '#C62828',
  dangerBg:  '#FDECEA',
  dangerBd:  '#F5C6C2',
  warn:      '#A86400',
  warnBg:    '#FFF4DB',
  warnBd:    '#F1D79A',
  ok:        '#1B8A4B',
  okBg:      '#E8F5ED',
  okBd:      '#BFE3CD',
  white:     '#FFFFFF',
} as const;

export type Neutrals = { [K in keyof typeof LIGHT_N]: string };

/** Thème sombre : fond quasi noir légèrement bleuté, surfaces relevées, textes clairs, états à fort contraste. */
export const DARK_N: Neutrals = {
  page:      '#0D0F12',
  surface:   '#16191E',
  field:     '#1F232A',
  ink:       '#F4F5F7',
  inkSub:    '#D5D8DD',
  muted:     '#9CA3AF',
  faint:     '#8A93A1',
  border:    '#2B3038',
  danger:    '#FF7A7A',
  dangerBg:  '#3B1D1F',
  dangerBd:  '#6B2F33',
  warn:      '#F2B24C',
  warnBg:    '#3A2D12',
  warnBd:    '#6B5320',
  ok:        '#46D483',
  okBg:      '#12301F',
  okBd:      '#1F5A38',
  white:     '#FFFFFF',
};

export function neutralsOf(s: Scheme = scheme): Neutrals {
  return s === 'dark' ? DARK_N : LIGHT_N;
}
