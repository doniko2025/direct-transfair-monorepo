// apps/backend/src/fee-schedule/countries.ts
// =========================================================
// Pays utilisables dans un barème de frais (code ISO alpha-2) et normalisation d'un pays saisi à la main.
// Même liste que le web-admin (src/lib/countries.ts).
//
// Un bénéficiaire porte son pays en texte libre (« GN », « Guinée », « guinee »…) :
// toIso2() le ramène à un code, ou null si on ne sait pas — dans ce cas seules les règles « tous les
// pays » peuvent s'appliquer, jamais une règle de pays au hasard.
// =========================================================

export const FEE_COUNTRIES: Readonly<Record<string, string>> = {
  GN: 'Guinée',
  SN: 'Sénégal',
  CI: "Côte d'Ivoire",
  ML: 'Mali',
  BF: 'Burkina Faso',
  BJ: 'Bénin',
  TG: 'Togo',
  NE: 'Niger',
  GW: 'Guinée-Bissau',
  FR: 'France',
  DE: 'Allemagne',
  BE: 'Belgique',
  ES: 'Espagne',
  IT: 'Italie',
  PT: 'Portugal',
  NL: 'Pays-Bas',
  LU: 'Luxembourg',
  IE: 'Irlande',
  GB: 'Royaume-Uni',
  US: 'États-Unis',
};

export const FEE_COUNTRY_CODES: readonly string[] = Object.keys(FEE_COUNTRIES);

const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();

const BY_NAME: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [code, name] of Object.entries(FEE_COUNTRIES)) m[fold(name)] = code;
  // Variantes courantes de saisie.
  Object.assign(m, {
    'guinee conakry': 'GN',
    'guinea': 'GN',
    'senegal': 'SN',
    'cote divoire': 'CI',
    'ivory coast': 'CI',
    'burkina': 'BF',
    'benin': 'BJ',
    'guinee bissau': 'GW',
    'germany': 'DE',
    'belgium': 'BE',
    'spain': 'ES',
    'italy': 'IT',
    'netherlands': 'NL',
    'ireland': 'IE',
    'uk': 'GB',
    'united kingdom': 'GB',
    'angleterre': 'GB',
    'usa': 'US',
    'united states': 'US',
    'etats unis': 'US',
  });
  return m;
})();

export function toIso2(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    const upperCode = trimmed.toUpperCase();
    const code = upperCode === 'UK' ? 'GB' : upperCode; // « UK » n'est pas un code ISO mais tout le monde l'écrit
    return code in FEE_COUNTRIES ? code : null;
  }
  return BY_NAME[fold(trimmed)] ?? null;
}
