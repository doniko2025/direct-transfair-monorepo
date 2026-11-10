// apps/backend/src/i18n/html.ts
// =========================================================
// TRADUCTION D'UN COURRIEL HTML — chaque morceau de texte (entre deux balises) est traduit avec le livre de phrases ;
// la mise en page, les couleurs, les liens et les valeurs variables (noms, montants, codes) ne bougent pas.
//   <p>Bonjour <strong>Awa</strong>,</p>  →  <p>Hello <strong>Awa</strong>,</p>
// Un morceau inconnu reste en français : un oubli n'abîme jamais un courriel.
// =========================================================

import type { Lang } from './lang';
import { translatePhrase } from './phrase-book';

const TEXT_NODE = />([^<>]+)</g;

export function translateHtml(html: string, lang: Lang): string {
  if (lang === 'fr' || !html) return html;
  return html.replace(TEXT_NODE, (whole, text: string) => {
    const core = text.replace(/\s+/g, ' ').trim();
    if (!core) return whole;
    const translated = translatePhrase(core, lang);
    if (translated === core) return whole;
    const lead = /^\s/.test(text) ? ' ' : '';
    const tail = /\s$/.test(text) ? ' ' : '';
    return `>${lead}${translated}${tail}<`;
  });
}
