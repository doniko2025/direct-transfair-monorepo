// apps/backend/prisma/seed.ts
// =========================================================
// SEED v4.3 — Direct Transf'air
// ✅ v4.3 : SÉCURITÉ — (1) plus de mot de passe Super Admin écrit dans le code ni affiché : il vient de
//   SEED_SUPER_ADMIN_PASSWORD, sinon un mot de passe aléatoire fort est généré et montré UNE seule fois ;
//   (2) le TRUNCATE de toutes les tables ne part plus tout seul : base non vide → refus, sauf SEED_FORCE=true ;
//   en production il faut en plus SEED_ALLOW_PRODUCTION=true ; (3) couleurs de la société DONIKO = vert de la
//   marque (#059669 / #10B981, surchargeables : SEED_BRAND_PRIMARY, SEED_BRAND_SECONDARY) au lieu de rouge/bleu ;
//   e-mail du Super Admin surchargeable (SEED_SUPER_ADMIN_EMAIL).
//   Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ✅ v4.0 : Super Admin + Client DONIKO + taux + pays
// ✅ v4.1 : Cleanup étendu nouveaux modèles
// ✅ v4.2 : FIX cleanup — TRUNCATE CASCADE SQL brut
//   RAISON : prisma['model'] via bracket notation retourne un
//   proxy Prisma sur Neon (pas undefined), le check if() passe
//   mais l'invocation .deleteMany() plante avec "Invalid invocation".
//   Solution : TRUNCATE de toutes les tables publiques en SQL pur,
//   qui ignore l'ordre des FK grâce à CASCADE.
// =========================================================

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { randomBytes } = require('crypto');

const prisma = new PrismaClient();

const Role = {
  SUPER_ADMIN:   'SUPER_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  AGENT:         'AGENT',
  USER:          'USER',
};

const SubscriptionType   = { PURCHASE: 'PURCHASE', RENTAL: 'RENTAL' };
const SubscriptionStatus = { ACTIVE: 'ACTIVE' };
const KycLevel           = { LEVEL_3: 'LEVEL_3' };

const SUPER_ADMIN_EMAIL = (process.env.SEED_SUPER_ADMIN_EMAIL || 'thiernodoniko@gmail.com').trim().toLowerCase();

/** Mot de passe fourni par l'environnement, sinon généré (24 caractères, lettres + chiffres + symbole). */
function resolveSuperAdminPassword(): { value: string; generated: boolean } {
  const fromEnv = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (fromEnv && fromEnv.length >= 12) return { value: fromEnv, generated: false };
  if (fromEnv) {
    console.error('❌ SEED_SUPER_ADMIN_PASSWORD doit faire au moins 12 caractères.');
    process.exit(1);
  }
  const core = randomBytes(18).toString('base64').replace(/[+/=]/g, 'x').slice(0, 22);
  return { value: `${core}A9!`, generated: true };
}

const BRAND_PRIMARY   = /^#[0-9a-f]{6}$/i.test(process.env.SEED_BRAND_PRIMARY   || '') ? process.env.SEED_BRAND_PRIMARY   : '#059669';
const BRAND_SECONDARY = /^#[0-9a-f]{6}$/i.test(process.env.SEED_BRAND_SECONDARY || '') ? process.env.SEED_BRAND_SECONDARY : '#10B981';

