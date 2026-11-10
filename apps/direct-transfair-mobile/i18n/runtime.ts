// apps/direct-transfair-mobile/i18n/runtime.ts
// =========================================================
// LANGUE COURANTE hors composants (services, alertes, intercepteur d'API) + formats de dates et de nombres.
// Les composants passent par useI18n() (providers/I18nProvider.tsx), qui tient ce module à jour.
// =========================================================

import { CATALOG, type MessageKey } from './catalog';
import { detectDeviceLang, infoOf, translateWith, type Lang, type Params } from './core';

let current: Lang = detectDeviceLang();
const listeners = new Set<(l: Lang) => void>();

export const getLang = (): Lang => current;
export const getLocale = (): string => infoOf(current).locale;

export function setRuntimeLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  listeners.forEach((fn) => fn(lang));
}
export function onLangChange(fn: (l: Lang) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Traduit dans la langue courante (usage hors composants). */
export function tr(key: MessageKey, params?: Params): string {
  return translateWith(CATALOG, current, key, params);
}

// ── Formats : toujours dans la langue choisie, avec un repli sûr (Intl absent ou valeur invalide) ──
export function fmtDate(value: string | number | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }): string {
  if (value === null || value === undefined || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  try { return d.toLocaleDateString(getLocale(), opts); } catch { return d.toISOString().slice(0, 10); }
}
export function fmtDateTime(value: string | number | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }): string {
  if (value === null || value === undefined || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  try { return d.toLocaleString(getLocale(), opts); } catch { return d.toISOString(); }
}
export function fmtNumber(n: number, opts?: Intl.NumberFormatOptions): string {
  if (!Number.isFinite(n)) return '—';
  try { return new Intl.NumberFormat(getLocale(), opts).format(n); } catch { return String(n); }
}

export function fmtTime(value: string | number | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }): string {
  if (value === null || value === undefined || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  try { return d.toLocaleTimeString(getLocale(), opts); } catch { return d.toISOString().slice(11, 16); }
}

/**
 * Table de libellés « paresseuse » : `LABELS[clé]` donne le texte dans la langue COURANTE à chaque lecture.
 * Remplace une constante `{ PENDING: "En attente", … }` sans changer les lectures `LABELS[status]`.
 */
export function lazyLabels<K extends string>(keys: Record<K, MessageKey>): Record<K, string> {
  const out = {} as Record<K, string>;
  (Object.keys(keys) as K[]).forEach((k) => {
    Object.defineProperty(out, k, { enumerable: true, get: () => tr(keys[k]) });
  });
  return out;
}
