// apps/direct-transfair-mobile/i18n/core.ts
// =========================================================
// TRADUCTION — noyau (sans React) — FR / EN / PT
//
// • Les textes vivent dans i18n/messages/*.ts : une entrée = { fr, en, pt } côte à côte. Une langue oubliée = erreur TypeScript (tsc).
// • Variables : « Bonjour {name} ». Pluriel : « 1 opération|{count} opérations » (la règle de la langue choisit la forme).
// • Le français est la langue de secours (texte, puis clé) : un oubli ne casse jamais l'écran.
// =========================================================

export type Lang = 'fr' | 'en' | 'pt';
export const DEFAULT_LANG: Lang = 'fr';

export interface LangInfo {
  code: Lang;
  /** Nom dans sa propre langue. */
  label: string;
  /** Sigle affiché sur la pastille (« FR »). */
  short: string;
  flag: string;
  /** Étiquette BCP 47 pour les dates et les nombres. */
  locale: string;
}

export const LANGS: readonly LangInfo[] = [
  { code: 'fr', label: 'Français',  short: 'FR', flag: '🇫🇷', locale: 'fr-FR' },
  { code: 'en', label: 'English',   short: 'EN', flag: '🇬🇧', locale: 'en-GB' },
  { code: 'pt', label: 'Português', short: 'PT', flag: '🇵🇹', locale: 'pt-PT' },
];

export type Trio = { fr: string; en: string; pt: string };
export type Params = Record<string, string | number | null | undefined>;

export function infoOf(lang: Lang): LangInfo {
  return LANGS.find((l) => l.code === lang) ?? LANGS[0]!;
}

/** « pt-BR », « EN », « fr_FR »… → 'pt' | 'en' | 'fr' ; null si la langue n'est pas gérée. */
export function normalizeLang(v: string | null | undefined): Lang | null {
  const base = String(v ?? '').trim().toLowerCase().split(/[-_]/)[0];
  return base === 'fr' || base === 'en' || base === 'pt' ? base : null;
}

/** Langue du téléphone si elle est gérée, sinon le français. */
export function detectDeviceLang(): Lang {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale;
    return normalizeLang(loc) ?? DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

/** Remplace {variable} ; une variable absente reste visible (« {name} ») plutôt que de disparaître en silence. */
export function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = params[k];
    return v === undefined || v === null ? m : String(v);
  });
}

/** « singulier|pluriel » : choisit la forme d'après params.count et la règle de la langue. */
function pickPlural(text: string, lang: Lang, params?: Params): string {
  if (!text.includes('|')) return text;
  const [one, other] = text.split('|');
  const n = Number(params?.count);
  if (!Number.isFinite(n)) return other ?? one ?? text;
  let singular: boolean;
  try { singular = new Intl.PluralRules(infoOf(lang).locale).select(n) === 'one'; }
  catch { singular = n === 1; }
  return (singular ? one : other) ?? text;
}

export function translateWith(catalog: Record<string, Trio>, lang: Lang, key: string, params?: Params): string {
  const entry = catalog[key];
  if (!entry) return key; // clé inconnue : visible en test, jamais de plantage
  const raw = entry[lang] || entry.fr || key;
  return interpolate(pickPlural(raw, lang, params), params);
}
