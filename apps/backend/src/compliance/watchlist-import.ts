// apps/backend/src/compliance/watchlist-import.ts
// =========================================================
// IMPORT EN MASSE D'UNE LISTE (lot 17) — fonction pure.
// Une ligne par personne : « Nom complet ; alias1 | alias2 ; pays ; année de naissance ; référence »
// (séparateur « ; » ou tabulation ; seul le nom est obligatoire). Les lignes vides et celles qui commencent par # sont ignorées.
// =========================================================

export interface ParsedEntry {
  fullName: string;
  aliases: string[];
  country: string | null;
  birthYear: number | null;
  reference: string | null;
}

export interface ParseResult {
  entries: ParsedEntry[];
  errors: Array<{ line: number; message: string }>;
}

export const MAX_IMPORT_LINES = 1000;

export function parseWatchlistLines(text: string): ParseResult {
  const entries: ParsedEntry[] = [];
  const errors: ParseResult['errors'] = [];
  const lines = String(text ?? '').split(/\r?\n/);
  const seen = new Set<string>();
  let counted = 0;

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    counted++;
    if (counted > MAX_IMPORT_LINES) {
      if (counted === MAX_IMPORT_LINES + 1) errors.push({ line: i + 1, message: `Import limité à ${MAX_IMPORT_LINES} lignes : le reste est ignoré.` });
      return;
    }
    const cols = line.split(/;|\t/).map((c) => c.trim());
    const fullName = cols[0] ?? '';
    if (fullName.length < 3) { errors.push({ line: i + 1, message: 'Nom trop court.' }); return; }
    if (fullName.length > 160) { errors.push({ line: i + 1, message: 'Nom trop long (160 caractères au plus).' }); return; }
    const aliases = (cols[1] ?? '').split('|').map((a) => a.trim()).filter((a) => a.length >= 3 && a.length <= 160).slice(0, 20);
    const country = (cols[2] ?? '').slice(0, 60) || null;
    const yearRaw = cols[3] ?? '';
    let birthYear: number | null = null;
    if (yearRaw) {
      const y = Number(yearRaw);
      if (!Number.isInteger(y) || y < 1900 || y > new Date().getFullYear()) { errors.push({ line: i + 1, message: `Année de naissance invalide : ${yearRaw}.` }); return; }
      birthYear = y;
    }
    const reference = (cols[4] ?? '').slice(0, 80) || null;
    const key = fullName.toLowerCase();
    if (seen.has(key)) { errors.push({ line: i + 1, message: `Doublon dans le fichier : ${fullName}.` }); return; }
    seen.add(key);
    entries.push({ fullName, aliases, country, birthYear, reference });
  });
  return { entries, errors };
}
