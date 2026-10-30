// apps/backend/src/common/utils/phone-repair.ts
// =========================================================
// RÉPARATION DES INDICATIFS RÉPÉTÉS — Direct Transf'air
//
// Des numéros ont été enregistrés avec l'indicatif pays DEUX ou TROIS fois :
//   « +221221776676677 », « +224+224622123456 », « +224224224622123456 ».
// (un écran de l'app préfixait l'indicatif sans vérifier qu'il était déjà là — voir mobile utils/phone.ts.)
//
// Cette fonction PURE (aucun accès base) décide, pour un numéro stocké :
//   • ok      — rien à réparer ;
//   • fixed   — indicatif répété retiré, résultat sûr : « +<indicatif><numéro national> » ;
//   • suspect — indicatif peut-être répété, mais la longueur ne permet pas de trancher : À VÉRIFIER À LA MAIN, jamais modifié.
//
// PRUDENCE : un numéro n'est réparé que si (1) son pays a une règle de longueur connue, (2) il est TROP LONG pour ce pays tel quel
// et (3) il devient de la bonne longueur une fois l'indicatif répété retiré. Un numéro national qui commence légitimement par les
// mêmes chiffres que l'indicatif (ex. « +33 33… ») garde sa longueur correcte : il n'est donc jamais touché.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

/** Longueur du numéro national (hors indicatif, hors 0 de tête) — mêmes plages que mobile/data/phoneRules.ts. */
const RULES: Record<string, { min: number; max: number }> = {
  '224': { min: 9, max: 9 },   // Guinée
  '221': { min: 9, max: 9 },   // Sénégal
  '223': { min: 8, max: 8 },   // Mali
  '225': { min: 10, max: 10 }, // Côte d'Ivoire
  '226': { min: 8, max: 8 },   // Burkina Faso
  '229': { min: 10, max: 10 }, // Bénin
  '228': { min: 8, max: 8 },   // Togo
  '227': { min: 8, max: 8 },   // Niger
  '245': { min: 7, max: 9 },   // Guinée-Bissau
  '33':  { min: 9, max: 10 },  // France
  '49':  { min: 9, max: 11 },  // Allemagne
  '32':  { min: 8, max: 9 },   // Belgique
  '39':  { min: 8, max: 11 },  // Italie
  '34':  { min: 9, max: 9 },   // Espagne
  '351': { min: 9, max: 9 },   // Portugal
  '31':  { min: 9, max: 9 },   // Pays-Bas
  '43':  { min: 7, max: 13 },  // Autriche
  '358': { min: 8, max: 10 },  // Finlande
  '353': { min: 7, max: 9 },   // Irlande
  '352': { min: 6, max: 9 },   // Luxembourg
  '30':  { min: 10, max: 10 }, // Grèce
  '44':  { min: 9, max: 10 },  // Royaume-Uni
  '1':   { min: 10, max: 10 }, // USA / Canada
  '503': { min: 8, max: 8 },   // Salvador
};

/** Indicatifs reconnus (pays de l'app + ceux qui ont une règle). Sans règle de longueur : les cas répétés sont seulement signalés. */
const DIAL_CODES: string[] = Array.from(new Set([
  ...Object.keys(RULES),
  '41', '86', '212', '213', '216', '220', '222', '231', '232', '237', '244', '971',
])).sort((a, b) => b.length - a.length || (a < b ? -1 : 1)); // les plus longs d'abord

/** Plus petit numéro national plausible : on ne retire jamais un indicatif s'il ne reste pas au moins ça. */
const MIN_NATIONAL = 6;

export type DialRepairResult =
  | { status: 'ok' }
  | { status: 'fixed'; dial: string; before: string; after: string; removed: number }
  | { status: 'suspect'; dial: string; before: string; reason: string };

export function repairDoubledDialCode(raw: string | null | undefined): DialRepairResult {
  const before = (raw ?? '').trim();
  if (!before) return { status: 'ok' };

  let digits = before.replace(/\D/g, '');
  if (!before.startsWith('+') && digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length < 8) return { status: 'ok' };

  const dial = DIAL_CODES.find((d) => digits.startsWith(d));
  if (!dial) return { status: 'ok' };

  let rest = digits.slice(dial.length);
  if (!rest.startsWith(dial)) return { status: 'ok' }; // pas d'indicatif répété

  const rule = RULES[dial];

  // Pays sans règle de longueur : on ne devine pas, on signale.
  if (!rule) {
    return rest.length - dial.length >= MIN_NATIONAL
      ? { status: 'suspect', dial, before, reason: `indicatif +${dial} peut-être répété (aucune règle de longueur pour ce pays)` }
      : { status: 'ok' };
  }

  const fits = (n: number) => n >= rule.min && n <= rule.max;
  if (fits(rest.length)) return { status: 'ok' }; // longueur correcte : le numéro national commence légitimement par les chiffres de l'indicatif

  let removed = 0;
  while (rest.startsWith(dial) && !fits(rest.length) && rest.length - dial.length >= MIN_NATIONAL) {
    rest = rest.slice(dial.length);
    removed++;
  }

  if (removed > 0 && fits(rest.length)) {
    return { status: 'fixed', dial, before, after: `+${dial}${rest}`, removed };
  }
  return { status: 'suspect', dial, before, reason: `indicatif +${dial} répété mais la longueur reste inattendue (${rest.length} chiffres)` };
}