const COUNTRY_CURRENCIES = [
  // Eurozone
  { countryCode: 'FR', countryName: 'France',        currencyCode: 'EUR', currencyName: 'Euro',             currencySymbol: '€',   flagEmoji: '🇫🇷' },
  { countryCode: 'DE', countryName: 'Allemagne',     currencyCode: 'EUR', currencyName: 'Euro',             currencySymbol: '€',   flagEmoji: '🇩🇪' },
  { countryCode: 'IT', countryName: 'Italie',        currencyCode: 'EUR', currencyName: 'Euro',             currencySymbol: '€',   flagEmoji: '🇮🇹' },
  { countryCode: 'ES', countryName: 'Espagne',       currencyCode: 'EUR', currencyName: 'Euro',             currencySymbol: '€',   flagEmoji: '🇪🇸' },
  { countryCode: 'BE', countryName: 'Belgique',      currencyCode: 'EUR', currencyName: 'Euro',             currencySymbol: '€',   flagEmoji: '🇧🇪' },
  { countryCode: 'PT', countryName: 'Portugal',      currencyCode: 'EUR', currencyName: 'Euro',             currencySymbol: '€',   flagEmoji: '🇵🇹' },
  { countryCode: 'NL', countryName: 'Pays-Bas',      currencyCode: 'EUR', currencyName: 'Euro',             currencySymbol: '€',   flagEmoji: '🇳🇱' },
  { countryCode: 'AT', countryName: 'Autriche',      currencyCode: 'EUR', currencyName: 'Euro',             currencySymbol: '€',   flagEmoji: '🇦🇹' },
  { countryCode: 'IE', countryName: 'Irlande',       currencyCode: 'EUR', currencyName: 'Euro',             currencySymbol: '€',   flagEmoji: '🇮🇪' },
  { countryCode: 'LU', countryName: 'Luxembourg',    currencyCode: 'EUR', currencyName: 'Euro',             currencySymbol: '€',   flagEmoji: '🇱🇺' },
  { countryCode: 'GR', countryName: 'Grèce',         currencyCode: 'EUR', currencyName: 'Euro',             currencySymbol: '€',   flagEmoji: '🇬🇷' },
  { countryCode: 'FI', countryName: 'Finlande',      currencyCode: 'EUR', currencyName: 'Euro',             currencySymbol: '€',   flagEmoji: '🇫🇮' },
  // GBP
  { countryCode: 'GB', countryName: 'Royaume-Uni',   currencyCode: 'GBP', currencyName: 'Livre sterling',   currencySymbol: '£',   flagEmoji: '🇬🇧' },
  { countryCode: 'GG', countryName: 'Guernesey',     currencyCode: 'GBP', currencyName: 'Livre sterling',   currencySymbol: '£',   flagEmoji: '🇬🇬' },
  { countryCode: 'JE', countryName: 'Jersey',        currencyCode: 'GBP', currencyName: 'Livre sterling',   currencySymbol: '£',   flagEmoji: '🇯🇪' },
  { countryCode: 'IM', countryName: "Île de Man",    currencyCode: 'GBP', currencyName: 'Livre sterling',   currencySymbol: '£',   flagEmoji: '🇮🇲' },
  // USD
  { countryCode: 'US', countryName: 'États-Unis',    currencyCode: 'USD', currencyName: 'Dollar américain', currencySymbol: '$',   flagEmoji: '🇺🇸' },
  { countryCode: 'SV', countryName: 'Salvador',      currencyCode: 'USD', currencyName: 'Dollar américain', currencySymbol: '$',   flagEmoji: '🇸🇻' },
  { countryCode: 'PA', countryName: 'Panama',        currencyCode: 'USD', currencyName: 'Dollar américain', currencySymbol: '$',   flagEmoji: '🇵🇦' },
  { countryCode: 'EC', countryName: 'Équateur',      currencyCode: 'USD', currencyName: 'Dollar américain', currencySymbol: '$',   flagEmoji: '🇪🇨' },
  // GNF
  { countryCode: 'GN', countryName: 'Guinée',        currencyCode: 'GNF', currencyName: 'Franc guinéen',    currencySymbol: 'FG',  flagEmoji: '🇬🇳' },
  // XOF
  { countryCode: 'SN', countryName: 'Sénégal',          currencyCode: 'XOF', currencyName: 'Franc CFA', currencySymbol: 'CFA', flagEmoji: '🇸🇳' },
  { countryCode: 'CI', countryName: "Côte d'Ivoire",    currencyCode: 'XOF', currencyName: 'Franc CFA', currencySymbol: 'CFA', flagEmoji: '🇨🇮' },
  { countryCode: 'ML', countryName: 'Mali',              currencyCode: 'XOF', currencyName: 'Franc CFA', currencySymbol: 'CFA', flagEmoji: '🇲🇱' },
  { countryCode: 'BF', countryName: 'Burkina Faso',      currencyCode: 'XOF', currencyName: 'Franc CFA', currencySymbol: 'CFA', flagEmoji: '🇧🇫' },
  { countryCode: 'BJ', countryName: 'Bénin',             currencyCode: 'XOF', currencyName: 'Franc CFA', currencySymbol: 'CFA', flagEmoji: '🇧🇯' },
  { countryCode: 'TG', countryName: 'Togo',              currencyCode: 'XOF', currencyName: 'Franc CFA', currencySymbol: 'CFA', flagEmoji: '🇹🇬' },
  { countryCode: 'NE', countryName: 'Niger',             currencyCode: 'XOF', currencyName: 'Franc CFA', currencySymbol: 'CFA', flagEmoji: '🇳🇪' },
  { countryCode: 'GW', countryName: 'Guinée-Bissau',     currencyCode: 'XOF', currencyName: 'Franc CFA', currencySymbol: 'CFA', flagEmoji: '🇬🇼' },
];

