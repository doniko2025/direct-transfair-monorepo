// apps/backend/src/compliance/official-parsers.ts
// =========================================================
// LECTEURS DES LISTES OFFICIELLES (lot 17b) — fonctions pures, sans réseau ni base.
//   • ONU  : « Consolidated List » du Conseil de sécurité (XML : INDIVIDUAL / ENTITY, FIRST_NAME…, *_ALIAS, REFERENCE_NUMBER).
//   • OFAC : SDN (sdn.csv sans en-tête + alt.csv des alias). Les navires et aéronefs sont ignorés.
//   • UE   : fichier « Financial Sanctions Files » XML 1.1 (sanctionEntity / nameAlias / birthdate / citizenship).
// Les lecteurs sont TOLÉRANTS (balises absentes, casse, entités) et ne lèvent jamais sur une fiche : une fiche illisible est sautée.
// La synchronisation, elle, refuse tout fichier qui donne zéro fiche ou s'effondre (voir official-lists.sync.ts).
// ⚠️ Écrits d'après les formats publiés ; pas encore éprouvés sur les fichiers réels (voir LISEZ-MOI-LISTES-OFFICIELLES.md).
// =========================================================

export type OfficialProvider = 'UN' | 'OFAC' | 'EU';
export const OFFICIAL_PROVIDERS: readonly OfficialProvider[] = ['UN', 'OFAC', 'EU'];

export interface OfficialEntryInput {
  provider: OfficialProvider;
  externalId: string;
  fullName: string;
  aliases: string[];
  country: string | null;
  birthYear: number | null;
  reference: string | null;
  programs: string[];
}

const MAX_ALIASES = 40;

// ── XML minimal ──────────────────────────────────────────

export interface XNode { name: string; attrs: Record<string, string>; text: string; children: XNode[] }

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

const TOKEN = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
const ATTR = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** Lit UN fragment XML (une racine) en arbre. Les noms de balises sont conservés tels quels ; voir `lc`. */
export function parseXml(xml: string): XNode {
  const root: XNode = { name: '#root', attrs: {}, text: '', children: [] };
  const stack: XNode[] = [root];
  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN.exec(xml)) !== null) {
    const top = stack[stack.length - 1] as XNode;
    if (m[1] !== undefined) top.text += m[1];
    else if (m[2] !== undefined) { if (stack.length > 1) stack.pop(); }
    else if (m[3] !== undefined) {
      const node: XNode = { name: m[3], attrs: {}, text: '', children: [] };
      const raw = m[4] ?? '';
      ATTR.lastIndex = 0;
      let a: RegExpExecArray | null;
      while ((a = ATTR.exec(raw)) !== null) node.attrs[(a[1] as string).toLowerCase()] = decodeEntities(a[2] ?? a[3] ?? '');
      top.children.push(node);
      if (m[5] !== '/') stack.push(node);
    } else if (m[6] !== undefined) top.text += decodeEntities(m[6]);
  }
  return root.children[0] ?? root;
}

const lc = (s: string) => s.toLowerCase();
const kids = (n: XNode, name: string): XNode[] => n.children.filter((c) => lc(c.name) === lc(name));
const kid = (n: XNode, name: string): XNode | undefined => kids(n, name)[0];
const txt = (n: XNode | undefined): string => (n ? n.text.trim().replace(/\s+/g, ' ') : '');
const txtOf = (n: XNode, name: string): string => txt(kid(n, name));

/** Extrait, un par un, les blocs `<tag …>…</tag>` d'un gros fichier sans construire l'arbre entier (mémoire maîtrisée). */
export function* xmlBlocks(xml: string, tag: string): Generator<string> {
  const open = new RegExp(`<${tag}(?=[\\s>/])`, 'gi');
  const closeTag = `</${tag}>`.toLowerCase();
  const lower = xml.toLowerCase();
  let m: RegExpExecArray | null;
  while ((m = open.exec(xml)) !== null) {
    const start = m.index;
    const head = xml.indexOf('>', start);
    if (head === -1) return;
    if (xml[head - 1] === '/') { yield xml.slice(start, head + 1); open.lastIndex = head + 1; continue; } // balise autofermante
    const end = lower.indexOf(closeTag, head);
    if (end === -1) return;
    yield xml.slice(start, end + closeTag.length);
    open.lastIndex = end + closeTag.length;
  }
}

