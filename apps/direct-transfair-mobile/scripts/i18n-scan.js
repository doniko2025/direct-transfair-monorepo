#!/usr/bin/env node
// apps/direct-transfair-mobile/scripts/i18n-scan.js — liste les textes français encore « en dur » dans les écrans mobiles.
// Usage : node scripts/i18n-scan.js [fichier|dossier ...] [--count]   (défaut : app components)
// Un texte est signalé s'il est dans un littéral / texte JSX / gabarit, ressemble à du français (espace, accent ou majuscule initiale)
// et n'est ni un import, ni une clé d'objet, ni un attribut technique (testID, name, icon, style…).
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const countOnly = args.includes('--count');
const targets = args.filter((a) => !a.startsWith('--'));
if (!targets.length) targets.push('app', 'components');

const SKIP_ATTR = new Set(['testID', 'name', 'icon', 'iconRight', 'kind', 'tone', 'variant', 'v', 'key', 'id', 'type', 'size', 'color', 'href', 'pathname', 'source', 'resizeMode', 'behavior', 'keyboardType', 'autoCapitalize', 'autoComplete', 'textContentType', 'accessibilityRole', 'importantForAccessibility', 'fontWeight', 'flexDirection', 'alignItems', 'justifyContent', 'position', 'textAlign', 'overflow', 'borderStyle']);
const ADMIN = /(agent|admin|cashier|caissier-agence|CompanyDashboard|SuperAdmin|CreateCompany|AgentDashboard)/i;

function walk(p, out) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    if (/node_modules|\.expo|dist/.test(p)) return;
    for (const f of fs.readdirSync(p)) walk(path.join(p, f), out);
  } else if (/\.(tsx?|jsx?)$/.test(p) && !/\.d\.ts$|\.spec\./.test(p)) out.push(p);
}

const looksFrench = (s) => {
  const t = s.trim();
  if (t.length < 3) return false;
  if (/^[a-z0-9_.\-/:#@%{}\[\]()$ ]+$/.test(t) && !/[ ]/.test(t)) return false; // identifiants, chemins
  if (/^(https?:|\/|#|[A-Z0-9_]+$|[a-z]+(-[a-z]+)+$)/.test(t)) return false;
  if (!/[A-Za-zÀ-ÿ]{3,}/.test(t)) return false;
  return /[À-ÿ’]/.test(t) || /\s/.test(t) || /^[A-ZÀ-Ý]/.test(t);
};

const files = [];
targets.forEach((t) => walk(t, files));
const perFile = {};
let total = 0;

for (const file of files.sort()) {
  if (ADMIN.test(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const hits = [];
  const push = (node, text) => {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!looksFrench(clean)) return;
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
    hits.push(`${line + 1}: ${clean.slice(0, 110)}`);
  };
  const visit = (n) => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n) || ts.isTypeNode(n) || ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) return;
    // appels tr('…') / t('…') : déjà traduits
    if (ts.isCallExpression(n) && /^(tr|t|useT)$/.test(n.expression.getText())) return;
    if (ts.isJsxAttribute(n) && SKIP_ATTR.has(n.name.getText())) return;
    if (ts.isPropertyAssignment(n) && n.name && /^(style|testID|icon|name|tone|kind|key|color|backgroundColor|fontFamily|type)$/.test(n.name.getText())) return;
    if (ts.isJsxText(n)) push(n, n.getText());
    else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const parent = n.parent;
      if (ts.isPropertyAssignment(parent) && parent.name === n) { /* clé */ }
      else if (ts.isElementAccessExpression(parent) || ts.isLiteralTypeNode(parent)) { /* indexation / type */ }
      else if (ts.isCallExpression(parent) && /^(require|import|AsyncStorage\.\w+|console\.\w+|logger\.\w+)$/.test(parent.expression.getText())) { /* technique */ }
      else if (ts.isBinaryExpression(parent) && /(===|!==|==|!=)/.test(parent.operatorToken.getText())) { /* comparaison */ }
      else if (ts.isCaseClause(parent)) { /* case */ }
      else push(n, n.text);
    } else if (ts.isTemplateExpression(n)) {
      push(n, n.head.text + n.templateSpans.map((s) => '{…}' + s.literal.text).join(''));
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (hits.length) { perFile[file] = hits; total += hits.length; }
}

if (countOnly) {
  Object.entries(perFile).sort((a, b) => b[1].length - a[1].length).forEach(([f, h]) => console.log(String(h.length).padStart(4), f));
  console.log(String(total).padStart(4), 'TOTAL');
} else {
  Object.entries(perFile).forEach(([f, h]) => { console.log(`\n== ${f}`); h.forEach((x) => console.log('  ' + x)); });
}
