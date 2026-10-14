// apps/direct-transfair-mobile/components/wallet/brand.ts
// =========================================================
// MARQUE DYNAMIQUE v1.0 — Direct Transf'air
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Rend « white-label » les écrans qui portent encore une palette verte
// écrite en dur, SANS réécrire leur logique :
//   • brand("#059669")      → même couleur, teinte (hue) alignée sur la
//                             couleur de marque du tenant. Avec la marque
//                             par défaut (#059669), la couleur est renvoyée
//                             STRICTEMENT identique (aucun changement visuel).
//   • brandRgba("rgba(…)")  → idem pour les rgba().
//   • themed(() => ({…}))   → palette / StyleSheet évalués paresseusement :
//                             recalculés quand la marque change.
// La marque est synchronisée par useWalletTheme() (TenantProvider).
// Aucune couleur n'est donc figée : chaque société voit SA couleur.
// =========================================================

export const DEFAULT_BRAND = '#059669';

let primary = DEFAULT_BRAND;
let version = 0;

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}

const REF = rgbToHsl(...(parseHex(DEFAULT_BRAND) as [number, number, number]));

function shiftOf(): { dh: number; ks: number } | null {
  if (primary.toLowerCase() === DEFAULT_BRAND) return null;
  const rgb = parseHex(primary);
  if (!rgb) return null;
  const [h, s] = rgbToHsl(...rgb);
  const ks = Math.min(1.2, Math.max(0.15, s / REF[1]));
  return { dh: h - REF[0], ks };
}

function shiftRgb(r: number, g: number, b: number): [number, number, number] {
  const sh = shiftOf();
  if (!sh) return [r, g, b];
  const [h, s, l] = rgbToHsl(r, g, b);
  return hslToRgb(h + sh.dh, Math.min(1, s * sh.ks), l);
}

/** Couleur « verte de marque » → même couleur, teinte de la marque du tenant. */
export function brand(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const sh = shiftOf();
  if (!sh) return hex;
  const [r, g, b] = shiftRgb(...rgb);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** rgba(r,g,b,a) « vert de marque » → même transparence, teinte de la marque. */
export function brandRgba(value: string): string {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(value.trim());
  if (!m || !shiftOf()) return value;
  const [r, g, b] = shiftRgb(+m[1], +m[2], +m[3]);
  return m[4] === undefined ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${m[4]})`;
}

/** Appelé par useWalletTheme() : synchronise la marque courante. */
export function setBrandPrimary(next?: string | null): void {
  const v = next && /^#[0-9A-Fa-f]{6}$/.test(next) ? next.toLowerCase() : DEFAULT_BRAND;
  if (v !== primary) { primary = v; version++; }
}

export function getBrandPrimary(): string { return primary; }

/**
 * Objet évalué paresseusement et recalculé quand la marque change.
 * Usage : const s = themed(() => StyleSheet.create({ … }));
 *         const C = themed(() => ({ green: brand("#059669"), … }));
 */
export function themed<T extends object>(factory: () => T): T {
  let cache: T | null = null;
  let seen = -1;
  const get = (): T => {
    if (cache === null || seen !== version) { cache = factory(); seen = version; }
    return cache;
  };
  return new Proxy({} as T, {
    get: (_t, k) => (get() as any)[k],
    has: (_t, k) => k in get(),
    ownKeys: () => Reflect.ownKeys(get()),
    getOwnPropertyDescriptor: (_t, k) => ({ enumerable: true, configurable: true, value: (get() as any)[k] }),
  });
}
