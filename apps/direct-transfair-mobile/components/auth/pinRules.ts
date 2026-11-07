// apps/direct-transfair-mobile/components/auth/pinRules.ts
// =========================================================
// CODE SECRET À 6 CHIFFRES — règle de robustesse (lot 10) — Direct Transf'air
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ⚠️ Le bloc entre BEGIN et END est la COPIE EXACTE de apps/backend/src/common/pin-policy.ts : le serveur applique toujours la
// règle, ce bloc ne sert qu'à prévenir l'utilisateur AVANT l'envoi. Un test du backend (pin-policy.spec.ts) vérifie qu'ils restent
// identiques : ne modifiez jamais un seul des deux fichiers.
// =========================================================

// ─── BEGIN PIN POLICY ───────────────────────────────────
export const PIN_LENGTH = 6;

export type PinIssue =
  | 'NOT_SIX_DIGITS'
  | 'ALL_SAME'
  | 'SEQUENCE'
  | 'PARTIAL_SEQUENCE'
  | 'REPEATED_PATTERN'
  | 'PAIRS'
  | 'MIRROR'
  | 'FEW_DIGITS'
  | 'LONG_RUN'
  | 'COMMON'
  | 'DATE'
  | 'BIRTHDATE'
  | 'PHONE';

export interface PinContext {
  /** Date de naissance du client : « 1990-05-12 », « 12/05/1990 », « 12-05-1990 » ou « 12.05.1990 ». */
  birthDate?: string | null;
  /** Numéro de téléphone du client, avec ou sans indicatif. */
  phone?: string | null;
  /** Année courante (pour les tests). */
  now?: Date;
}

export const PIN_ISSUE_MESSAGE: Record<PinIssue, string> = {
  NOT_SIX_DIGITS: 'Le code doit contenir exactement 6 chiffres.',
  ALL_SAME: 'Évitez les chiffres identiques (ex. 000000).',
  SEQUENCE: 'Évitez les chiffres qui se suivent (ex. 123456).',
  PARTIAL_SEQUENCE: 'Évitez 4 chiffres qui se suivent (ex. 1234).',
  REPEATED_PATTERN: 'Évitez les motifs répétés (ex. 121212 ou 123123).',
  PAIRS: 'Évitez les chiffres doublés (ex. 112233).',
  MIRROR: 'Évitez les codes symétriques (ex. 123321).',
  FEW_DIGITS: 'Utilisez au moins 3 chiffres différents.',
  LONG_RUN: 'Évitez 4 chiffres identiques à la suite.',
  COMMON: 'Ce code est trop courant. Choisissez-en un moins prévisible.',
  DATE: 'Évitez une date (naissance, anniversaire…).',
  BIRTHDATE: 'Évitez votre date de naissance.',
  PHONE: 'Évitez un morceau de votre numéro de téléphone.',
};

const COMMON_PINS: ReadonlySet<string> = new Set([
  '123456', '654321', '111111', '000000', '121212', '112233', '123123', '123321', '666666', '696969', '159753', '147258',
  '258369', '789456', '456789', '123789', '987654', '102030', '010203', '101010', '202020', '200000', '100000', '520520',
  '521521', '131313', '142536', '112358', '246810', '135791', '987123', '123654', '789123', '321654', '741852', '852963',
  '963852', '951753', '357159', '147369', '369147', '159357', '753951', '555555', '777777', '888888', '999999', '222222',
  '333333', '444444', '007007', '191919', '212121', '232323', '343434', '454545', '565656', '676767', '787878', '898989',
  '246824', '135135', '246246', '369369', '258258', '147147', '159159', '357357', '951951', '753753',
]);

function digitsOf(v: string | null | undefined): string {
  return String(v ?? '').replace(/\D/g, '');
}

/** Pas constant (+1 ou -1 modulo 10) entre tous les chiffres : 123456, 654321, 890123. */
function stepsOf(pin: string): number[] {
  const steps: number[] = [];
  for (let i = 1; i < pin.length; i++) steps.push((Number(pin[i]) - Number(pin[i - 1]) + 10) % 10);
  return steps;
}

function hasRunOfSteps(pin: string, size: number): boolean {
  const steps = stepsOf(pin);
  for (const wanted of [1, 9]) {
    let run = 0;
    for (const s of steps) {
      run = s === wanted ? run + 1 : 0;
      if (run >= size - 1) return true;
    }
  }
  return false;
}

