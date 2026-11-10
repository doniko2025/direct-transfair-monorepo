#!/usr/bin/env node
// apps/backend/scripts/i18n-scan.js
// =========================================================
// RECENSE LES TEXTES FRANÇAIS DU SERVEUR (messages d'erreur + notifications) ET DIT LESQUELS N'ONT PAS DE TRADUCTION.
//   node scripts/i18n-scan.js            → liste des textes sans traduction EN/PT (code retour 0)
//   node scripts/i18n-scan.js --all      → tous les textes trouvés
//   node scripts/i18n-scan.js --json     → sortie JSON (outillage)
//   node scripts/i18n-scan.js --strict   → code retour 1 s'il en manque (CI)
//   node scripts/i18n-scan.js --dir=auth → un seul dossier de src/
// Les parties variables (${…}) deviennent {1}, {2}… comme dans src/i18n/phrases/*.ts.
// =========================================================
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const EXC = /new\s+(BadRequestException|NotFoundException|ForbiddenException|ConflictException|UnauthorizedException|UnprocessableEntityException|ServiceUnavailableException|TooManyRequestsException|PayloadTooLargeException|HttpException)\s*\(/g;
const NOTIF = /(?:notificationsService|notifications|this\.notifications|notification)\.(?:create|createMany)\s*\(/g;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'generated' && e.name !== 'node_modules') walk(p, out); }
    else if (p.endsWith('.ts') && !p.endsWith('.spec.ts') && !p.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** Lit l'expression de `start` (juste après « ( ») jusqu'à la virgule ou la parenthèse fermante de niveau 0. */
function readArg(src, start) {
  let depth = 0, i = start, quote = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (quote === '`' && c === '$' && src[i + 1] === '{') { // saute ${ … } (imbriqué)
        let d = 1; i += 2;
        while (i < src.length && d > 0) { if (src[i] === '{') d++; else if (src[i] === '}') d--; if (d > 0) i++; }
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { if (depth === 0) break; depth--; }
    else if (c === ',' && depth === 0) break;
  }
  return { text: src.slice(start, i), end: i };
}

/** Transforme une expression « 'a' + `b ${x}` » en motif « ab {1} » ; null si ce n'est pas un texte simple. */
function toPattern(expr) {
  let e = expr.trim();
  while (e.startsWith('(') && e.endsWith(')')) e = e.slice(1, -1).trim();
  const parts = []; let i = 0, n = 0, dynamic = false;
  while (i < e.length) {
    const c = e[i];
    if (/\s/.test(c) || c === '+') { i++; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1, s = '';
      while (j < e.length && e[j] !== c) { if (e[j] === '\\') { s += e[j + 1] === 'n' ? '\n' : e[j + 1]; j += 2; } else s += e[j++]; }
      parts.push(s); i = j + 1; continue;
    }
    if (c === '`') {
      let j = i + 1, s = '';
      while (j < e.length && e[j] !== '`') {
        if (e[j] === '\\') { s += e[j + 1] === 'n' ? '\n' : e[j + 1]; j += 2; }
        else if (e[j] === '$' && e[j + 1] === '{') {
          let d = 1, k = j + 2;
          while (k < e.length && d > 0) { if (e[k] === '{') d++; else if (e[k] === '}') d--; if (d > 0) k++; }
          const inner = e.slice(j + 2, k);
          if (/`|'|"/.test(inner)) dynamic = true; // suffixe conditionnel : à traiter à la main
          s += `{${++n}}`; j = k + 1;
        } else s += e[j++];
      }
      parts.push(s); i = j + 1; continue;
    }
    // identifiant / appel / ternaire : variable → {n}
    let j = i, d = 0;
    while (j < e.length && !(d === 0 && e[j] === '+')) { if ('([{'.includes(e[j])) d++; else if (')]}'.includes(e[j])) d--; j++; }
    if (/\?/.test(e.slice(i, j))) dynamic = true;
    parts.push(`{${++n}}`); i = j;
  }
  const text = parts.join('');
  if (!/[A-Za-zÀ-ÿ]{3,}/.test(text.replace(/\{\d+\}/g, ''))) return null;
  return { text, dynamic };
}

function lineOf(src, idx) { return src.slice(0, idx).split('\n').length; }

function scanFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const found = [];
  for (let m; (m = EXC.exec(src));) {
    const { text } = readArg(src, m.index + m[0].length);
    const p = toPattern(text); if (p) found.push({ file, line: lineOf(src, m.index), kind: 'error', ...p });
  }
  for (let m; (m = NOTIF.exec(src));) {
    // create(userId, title, message, …) : on lit les 3 premiers arguments ; createMany({ data: … }) : on cherche title: / message:
    let pos = m.index + m[0].length;
    const args = [];
    for (let k = 0; k < 3; k++) { const a = readArg(src, pos); args.push(a.text); pos = a.end + 1; }
    for (const a of args.slice(1)) { const p = toPattern(a); if (p) found.push({ file, line: lineOf(src, m.index), kind: 'notif', ...p }); }
    const block = readArg(src, m.index + m[0].length).text;
    for (const key of ['title', 'message', 'body']) {
      const re = new RegExp(`\\b${key}\\s*:\\s*`, 'g');
      for (let k; (k = re.exec(block));) {
        const a = readArg(block, k.index + k[0].length); const p = toPattern(a.text);
        if (p) found.push({ file, line: lineOf(src, m.index), kind: 'notif', ...p });
      }
    }
  }
  return found;
}

module.exports = { scanFile, walk, toPattern, SRC };

if (require.main === module) {
  const args = process.argv.slice(2);
  const dirArg = (args.find((a) => a.startsWith('--dir=')) || '').slice(6);
  const files = walk(dirArg ? path.join(SRC, dirArg) : SRC);
  const all = files.flatMap(scanFile);
  const seen = new Map();
  for (const f of all) { const k = f.text.trim(); if (!seen.has(k)) seen.set(k, f); }
  let list = [...seen.values()];
  if (!args.includes('--all')) {
    require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });
    const { hasPhrase } = require('../src/i18n/phrase-book');
    require('../src/i18n/phrases');
    list = list.filter((f) => !hasPhrase(f.text));
  }
  if (args.includes('--json')) console.log(JSON.stringify(list, null, 1));
  else {
    for (const f of list) console.log(`${path.relative(SRC, f.file)}:${f.line}  [${f.kind}${f.dynamic ? ',variante' : ''}]  ${JSON.stringify(f.text)}`);
    console.error(`\n${list.length} texte(s) ${args.includes('--all') ? 'trouvé(s)' : 'sans traduction'} — ${seen.size} textes distincts au total.`);
  }
  if (args.includes('--strict') && list.length) process.exit(1);
}
