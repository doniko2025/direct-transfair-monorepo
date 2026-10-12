// src/lib/colors.ts

/** Accepte #RGB ou #RRGGBB, renvoie #RRGGBB en minuscules, ou null si invalide. */
export function parseHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  const short = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(v);
  if (short) {
    const [, r, g, b] = short;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Luminance relative WCAG (0 = noir, 1 = blanc). */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Couleur de texte lisible (blanc ou encre foncée) sur le fond donné. */
export function readableOn(hex: string): string {
  return luminance(hex) > 0.4 ? '#14221e' : '#ffffff';
}
