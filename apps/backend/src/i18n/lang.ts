// apps/backend/src/i18n/lang.ts
// =========================================================
// LANGUES DE L'APPLICATION MOBILE (FR / EN / PT) — côté serveur
// • Le français reste la langue du code et du back-office web : une requête sans en-tête `x-app-lang` est servie en français, comme avant.
// • L'application mobile envoie `x-app-lang: fr|en|pt` à chaque requête. On n'utilise PAS `Accept-Language` : les navigateurs l'envoient tout seuls
//   (« en-US,en »), ce qui traduirait par surprise les écrans web restés en français.
// • Les emails, SMS et notifications poussées (sans requête) suivent la langue enregistrée sur le compte (User.preferredLanguage).
// =========================================================

export type Lang = 'fr' | 'en' | 'pt';
export const LANGS: readonly Lang[] = ['fr', 'en', 'pt'];
export const DEFAULT_LANG: Lang = 'fr';
export const LANG_HEADER = 'x-app-lang';

/** « pt-BR », « EN », « fr_FR »… → 'pt' | 'en' | 'fr' ; null si la langue n'est pas gérée. */
export function normalizeLang(v: unknown): Lang | null {
  if (typeof v !== 'string') return null;
  const base = v.trim().toLowerCase().split(/[-_]/)[0];
  return base === 'fr' || base === 'en' || base === 'pt' ? base : null;
}

/** Langue demandée par l'application (en-tête `x-app-lang`), ou null si la requête ne la précise pas. */
export function langFromRequest(req: { headers?: Record<string, unknown> } | null | undefined): Lang | null {
  const raw = req?.headers?.[LANG_HEADER];
  return normalizeLang(Array.isArray(raw) ? raw[0] : raw);
}

/** Langue à utiliser quand il n'y a pas de requête (email, SMS, push) : celle du compte, sinon le français. */
export function langOfUser(user: { preferredLanguage?: string | null } | null | undefined): Lang {
  return normalizeLang(user?.preferredLanguage) ?? DEFAULT_LANG;
}
