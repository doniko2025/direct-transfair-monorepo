// apps/backend/src/i18n/phrase-book.ts
// =========================================================
// LIVRE DE PHRASES — traduit un texte français déjà écrit dans le code (message d'erreur, notification) vers l'anglais ou le portugais,
// sans toucher aux ~900 endroits qui le produisent.
//
//   [fr, en, pt]            une entrée = la phrase telle qu'elle est écrite dans le code, puis ses deux traductions ;
//   {1} {2} …               parties variables (montant, nom, référence…) : reprises telles quelles dans la traduction, dans l'ordre voulu.
//   « Vous avez envoyé {1} à {2}. »  ⇄  « You sent {1} to {2}. »
//
// Quand plusieurs entrées peuvent convenir, la plus précise (la plus longue en texte fixe) gagne. Une phrase inconnue est renvoyée telle quelle
// (en français) : un oubli ne casse rien. `listMissing()` / le script `pnpm i18n:missing` dressent la liste de ces oublis.
// =========================================================

import type { Lang } from './lang';

export type Phrase = readonly [fr: string, en: string, pt: string];

type Target = { en: string; pt: string };
type Pattern = Target & { re: RegExp; weight: number; fr: string };

const exact = new Map<string, Target>();
let patterns: Pattern[] = [];
let sorted = true;
const missing = new Set<string>();
const MISSING_LIMIT = 500;

const HAS_SLOT = /\{\d+\}/;
/** Séparateur des listes composées (« 15 000 XOF (2 paiements) · 12 EUR (1 paiement) »). */
const DOT_SEP = ' · ';
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clean = (s: string) => s.trim();

/** Ajoute des entrées au livre (appelé une fois par fichier de phrases, à l'import). */
export function registerPhrases(entries: readonly Phrase[]): void {
  for (const [fr, en, pt] of entries) {
    const key = clean(fr);
    if (!HAS_SLOT.test(key)) {
      exact.set(key, { en, pt });
      continue;
    }
    const parts = key.split(/\{\d+\}/);
    const re = new RegExp('^' + parts.map(escapeRe).join('([\\s\\S]+?)') + '$');
    patterns.push({ re, en, pt, weight: parts.join('').length, fr: key });
    sorted = false;
  }
}

/** Cherche une phrase connue (exacte ou à trous) sans rien enregistrer comme manquant ; null si inconnue. */
function lookup(text: string, lang: 'en' | 'pt'): string | null {
  const key = clean(text);
  const hit = exact.get(key);
  if (hit) return hit[lang];
  if (key.includes(DOT_SEP)) { const seg = translateSegments(key, lang, [DOT_SEP]); if (seg !== null) return seg; }
  if (!sorted) { patterns.sort((a, b) => b.weight - a.weight); sorted = true; }
  for (const p of patterns) {
    const m = p.re.exec(key);
    if (m) return fillWith(p[lang], m.slice(1), lang, 1);
  }
  return translateSegments(key, lang);
}

/** Remplit les {n}. Une partie variable qui est elle-même une phrase connue (« passeport », « jours »…) est traduite à son tour. */
function fillWith(template: string, caps: string[], lang: 'en' | 'pt', depth: number): string {
  return template.replace(/\{(\d+)\}/g, (_m, n: string) => {
    const cap = caps[Number(n) - 1] ?? '';
    return depth < 3 && cap ? (lookup(cap, lang) ?? cap) : cap;
  });
}

/** Traduit une phrase française ; le français (ou une phrase inconnue) est rendu tel quel. */
export function translatePhrase(text: string, lang: Lang): string {
  if (lang === 'fr' || typeof text !== 'string' || text.length === 0) return text;
  const key = clean(text);
  const hit = exact.get(key);
  if (hit) return hit[lang];

  if (!sorted) { patterns.sort((a, b) => b.weight - a.weight); sorted = true; }
  for (const p of patterns) {
    const m = p.re.exec(key);
    if (m) return fillWith(p[lang], m.slice(1), lang, 0);
  }
  // Texte composé (lignes ou « a · b ») : on traduit chaque segment connu, les autres restent tels quels.
  const seg = translateSegments(key, lang);
  if (seg !== null) return seg;
  if (missing.size < MISSING_LIMIT) missing.add(key);
  return text;
}

function translateSegments(key: string, lang: 'en' | 'pt', seps: string[] = ['\n', DOT_SEP]): string | null {
  for (const sep of seps) {
    if (!key.includes(sep)) continue;
    const parts = key.split(sep);
    let found = false;
    const out = parts.map((part) => {
      const hit = lookup(part, lang);
      if (hit !== null) found = true;
      return hit ?? part;
    });
    if (found) return out.join(sep);
  }
  return null;
}

/** Phrases rencontrées sans traduction depuis le démarrage (pour I18N_LOG_MISSING et les tests). */
export function listMissing(): string[] {
  return [...missing];
}
export function clearMissing(): void {
  missing.clear();
}

/** Vrai si cette phrase française a une traduction. */
export function hasPhrase(text: string): boolean {
  const key = clean(text);
  if (exact.has(key)) return true;
  return patterns.some((p) => p.re.test(key));
}

/** Toutes les entrées enregistrées (contrôle d'intégrité dans les tests). */
export function allEntries(): Array<{ fr: string } & Target> {
  return [
    ...[...exact.entries()].map(([fr, t]) => ({ fr, ...t })),
    ...patterns.map((p) => ({ fr: p.fr, en: p.en, pt: p.pt })),
  ];
}