const EXCHANGE_RATES = [
  { pair: 'EUR_XOF', rate: 655.957,       inverseRate: 1 / 655.957 },
  { pair: 'EUR_GNF', rate: 9450.0,        inverseRate: 1 / 9450.0  },
  { pair: 'EUR_USD', rate: 1.08,          inverseRate: 1 / 1.08    },
  { pair: 'EUR_GBP', rate: 0.85,          inverseRate: 1 / 0.85    },
  { pair: 'GBP_EUR', rate: 1.176,         inverseRate: 1 / 1.176   },
  { pair: 'GBP_XOF', rate: 770.0,         inverseRate: 1 / 770.0   },
  { pair: 'GBP_GNF', rate: 11100.0,       inverseRate: 1 / 11100.0 },
  { pair: 'GBP_USD', rate: 1.27,          inverseRate: 1 / 1.27    },
  { pair: 'USD_EUR', rate: 0.926,         inverseRate: 1 / 0.926   },
  { pair: 'USD_XOF', rate: 607.0,         inverseRate: 1 / 607.0   },
  { pair: 'USD_GNF', rate: 8750.0,        inverseRate: 1 / 8750.0  },
  { pair: 'USD_GBP', rate: 0.787,         inverseRate: 1 / 0.787   },
  { pair: 'XOF_EUR', rate: 1 / 655.957,   inverseRate: 655.957     },
  { pair: 'XOF_GNF', rate: 14.4,          inverseRate: 1 / 14.4    },
  { pair: 'GNF_EUR', rate: 1 / 9450.0,    inverseRate: 9450.0      },
  { pair: 'GNF_XOF', rate: 1 / 14.4,      inverseRate: 14.4        },
];

