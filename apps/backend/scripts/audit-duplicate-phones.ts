// apps/backend/scripts/audit-duplicate-phones.ts
// =========================================================
// AUDIT — Détection des doublons de téléphone
// =========================================================
//
// CONTEXTE :
//   Avant le correctif de sécurité (v4.18 / v4.5 / v5.1 / v2.2), il
//   était possible que deux comptes stockent le même numéro réel
//   sous deux formats textuels différents (ex: "+33766736226" et
//   "0033766736226"), car l'unicité `@unique` de Prisma s'applique à
//   la chaîne brute, pas au numéro normalisé. C'est ce qui a permis
//   l'incident du dépôt de 50 000 € crédité au mauvais compte.
//
// CE SCRIPT :
//   - Lecture seule. N'écrit rien en base.
//   - Charge tous les users ayant un `phone` non-null.
//   - Regroupe par normalizePhoneE164(phone).
//   - Affiche chaque groupe contenant PLUS D'UN utilisateur.
//
// UTILISATION :
//   npx ts-node apps/backend/scripts/audit-duplicate-phones.ts
//
// À FAIRE APRÈS EXÉCUTION :
//   - S'il n'y a AUCUN groupe en doublon → passer à
//     backfill-phone-normalized.ts en toute sécurité.
//   - S'il y a des groupes en doublon → résoudre chaque cas
//     MANUELLEMENT avant le backfill (ex: renommer/fusionner/
//     contacter le bon titulaire), car le backfill échouera sur
//     ces lignes (contrainte @unique) et les signalera dans son
//     propre rapport, mais il est plus sûr de trancher à la main
//     qui garde le numéro.
// =========================================================

import { PrismaClient } from '@prisma/client';
import { normalizePhoneE164 } from '../src/common/utils/phone.util';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Audit des doublons de téléphone — démarrage...\n');

  const users = await prisma.user.findMany({
    where: { phone: { not: null } },
    select: {
      id: true,
      role: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      clientId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Total utilisateurs avec téléphone renseigné : ${users.length}\n`);

  const groups = new Map<string, typeof users>();

  for (const user of users) {
    const normalized = normalizePhoneE164(user.phone);
    if (!normalized) {
      console.log(
        `⚠️  Numéro non normalisable (ignoré du regroupement) : ` +
        `id=${user.id} phone="${user.phone}" email=${user.email}`,
      );
      continue;
    }
    const group = groups.get(normalized) ?? [];
    group.push(user);
    groups.set(normalized, group);
  }

  const duplicates = [...groups.entries()].filter(([, list]) => list.length > 1);

  if (duplicates.length === 0) {
    console.log('✅ Aucun doublon détecté. La base est saine.');
    console.log('   → Vous pouvez exécuter backfill-phone-normalized.ts en toute sécurité.\n');
    await prisma.$disconnect();
    return;
  }

  console.log(`🚨 ${duplicates.length} groupe(s) en doublon détecté(s) :\n`);

  duplicates.forEach(([normalized, list], idx) => {
    console.log(`── Groupe ${idx + 1} — numéro normalisé : ${normalized} ──`);
    list.forEach((u) => {
      console.log(
        `   • id=${u.id} | role=${u.role} | nom="${u.firstName ?? ''} ${u.lastName ?? ''}".trim() ` +
        `| phone brut="${u.phone}" | email=${u.email} | clientId=${u.clientId} | créé=${u.createdAt.toISOString()}`,
      );
    });
    console.log('');
  });

  console.log(
    `⚠️  Résolvez CHAQUE groupe manuellement avant de lancer le backfill ` +
    `(décider qui garde le numéro, contacter l'autre titulaire si besoin).\n`,
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Erreur pendant l\'audit :', e);
  prisma.$disconnect().finally(() => process.exit(1));
});