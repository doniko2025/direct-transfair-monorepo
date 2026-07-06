// apps/backend/scripts/backfill-phone-normalized.ts
// =========================================================
// BACKFILL — Normalisation de tous les numéros existants
// =========================================================
//
// CONTEXTE :
//   Le code applicatif normalise désormais tous les numéros de
//   téléphone à l'écriture (create/update/register) via
//   normalizePhoneE164(). Mais les comptes déjà existants en base
//   ont encore leur `phone` sous sa forme brute d'origine
//   ("+33...", "0033...", "33...", etc.). Ce script réécrit chaque
//   `phone` existant vers sa forme normalisée, pour que TOUTE la
//   base soit cohérente avec le nouveau format.
//
// PRÉREQUIS :
//   Exécutez D'ABORD audit-duplicate-phones.ts et résolvez tout
//   doublon signalé. Si deux comptes normalisent vers le même
//   numéro, ce script échouera sur le second (contrainte @unique)
//   — c'est le comportement voulu (fail-safe), mais autant le
//   savoir avant plutôt que de découvrir des échecs en masse.
//
// COMPORTEMENT :
//   - Traite chaque utilisateur ligne par ligne (pas de transaction
//     globale) : un échec sur une ligne (ex: P2002 si un doublon a
//     été manqué) n'interrompt PAS le traitement des autres lignes.
//   - N'écrit que si la forme normalisée diffère de la forme brute
//     actuelle (évite des UPDATE inutiles).
//   - Affiche un résumé final : mis à jour / déjà correct / échecs.
//
// UTILISATION :
//   npx ts-node apps/backend/scripts/backfill-phone-normalized.ts
// =========================================================

import { PrismaClient } from '@prisma/client';
import { normalizePhoneE164 } from '../src/common/utils/phone.util';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Backfill de normalisation des téléphones — démarrage...\n');

  const users = await prisma.user.findMany({
    where: { phone: { not: null } },
    select: { id: true, phone: true, email: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Total utilisateurs avec téléphone renseigné : ${users.length}\n`);

  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  const failures: { id: string; email: string; phone: string | null; error: string }[] = [];

  for (const user of users) {
    const normalized = normalizePhoneE164(user.phone);

    if (!normalized) {
      failed++;
      failures.push({
        id: user.id,
        email: user.email,
        phone: user.phone,
        error: 'Numéro non normalisable (moins de 6 chiffres exploitables)',
      });
      continue;
    }

    if (normalized === user.phone) {
      unchanged++;
      continue;
    }

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { phone: normalized },
      });
      console.log(`✅ ${user.email} : "${user.phone}" → "${normalized}"`);
      updated++;
    } catch (e: any) {
      failed++;
      const message = e?.code === 'P2002'
        ? 'Conflit @unique — un autre compte a déjà ce numéro normalisé (doublon non résolu)'
        : (e?.message ?? 'Erreur inconnue');
      failures.push({ id: user.id, email: user.email, phone: user.phone, error: message });
      console.log(`❌ ${user.email} : échec — ${message}`);
    }
  }

  console.log('\n── Résumé ──────────────────────────────');
  console.log(`   Mis à jour     : ${updated}`);
  console.log(`   Déjà corrects  : ${unchanged}`);
  console.log(`   Échecs         : ${failed}`);
  console.log('─────────────────────────────────────────\n');

  if (failures.length > 0) {
    console.log('Détail des échecs :');
    failures.forEach((f) => {
      console.log(`   • id=${f.id} email=${f.email} phone="${f.phone}" → ${f.error}`);
    });
    console.log(
      '\n⚠️  Résolvez ces cas manuellement (voir audit-duplicate-phones.ts), ' +
      'puis relancez ce script si nécessaire — il est idempotent.\n',
    );
  } else {
    console.log('✅ Tous les numéros sont maintenant normalisés.\n');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Erreur pendant le backfill :', e);
  prisma.$disconnect().finally(() => process.exit(1));
});