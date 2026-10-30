// apps/backend/scripts/repair-doubled-dial-codes.ts
// =========================================================
// RÉPARATION — Indicatifs pays répétés dans les numéros déjà enregistrés
// =========================================================
//
// CONTEXTE :
//   Avant le correctif de l'app mobile (utils/phone.ts), plusieurs écrans préfixaient l'indicatif sans vérifier qu'il était déjà
//   présent : des numéros ont été enregistrés « +221221776676677 », « +224+224622123456 », « +224224224622123456 »…
//   Ce script les ramène à « +<indicatif><numéro national> » (ex. « +221776676677 »).
//
// CHAMPS TRAITÉS :
//   • Beneficiary.phone
//   • Beneficiary.mobileMoneyNumber
//   • User.phone  (contrainte @unique : si le numéro réparé appartient déjà à un autre compte, la ligne est SIGNALÉE, jamais modifiée)
//
// SÉCURITÉ :
//   • SIMULATION par défaut : rien n'est écrit tant que vous ne passez pas --apply.
//   • Règle prudente (src/common/utils/phone-repair.ts) : un numéro n'est réparé que si son pays a une règle de longueur connue, que le numéro
//     est TROP LONG tel quel et qu'il devient de la bonne longueur une fois l'indicatif répété retiré. Les cas douteux sont listés « À VÉRIFIER »
//     et ne sont jamais modifiés.
//   • --apply écrit d'abord un fichier de sauvegarde JSON (avant / après de chaque ligne), puis modifie ligne par ligne, uniquement si la valeur en
//     base est toujours celle qui a été lue (aucun écrasement d'une modification faite entre-temps).
//   • Idempotent : relancer le script ne change plus rien.
//   • --rollback=<fichier> remet les anciennes valeurs (uniquement pour les lignes encore à la valeur « après »).
//
// UTILISATION (depuis apps/backend, avec DATABASE_URL pointant vers la bonne base) :
//   npx ts-node scripts/repair-doubled-dial-codes.ts                      → simulation, affiche ce qui serait changé
//   npx ts-node scripts/repair-doubled-dial-codes.ts --apply              → applique (écrit d'abord la sauvegarde)
//   npx ts-node scripts/repair-doubled-dial-codes.ts --rollback=repair-doubled-dial-codes.<date>.backup.json
//
// RECOMMANDÉ : exécuter d'abord sur une copie de la base (ou après un instantané/backup de la base de production).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import { repairDoubledDialCode } from '../src/common/utils/phone-repair';

const prisma = new PrismaClient();

type Target = { model: 'beneficiary' | 'user'; field: 'phone' | 'mobileMoneyNumber'; label: string; unique: boolean };

const TARGETS: Target[] = [
  { model: 'beneficiary', field: 'phone',             label: 'Beneficiary.phone',             unique: false },
  { model: 'beneficiary', field: 'mobileMoneyNumber', label: 'Beneficiary.mobileMoneyNumber', unique: false },
  { model: 'user',        field: 'phone',             label: 'User.phone',                    unique: true  },
];

type Change = { model: Target['model']; field: Target['field']; id: string; before: string; after: string };
type Suspect = { label: string; id: string; before: string; reason: string };
type Conflict = { label: string; id: string; before: string; after: string; otherId: string };

const PAGE = 500;
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ROLLBACK = args.find((a) => a.startsWith('--rollback='))?.split('=')[1];