// ── Utilitaires ──────────────────────────────────────────

const clean = (s: string): string => s.replace(/\s+/g, ' ').trim();
const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function uniqueAliases(fullName: string, aliases: string[]): string[] {
  const seen = new Set([norm(fullName)]);
  const out: string[] = [];
  for (const a of aliases.map(clean)) {
    const k = norm(a);
    if (!k || k.length < 3 || seen.has(k)) continue;
    seen.add(k);
    out.push(a.slice(0, 200));
    if (out.length >= MAX_ALIASES) break;
  }
  return out;
}

function yearFrom(raw: string | undefined | null): number | null {
  const m = String(raw ?? '').match(/(?:^|\D)(1[89]\d{2}|20\d{2})(?!\d)/);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1900 && y <= new Date().getFullYear() ? y : null;
}

const build = (e: OfficialEntryInput): OfficialEntryInput | null => {
  const fullName = clean(e.fullName).slice(0, 250);
  if (!e.externalId || norm(fullName).length < 3) return null;
  return { ...e, fullName, aliases: uniqueAliases(fullName, e.aliases), country: e.country ? clean(e.country).slice(0, 60) : null };
};

// ── ONU ──────────────────────────────────────────────────

export function parseUnXml(xml: string): OfficialEntryInput[] {
  const out: OfficialEntryInput[] = [];
  const handle = (block: string, kind: 'INDIVIDUAL' | 'ENTITY') => {
    try {
      const n = parseXml(block);
      const id = txtOf(n, 'DATAID') || txtOf(n, 'REFERENCE_NUMBER');
      const parts = kind === 'INDIVIDUAL' ? ['FIRST_NAME', 'SECOND_NAME', 'THIRD_NAME', 'FOURTH_NAME'].map((t) => txtOf(n, t)).filter((p) => p && lc(p) !== 'na') : [txtOf(n, 'FIRST_NAME')];
      const aliasTag = kind === 'INDIVIDUAL' ? 'INDIVIDUAL_ALIAS' : 'ENTITY_ALIAS';
      const aliases = kids(n, aliasTag).map((a) => txtOf(a, 'ALIAS_NAME')).filter(Boolean);
      let birthYear: number | null = null;
      for (const d of kids(n, 'INDIVIDUAL_DATE_OF_BIRTH')) {
        birthYear = yearFrom(txtOf(d, 'YEAR')) ?? yearFrom(txtOf(d, 'DATE')) ?? yearFrom(txtOf(d, 'FROM_YEAR'));
        if (birthYear) break;
      }
      const country = kids(n, 'NATIONALITY').map((x) => txtOf(x, 'VALUE')).find(Boolean)
        ?? kids(n, 'INDIVIDUAL_PLACE_OF_BIRTH').map((x) => txtOf(x, 'COUNTRY')).find(Boolean)
        ?? kids(n, 'ENTITY_ADDRESS').map((x) => txtOf(x, 'COUNTRY')).find(Boolean) ?? null;
      const e = build({
        provider: 'UN', externalId: id, fullName: parts.join(' '), aliases, country, birthYear,
        reference: txtOf(n, 'REFERENCE_NUMBER') || null, programs: [txtOf(n, 'UN_LIST_TYPE')].filter(Boolean),
      });
      if (e) out.push(e);
    } catch { /* fiche illisible : sautée */ }
  };
  for (const b of xmlBlocks(xml, 'INDIVIDUAL')) handle(b, 'INDIVIDUAL');
  for (const b of xmlBlocks(xml, 'ENTITY')) handle(b, 'ENTITY');
  return out;
}