async function main() {
  // ═══════════════════════════════════════════════════════
  // GARDE-FOU — ne jamais vider une base remplie par accident
  // ═══════════════════════════════════════════════════════
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
    console.error('❌ NODE_ENV=production : seed refusé (il efface TOUTES les tables). Pour le forcer : SEED_ALLOW_PRODUCTION=true SEED_FORCE=true');
    process.exit(1);
  }
  let existingUsers = 0;
  try { existingUsers = await prisma.user.count(); } catch { existingUsers = 0; } // table absente = base vierge
  if (existingUsers > 0 && process.env.SEED_FORCE !== 'true') {
    console.error(`❌ La base contient déjà ${existingUsers} utilisateur(s) : le seed effacerait tout. Pour confirmer : SEED_FORCE=true pnpm prisma:seed`);
    process.exit(1);
  }
  const admin = resolveSuperAdminPassword();

  // ═══════════════════════════════════════════════════════
  // CLEANUP — TRUNCATE CASCADE (v4.2)
  // Plus fiable que les deleteMany() en boucle :
  //  • Ignore l'ordre des FK grâce à CASCADE
  //  • Ne plante pas si un modèle n'existe pas dans le schéma
  //  • Remet les séquences auto-increment à zéro
  // ═══════════════════════════════════════════════════════
  console.log('🔥 NETTOYAGE DE LA BASE (TRUNCATE CASCADE)...');
  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      DECLARE
        tbl RECORD;
      BEGIN
        FOR tbl IN
          SELECT tablename
          FROM   pg_tables
          WHERE  schemaname = 'public'
            AND  tablename  != '_prisma_migrations'
        LOOP
          EXECUTE format(
            'TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE',
            tbl.tablename
          );
        END LOOP;
      END
      $$;
    `);
    console.log('   ✅ Toutes les tables vidées\n');
  } catch (e: any) {
    console.error('   ❌ Erreur TRUNCATE:', e.message ?? e);
    process.exit(1);
  }

  console.log('🌱 DÉBUT DU SEEDING...\n');

  // ── 1. CountryCurrency ──────────────────────────────────
  console.log('🌍 Insertion CountryCurrency map...');
  for (const cc of COUNTRY_CURRENCIES) {
    await prisma.countryCurrency.upsert({
      where:  { countryCode: cc.countryCode },
      update: cc,
      create: { ...cc, isSupported: true },
    });
  }
  console.log(`   ✅ ${COUNTRY_CURRENCIES.length} pays mappés\n`);

  // ── 2. Tenant ───────────────────────────────────────────
  if (prisma.tenant) {
    await prisma.tenant.create({
      data: { code: 'DONIKO', name: 'Tenant Doniko (Platform)', isActive: true },
    });
    console.log('✅ TENANT DONIKO créé\n');
  }

  // ── 3. Client ───────────────────────────────────────────
  const doniko = await prisma.client.create({
    data: {
      code:               'DONIKO',
      name:               'Doniko SAS',
      primaryColor:       BRAND_PRIMARY,
      secondaryColor:     BRAND_SECONDARY,
      timezone:           'Europe/Paris',
      locale:             'fr-FR',
      defaultCurrency:    'EUR',
      country:            'FR',
      city:               'Paris',
      subscriptionType:   SubscriptionType.PURCHASE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      email:              'contact@doniko.com',
      phone:              '+33600000000',
      address:            'Paris, France',
      allowedCurrencies:  ['XOF', 'EUR', 'USD', 'GNF', 'GBP'],
      featureScheduledTransfers: true,
      featureRateAlerts:         true,
      featureLoyaltyPoints:      true,
      requireKyc:                false,
    },
  });
  console.log('✅ CLIENT DONIKO créé\n');

  // ── 4. Wallets plateforme ───────────────────────────────
  const platformCurrencies = ['XOF', 'EUR', 'USD', 'GNF', 'GBP'];
  for (const cur of platformCurrencies) {
    await prisma.wallet.create({
      data: {
        clientId:  doniko.id,
        currency:  cur,
        balance:   0,
        isDefault: cur === 'EUR',
        isActive:  true,
      },
    });
  }
  console.log(`💼 5 wallets plateforme créés (${platformCurrencies.join(', ')})\n`);

  // ── 5. Super Admin ──────────────────────────────────────
  const password   = await bcrypt.hash(admin.value, 12);
  const superAdmin = await prisma.user.create({
    data: {
      email:             SUPER_ADMIN_EMAIL,
      password,
      firstName:         'Thierno',
      lastName:          'Doniko',
      role:              Role.SUPER_ADMIN,
      clientId:          doniko.id,
      country:           'FR',
      city:              'Paris',
      primaryCurrency:   'EUR',
      jobTitle:          'Super Administrateur',
      isEmailVerified:   true,
      isActive:          true,
      kycLevel:          KycLevel.LEVEL_3,
      preferredLanguage: 'fr',
      referralCode:      'DONIKO001',
    },
  });

  await prisma.wallet.create({
    data: {
      userId:    superAdmin.id,
      currency:  'EUR',
      balance:   0,
      isDefault: true,
      isActive:  true,
    },
  });

  console.log('✅ SUPER ADMIN créé');
  console.log(`   👤 Email    : ${SUPER_ADMIN_EMAIL}`);
  if (admin.generated) {
    console.log(`   🔑 Mot de passe généré (affiché UNE seule fois, change-le à la première connexion) : ${admin.value}`);
  } else {
    console.log('   🔑 Mot de passe : celui de SEED_SUPER_ADMIN_PASSWORD');
  }
  console.log(`   💼 Wallet   : EUR créé\n`);

  // ── 6. Taux de change ───────────────────────────────────
  console.log('💱 Insertion taux de change...');
  for (const r of EXCHANGE_RATES) {
    await prisma.exchangeRate.upsert({
      where:  { pair: r.pair },
      update: { rate: r.rate, inverseRate: r.inverseRate },
      create: { pair: r.pair, rate: r.rate, inverseRate: r.inverseRate, source: 'manual' },
    });
  }
  console.log(`   ✅ ${EXCHANGE_RATES.length} paires créées\n`);

  // ── 7. Loyalty config ───────────────────────────────────
  await prisma.loyaltyConfig.create({
    data: {
      clientId:          doniko.id,
      pointsPerEuro:     1.0,
      euroPerPoint:      0.01,
      bronzeThreshold:   0,
      silverThreshold:   1000,
      goldThreshold:     5000,
      platinumThreshold: 20000,
      isActive:          true,
    },
  });
  console.log('🎁 LoyaltyConfig DONIKO créé\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 SEEDING TERMINÉ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 ${COUNTRY_CURRENCIES.length} pays mappés`);
  console.log(`💱 ${EXCHANGE_RATES.length} paires de taux`);
  console.log(`💼 5 wallets plateforme`);
  console.log(`👤 1 Super Admin`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error('❌ Erreur seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// Pour lancer : npx prisma db seed