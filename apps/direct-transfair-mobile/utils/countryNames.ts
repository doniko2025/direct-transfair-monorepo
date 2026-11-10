// apps/direct-transfair-mobile/utils/countryNames.ts
// Nom d'un pays dans la langue de l'application. Les listes de pays du code (data/countries.ts…) sont en français et le serveur
// garde ce nom français : seul l'AFFICHAGE est traduit (Intl.DisplayNames). Sans prise en charge, le nom français est conservé.
import { getLang } from "../i18n/runtime";
import { countriesList } from "../data/countries";

const cache = new Map<string, any>();

function displayNames(lang: string): any | null {
  if (cache.has(lang)) return cache.get(lang);
  let dn: any = null;
  try {
    const Ctor = (Intl as any).DisplayNames;
    if (typeof Ctor === "function") dn = new Ctor([lang === "pt" ? "pt-PT" : lang], { type: "region" });
  } catch { dn = null; }
  cache.set(lang, dn);
  return dn;
}

/** Code pays ISO (« GN ») + nom français de repli → « Guinea » / « Guiné ». */
export function countryName(code: string | null | undefined, frName: string): string {
  const lang = getLang();
  if (lang === "fr" || !code) return frName;
  try { return displayNames(lang)?.of(String(code).toUpperCase()) ?? frName; }
  catch { return frName; }
}

/** Nom français enregistré par le serveur (« Guinée ») → nom dans la langue courante. Inconnu : rendu tel quel. */
export function localizeCountry(frName: string | null | undefined): string {
  if (!frName) return "";
  if (getLang() === "fr") return frName;
  const c = countriesList.find((x) => x.name === frName);
  return c ? countryName(c.code, frName) : frName;
}