function isValidDate(day: number, month: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
  return day <= max;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Cette suite de 6 chiffres se lit-elle comme une date de 1930 à aujourd'hui ? */
function looksLikeDate(pin: string, currentYear: number): boolean {
  const n = (from: number, to: number) => Number(pin.slice(from, to));
  const yearOf2 = (yy: number): number[] => [1900 + yy, 2000 + yy].filter((y) => y >= 1930 && y <= currentYear);
  const plausible = (yy: number) => yearOf2(yy).length > 0;

  // JJMMAA · MMJJAA · AAMMJJ
  if (isValidDate(n(0, 2), n(2, 4)) && plausible(n(4, 6))) return true;
  if (isValidDate(n(2, 4), n(0, 2)) && plausible(n(4, 6))) return true;
  if (isValidDate(n(4, 6), n(2, 4)) && plausible(n(0, 2))) return true;
  // MMAAAA · AAAAMM
  const y1 = n(2, 6);
  const m1 = n(0, 2);
  if (m1 >= 1 && m1 <= 12 && y1 >= 1930 && y1 <= currentYear) return true;
  const y2 = n(0, 4);
  const m2 = n(4, 6);
  if (m2 >= 1 && m2 <= 12 && y2 >= 1930 && y2 <= currentYear) return true;
  return false;
}

function parseBirthDate(raw: string | null | undefined): { y: string; m: string; d: string } | null {
  const s = String(raw ?? '').trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return { y: m[1]!, m: pad2(Number(m[2])), d: pad2(Number(m[3])) };
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s);
  if (m) return { y: m[3]!, m: pad2(Number(m[2])), d: pad2(Number(m[1])) };
  return null;
}

function birthDateForms(raw: string | null | undefined): Set<string> {
  const b = parseBirthDate(raw);
  const out = new Set<string>();
  if (!b) return out;
  const yy = b.y.slice(2);
  const parts = [b.d, b.m, yy];
  const perms = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
  ];
  for (const p of perms) out.add(p.map((i) => parts[i]).join(''));
  out.add(b.m + b.y);
  out.add(b.y + b.m);
  out.add(b.d + b.m + b.y.slice(0, 2));
  out.add(b.y.slice(2) + b.y.slice(0, 2) + b.d.slice(0, 2));
  return out;
}

function phoneContains(pin: string, phone: string | null | undefined): boolean {
  const digits = digitsOf(phone);
  if (digits.length < PIN_LENGTH) return false;
  for (let i = 0; i + PIN_LENGTH <= digits.length; i++) {
    if (digits.slice(i, i + PIN_LENGTH) === pin) return true;
  }
  return false;
}

/** Liste de tout ce qui ne va pas dans ce code (vide = code accepté). */
export function pinIssues(pin: string, ctx: PinContext = {}): PinIssue[] {
  if (!/^\d{6}$/.test(pin)) return ['NOT_SIX_DIGITS'];
  const issues: PinIssue[] = [];
  const currentYear = (ctx.now ?? new Date()).getFullYear();

  const distinct = new Set(pin.split('')).size;
  if (distinct === 1) issues.push('ALL_SAME');
  else if (distinct <= 2) issues.push('FEW_DIGITS');

  const steps = stepsOf(pin);
  if (steps.every((s) => s === steps[0] && (s === 1 || s === 9))) issues.push('SEQUENCE');
  else if (hasRunOfSteps(pin, 4)) issues.push('PARTIAL_SEQUENCE');

  if (/(\d)\1{3}/.test(pin)) issues.push('LONG_RUN');

  for (const size of [1, 2, 3]) {
    const unit = pin.slice(0, size);
    if (unit.repeat(PIN_LENGTH / size) === pin && !issues.includes('ALL_SAME')) {
      issues.push('REPEATED_PATTERN');
      break;
    }
  }
  if (pin[0] === pin[1] && pin[2] === pin[3] && pin[4] === pin[5] && !issues.includes('ALL_SAME')) issues.push('PAIRS');
  if (pin === pin.split('').reverse().join('') && !issues.includes('ALL_SAME')) issues.push('MIRROR');
  if (COMMON_PINS.has(pin)) issues.push('COMMON');

  if (birthDateForms(ctx.birthDate).has(pin)) issues.push('BIRTHDATE');
  else if (looksLikeDate(pin, currentYear)) issues.push('DATE');
  if (phoneContains(pin, ctx.phone)) issues.push('PHONE');

  return issues;
}

export function isPinAcceptable(pin: string, ctx: PinContext = {}): boolean {
  return pinIssues(pin, ctx).length === 0;
}
// ─── END PIN POLICY ─────────────────────────────────────

/** Texte du premier problème trouvé, ou null si le code est accepté. */
export function pinProblem(pin: string, ctx: PinContext = {}): string | null {
  const issues = pinIssues(pin, ctx);
  return issues.length === 0 ? null : PIN_ISSUE_MESSAGE[issues[0]!];
}

/** Garde uniquement les chiffres, au plus 6 (collage, saisie automatique). */
export function sanitizePin(text: string): string {
  return text.replace(/\D/g, '').slice(0, PIN_LENGTH);
}

export type PinStrength = { level: 0 | 1 | 2 | 3; label: string; problem: string | null };

/** Retour visuel pendant la saisie : 0 = vide, 1 = refusé, 2 = en cours, 3 = accepté. */
export function pinStrength(pin: string, ctx: PinContext = {}): PinStrength {
  if (pin.length === 0) return { level: 0, label: '', problem: null };
  if (pin.length < PIN_LENGTH) return { level: 2, label: `${pin.length}/${PIN_LENGTH} chiffres`, problem: null };
  const problem = pinProblem(pin, ctx);
  return problem ? { level: 1, label: 'Trop prévisible', problem } : { level: 3, label: 'Code solide', problem: null };
}
