// apps/backend/src/compliance/name-matching.ts
// =========================================================
// RAPPROCHEMENT DE NOMS (lot 17) — fonctions pures, sans base de données.
//   • normalisation : accents, casse, ponctuation, tirets, apostrophes ;
//   • ordre des mots indifférent (« Diallo Mamadou » = « Mamadou Diallo ») ;
//   • fautes de frappe et translittérations proches (« Mohamed » ≈ « Mohammed ») grâce à Jaro-Winkler ;
//   • un nom d'UN SEUL mot dans une liste ne correspond qu'à un nom d'un seul mot : « Diallo » seul ne doit pas faire
//     sonner l'alarme pour chaque Diallo (nom très répandu en Afrique de l'Ouest).
// Le score va de 0 à 100. Les seuils sont réglés par la société.
// =========================================================

export function normalizeName(raw: string): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`´-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return a.length === 0 ? 0 : 1;
  if (!a.length || !b.length) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatch = new Array<boolean>(a.length).fill(false);
  const bMatch = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const from = Math.max(0, i - range);
    const to = Math.min(b.length - 1, i + range);
    for (let j = from; j <= to; j++) {
      if (bMatch[j] || a[i] !== b[j]) continue;
      aMatch[i] = true;
      bMatch[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatch[i]) continue;
    while (!bMatch[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const m = matches;
  const jaro = (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

const tokens = (normalized: string): string[] => (normalized ? normalized.split(' ') : []);

/** Ressemblance de deux noms, de 0 à 100. */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  const ta = tokens(na);
  const tb = tokens(nb);
  if (ta.length === 1 || tb.length === 1) {
    // Un mot contre un mot seulement : « Diallo » ne doit pas correspondre à « Mamadou Diallo ».
    return ta.length === tb.length ? Math.round(jaroWinkler(na, nb) * 100) : 0;
  }

  const sortedA = [...ta].sort().join(' ');
  const sortedB = [...tb].sort().join(' ');
  const whole = jaroWinkler(sortedA, sortedB);

  // Chaque mot du nom le plus court doit retrouver son meilleur équivalent dans l'autre (deuxièmes prénoms tolérés).
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const used = new Set<number>();
  let sum = 0;
  let weakest = 1;
  for (const t of short) {
    let best = 0;
    let bestIdx = -1;
    long.forEach((u, i) => {
      if (used.has(i)) return;
      const s = jaroWinkler(t, u);
      if (s > best) { best = s; bestIdx = i; }
    });
    if (bestIdx >= 0) used.add(bestIdx);
    sum += best;
    weakest = Math.min(weakest, best);
  }
  const aligned = sum / short.length;
  // Le mot le moins ressemblant tire le score vers le bas : « Mamadou Diallo » ≠ « Mamadou Bah ».
  const covered = aligned * 0.6 + weakest * 0.4;
  // Un nom plus long qui contient tout le plus court est un peu moins sûr qu'un nom identique.
  const extra = long.length - short.length;
  const penalty = Math.min(0.08, extra * 0.04);
  return Math.round(Math.max(whole, covered - penalty) * 100);
}

export interface WatchlistLike {
  id: string;
  kind: string;
  fullName: string;
  aliases: string[];
  country?: string | null;
  reference?: string | null;
  /** Origine d'une fiche de liste officielle (UN, OFAC, EU) ; absent pour une fiche saisie par la société. */
  source?: string | null;
}

export interface NameSubject {
  /** SENDER | RECIPIENT | BENEFICIARY | COUNTER_CUSTOMER — sert à expliquer la correspondance. */
  role: string;
  name: string;
}

export interface NameMatch {
  entryId: string;
  kind: string;
  entryName: string;
  matchedOn: string;
  reference: string | null;
  source: string | null;
  subjectRole: string;
  subjectName: string;
  score: number;
}

function matchEntry(s: NameSubject, e: WatchlistLike, threshold: number): NameMatch | null {
  let best: { score: number; on: string } | null = null;
  for (const candidate of [e.fullName, ...(e.aliases ?? [])]) {
    const score = nameSimilarity(s.name, candidate);
    if (!best || score > best.score) best = { score, on: candidate };
  }
  if (!best || best.score < threshold) return null;
  return {
    entryId: e.id, kind: e.kind, entryName: e.fullName, matchedOn: best.on, reference: e.reference ?? null, source: e.source ?? null,
    subjectRole: s.role, subjectName: s.name, score: best.score,
  };
}

/** Toutes les correspondances égales ou supérieures au seuil, la plus forte d'abord (une seule ligne par fiche et par personne). */
export function findMatches(subjects: NameSubject[], entries: WatchlistLike[], threshold: number): NameMatch[] {
  const out: NameMatch[] = [];
  for (const s of subjects) {
    if (!normalizeName(s.name)) continue;
    for (const e of entries) {
      const m = matchEntry(s, e, threshold);
      if (m) out.push(m);
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

// ── Index pour les grandes listes (ONU ≈ 1 000 fiches, OFAC ≈ 17 000) ────────────────────────────────────────────────
// Comparer un nom à 17 000 fiches une par une serait trop lent pour chaque envoi. L'index ne retient que les fiches qui
// partagent avec le nom cherché le DÉBUT ou la FIN (3 lettres) d'au moins un mot : une faute de frappe au milieu d'un mot
// (« Mohamed » / « Mohammed ») ou à l'autre extrémité ne fait donc pas manquer la fiche. Seules ces candidates sont ensuite notées.

const keysOf = (token: string): string[] => (token.length <= 3 ? [token] : [token.slice(0, 3), `~${token.slice(-3)}`]);

export class NameIndex {
  private readonly byKey = new Map<string, number[]>();
  private readonly entries: WatchlistLike[];

  constructor(entries: WatchlistLike[]) {
    this.entries = entries;
    entries.forEach((e, i) => {
      const seen = new Set<string>();
      for (const name of [e.fullName, ...(e.aliases ?? [])]) {
        for (const t of tokens(normalizeName(name))) for (const k of keysOf(t)) seen.add(k);
      }
      for (const k of seen) {
        const list = this.byKey.get(k);
        if (list) list.push(i); else this.byKey.set(k, [i]);
      }
    });
  }

  get size(): number { return this.entries.length; }

  query(subjects: NameSubject[], threshold: number): NameMatch[] {
    const out: NameMatch[] = [];
    for (const s of subjects) {
      const toks = tokens(normalizeName(s.name));
      if (!toks.length) continue;
      const candidates = new Set<number>();
      for (const t of toks) for (const k of keysOf(t)) for (const i of this.byKey.get(k) ?? []) candidates.add(i);
      for (const i of candidates) {
        const m = matchEntry(s, this.entries[i] as WatchlistLike, threshold);
        if (m) out.push(m);
      }
    }
    return out.sort((x, y) => y.score - x.score);
  }
}