// ── OFAC ─────────────────────────────────────────────────

/** CSV tolérant : guillemets, guillemets doublés, retours à la ligne dans un champ, CRLF, caractère de fin 0x1A. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/\u001a/g, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i] as string;
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || (row[0] ?? '') !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.length > 1 || (row[0] ?? '') !== '') rows.push(row);
  return rows;
}

const nil = (s: string | undefined): string => { const v = clean(s ?? ''); return v === '-0-' ? '' : v; };

/** « DUPONT, Jean Paul » → « Jean Paul DUPONT » ; une entité (sans virgule) reste telle quelle. */
export function ofacPersonName(raw: string): string {
  const v = clean(raw);
  const i = v.indexOf(',');
  if (i < 0) return v;
  const last = v.slice(0, i).trim();
  const first = v.slice(i + 1).trim();
  return first ? `${first} ${last}` : last;
}

export function parseOfacCsv(sdnCsv: string, altCsv = ''): OfficialEntryInput[] {
  const aliasesBy = new Map<string, string[]>();
  for (const r of parseCsv(altCsv)) {
    const id = nil(r[0]);
    const name = nil(r[3]);
    if (!id || !name) continue;
    (aliasesBy.get(id) ?? aliasesBy.set(id, []).get(id)!).push(name);
  }
  const out: OfficialEntryInput[] = [];
  for (const r of parseCsv(sdnCsv)) {
    try {
      const id = nil(r[0]);
      const type = nil(r[2]).toLowerCase();
      if (!id || !/^\d+$/.test(id) || type === 'vessel' || type === 'aircraft') continue;
      const person = type === 'individual';
      const remarks = nil(r[11]);
      const dob = remarks.match(/DOB\s+([^;]*)/i);
      const nat = remarks.match(/nationality\s+([A-Za-z' -]+?)(?:;|$)/i);
      const e = build({
        provider: 'OFAC', externalId: id,
        fullName: person ? ofacPersonName(nil(r[1])) : nil(r[1]),
        aliases: (aliasesBy.get(id) ?? []).map((a) => (person ? ofacPersonName(a) : a)),
        country: nat?.[1] ?? null, birthYear: yearFrom(dob?.[1]), reference: id,
        programs: nil(r[3]).split(/[\]\[;]+/).map((p) => p.trim()).filter(Boolean),
      });
      if (e) out.push(e);
    } catch { /* ligne illisible : sautée */ }
  }
  return out;
}

// ── Union européenne ─────────────────────────────────────

export function parseEuXml(xml: string): OfficialEntryInput[] {
  const out: OfficialEntryInput[] = [];
  for (const b of xmlBlocks(xml, 'sanctionEntity')) {
    try {
      const n = parseXml(b);
      const names = kids(n, 'nameAlias').map((a) => clean(a.attrs.wholename || [a.attrs.firstname, a.attrs.middlename, a.attrs.lastname].filter(Boolean).join(' '))).filter(Boolean);
      if (!names.length) continue;
      let birthYear: number | null = null;
      for (const d of kids(n, 'birthdate')) { birthYear = yearFrom(d.attrs.year) ?? yearFrom(d.attrs.birthdate); if (birthYear) break; }
      const country = kids(n, 'citizenship').map((c) => c.attrs.countryiso2code || c.attrs.countrydescription).find(Boolean) ?? null;
      const programs = kids(n, 'regulation').map((r) => r.attrs.programme).filter(Boolean) as string[];
      const e = build({
        provider: 'EU', externalId: n.attrs.logicalid ?? '', fullName: names[0] as string, aliases: names.slice(1),
        country, birthYear, reference: n.attrs.eureferencenumber || n.attrs.logicalid || null, programs: Array.from(new Set(programs)),
      });
      if (e) out.push(e);
    } catch { /* fiche illisible : sautée */ }
  }
  return out;
}
