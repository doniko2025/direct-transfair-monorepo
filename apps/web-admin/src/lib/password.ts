// src/lib/password.ts
// Mot de passe temporaire pour l'administrateur d'une nouvelle société.
// Tirage cryptographique (crypto.getRandomValues), sans caractères ambigus
// (0/O, 1/l/I) pour pouvoir être dicté ou recopié sans erreur.
// Le tirage par rejet évite le biais du modulo.

const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%&*?';
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

function randomInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buf);
    value = buf[0] ?? 0;
  } while (value >= limit);
  return value % max;
}

function pick(set: string): string {
  return set.charAt(randomInt(set.length));
}

export function generateTempPassword(length = 14): string {
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(ALL));
  // Mélange de Fisher-Yates : les 4 premiers caractères ne restent pas à une place fixe.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    const tmp = chars[i] as string;
    chars[i] = chars[j] as string;
    chars[j] = tmp;
  }
  return chars.join('');
}