async function scan(): Promise<{ changes: Change[]; suspects: Suspect[]; conflicts: Conflict[]; scanned: number }> {
  const changes: Change[] = [];
  const suspects: Suspect[] = [];
  const conflicts: Conflict[] = [];
  let scanned = 0;

  for (const t of TARGETS) {
    const delegate = (prisma as any)[t.model];
    let cursor: string | undefined;
    for (;;) {
      const rows: { id: string; [k: string]: any }[] = await delegate.findMany({
        where: { [t.field]: { not: null } },
        select: { id: true, [t.field]: true },
        orderBy: { id: 'asc' },
        take: PAGE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (rows.length === 0) break;
      cursor = rows[rows.length - 1].id;
      scanned += rows.length;

      for (const row of rows) {
        const value = row[t.field] as string;
        const r = repairDoubledDialCode(value);
        if (r.status === 'suspect') {
          suspects.push({ label: t.label, id: row.id, before: value, reason: r.reason });
        } else if (r.status === 'fixed') {
          if (t.unique) {
            const other = await delegate.findFirst({ where: { [t.field]: r.after, id: { not: row.id } }, select: { id: true } });
            if (other) {
              conflicts.push({ label: t.label, id: row.id, before: value, after: r.after, otherId: other.id });
              continue;
            }
          }
          changes.push({ model: t.model, field: t.field, id: row.id, before: value, after: r.after });
        }
      }
      if (rows.length < PAGE) break;
    }
  }
  return { changes, suspects, conflicts, scanned };
}

function labelOf(c: { model: string; field: string }) {
  return `${c.model === 'user' ? 'User' : 'Beneficiary'}.${c.field}`;
}

async function runRepair() {
  console.log(`🔧 Réparation des indicatifs répétés — ${APPLY ? 'MODE ÉCRITURE (--apply)' : 'SIMULATION (rien n\'est écrit)'}\n`);
  const { changes, suspects, conflicts, scanned } = await scan();

  console.log(`Lignes examinées : ${scanned}\n`);

  if (changes.length) {
    console.log(`── À RÉPARER (${changes.length}) ──`);
    for (const c of changes) console.log(`   ${labelOf(c).padEnd(30)} id=${c.id}  "${c.before}"  →  "${c.after}"`);
    console.log('');
  } else {
    console.log('✅ Aucun numéro à réparer.\n');
  }

  if (conflicts.length) {
    console.log(`── CONFLITS User.phone (${conflicts.length}) — non modifiés : le numéro réparé appartient déjà à un autre compte ──`);
    for (const c of conflicts) console.log(`   id=${c.id}  "${c.before}" → "${c.after}"  (déjà utilisé par id=${c.otherId})`);
    console.log('   → à trancher à la main (fusion ou correction du titulaire).\n');
  }

  if (suspects.length) {
    console.log(`── À VÉRIFIER À LA MAIN (${suspects.length}) — non modifiés ──`);
    for (const s of suspects) console.log(`   ${s.label.padEnd(30)} id=${s.id}  "${s.before}"  ${s.reason}`);
    console.log('');
  }

  if (!APPLY) {
    console.log('ℹ️  Simulation terminée. Relancez avec --apply pour écrire ces changements (une sauvegarde JSON sera créée avant).\n');
    return;
  }
  if (changes.length === 0) return;

  // 1) sauvegarde AVANT toute écriture
  const backupFile = `repair-doubled-dial-codes.${new Date().toISOString().replace(/[:.]/g, '-')}.backup.json`;
  fs.writeFileSync(backupFile, JSON.stringify(changes, null, 2), 'utf8');
  console.log(`💾 Sauvegarde écrite : ${backupFile}\n`);

  // 2) écriture ligne par ligne, seulement si la valeur en base est toujours celle lue
  let done = 0;
  let skipped = 0;
  let failed = 0;
  for (const c of changes) {
    try {
      const res = await (prisma as any)[c.model].updateMany({ where: { id: c.id, [c.field]: c.before }, data: { [c.field]: c.after } });
      if (res.count === 1) done++;
      else { skipped++; console.log(`⏭️  ${labelOf(c)} id=${c.id} : modifié entre-temps, ignoré`); }
    } catch (e: any) {
      failed++;
      console.log(`❌ ${labelOf(c)} id=${c.id} : ${e?.code === 'P2002' ? 'conflit @unique' : (e?.message ?? 'erreur inconnue')}`);
    }
  }
  console.log('\n── Résumé ──────────────────────────────');
  console.log(`   Réparés   : ${done}`);
  console.log(`   Ignorés   : ${skipped}`);
  console.log(`   Échecs    : ${failed}`);
  console.log('─────────────────────────────────────────');
  console.log(`   Retour arrière : npx ts-node scripts/repair-doubled-dial-codes.ts --rollback=${backupFile}\n`);
}

async function runRollback(file: string) {
  const changes: Change[] = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`↩️  Retour arrière depuis ${file} (${changes.length} lignes)\n`);
  let restored = 0;
  let skipped = 0;
  for (const c of changes) {
    try {
      const res = await (prisma as any)[c.model].updateMany({ where: { id: c.id, [c.field]: c.after }, data: { [c.field]: c.before } });
      if (res.count === 1) restored++; else skipped++;
    } catch (e: any) {
      skipped++;
      console.log(`❌ ${labelOf(c)} id=${c.id} : ${e?.message ?? 'erreur inconnue'}`);
    }
  }
  console.log(`   Restaurés : ${restored} — ignorés (valeur modifiée depuis) : ${skipped}\n`);
}

(ROLLBACK ? runRollback(ROLLBACK) : runRepair())
  .catch((e) => { console.error('❌ Erreur :', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
