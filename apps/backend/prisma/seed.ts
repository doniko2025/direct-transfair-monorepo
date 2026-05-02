// apps/backend/prisma/seed.ts
// =========================================================
// SEED v4.0 — Direct Transf'air
// ✅ Super Admin uniquement (le reste se crée via UI)
// ✅ Tenant + Client DONIKO (plateforme)
// ✅ 5 devises : XOF, EUR, USD, GNF, GBP
// ✅ Taux de change pour toutes les paires importantes
// ✅ Map pays → devise (CountryCurrency)
// =========================================================

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Enums simulés (évite les soucis d'import TS dans le seed)
const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  AGENT: 'AGENT',
  USER: 'USER',
};

const SubscriptionType = { PURCHASE: 'PURCHASE', RENTAL: 'RENTAL' };
const SubscriptionStatus = { ACTIVE: 'ACTIVE' };
const KycLevel = { LEVEL_3: 'LEVEL_3' };

// =========================================================
// CONFIG
// =========================================================

const SUPER_ADMIN_EMAIL = 'thiernodoniko@gmail.com';
const SUPER_ADMIN_PASSWORD = 'Lcd123456!';

// =========================================================
// COUNTRY → CURRENCY MAP
// =========================================================

const COUNTRY_CURRENCIES = [
  // Eurozone
  { countryCode: 'FR', countryName: 'France', currencyCode: 'EUR', currencyName: 'Euro', currencySymbol: '€', flagEmoji: '🇫🇷' },
  { countryCode: 'DE', countryName: 'Allemagne', currencyCode: 'EUR', currencyName: 'Euro', currencySymbol: '€', flagEmoji: '🇩🇪' },
  { countryCode: 'IT', countryName: 'Italie', currencyCode: 'EUR', currencyName: 'Euro', currencySymbol: '€', flagEmoji: '🇮🇹' },
  { countryCode: 'ES', countryName: 'Espagne', currencyCode: 'EUR', currencyName: 'Euro', currencySymbol: '€', flagEmoji: '🇪🇸' },
  { countryCode: 'BE', countryName: 'Belgique', currencyCode: 'EUR', currencyName: 'Euro', currencySymbol: '€', flagEmoji: '🇧🇪' },
  { countryCode: 'PT', countryName: 'Portugal', currencyCode: 'EUR', currencyName: 'Euro', currencySymbol: '€', flagEmoji: '🇵🇹' },
  { countryCode: 'NL', countryName: 'Pays-Bas', currencyCode: 'EUR', currencyName: 'Euro', currencySymbol: '€', flagEmoji: '🇳🇱' },
  { countryCode: 'AT', countryName: 'Autriche', currencyCode: 'EUR', currencyName: 'Euro', currencySymbol: '€', flagEmoji: '🇦🇹' },
  { countryCode: 'IE', countryName: 'Irlande', currencyCode: 'EUR', currencyName: 'Euro', currencySymbol: '€', flagEmoji: '🇮🇪' },
  { countryCode: 'LU', countryName: 'Luxembourg', currencyCode: 'EUR', currencyName: 'Euro', currencySymbol: '€', flagEmoji: '🇱🇺' },
  { countryCode: 'GR', countryName: 'Grèce', currencyCode: 'EUR', currencyName: 'Euro', currencySymbol: '€', flagEmoji: '🇬🇷' },
  { countryCode: 'FI', countryName: 'Finlande', currencyCode: 'EUR', currencyName: 'Euro', currencySymbol: '€', flagEmoji: '🇫🇮' },

  // Royaume-Uni
  { countryCode: 'GB', countryName: 'Royaume-Uni', currencyCode: 'GBP', currencyName: 'Livre sterling', currencySymbol: '£', flagEmoji: '🇬🇧' },
  { countryCode: 'GG', countryName: 'Guernesey', currencyCode: 'GBP', currencyName: 'Livre sterling', currencySymbol: '£', flagEmoji: '🇬🇬' },
  { countryCode: 'JE', countryName: 'Jersey', currencyCode: 'GBP', currencyName: 'Livre sterling', currencySymbol: '£', flagEmoji: '🇯🇪' },
  { countryCode: 'IM', countryName: "Île de Man", currencyCode: 'GBP', currencyName: 'Livre sterling', currencySymbol: '£', flagEmoji: '🇮🇲' },

  // USD
  { countryCode: 'US', countryName: 'États-Unis', currencyCode: 'USD', currencyName: 'Dollar américain', currencySymbol: '$', flagEmoji: '🇺🇸' },
  { countryCode: 'SV', countryName: 'Salvador', currencyCode: 'USD', currencyName: 'Dollar américain', currencySymbol: '$', flagEmoji: '🇸🇻' },
  { countryCode: 'PA', countryName: 'Panama', currencyCode: 'USD', currencyName: 'Dollar américain', currencySymbol: '$', flagEmoji: '🇵🇦' },
  { countryCode: 'EC', countryName: 'Équateur', currencyCode: 'USD', currencyName: 'Dollar américain', currencySymbol: '$', flagEmoji: '🇪🇨' },

  // Guinée
  { countryCode: 'GN', countryName: 'Guinée', currencyCode: 'GNF', currencyName: 'Franc guinéen', currencySymbol: 'FG', flagEmoji: '🇬🇳' },

  // UEMOA (XOF)
  { countryCode: 'SN', countryName: 'Sénégal', currencyCode: 'XOF', currencyName: 'Franc CFA', currencySymbol: 'CFA', flagEmoji: '🇸🇳' },
  { countryCode: 'CI', countryName: "Côte d'Ivoire", currencyCode: 'XOF', currencyName: 'Franc CFA', currencySymbol: 'CFA', flagEmoji: '🇨🇮' },
  { countryCode: 'ML', countryName: 'Mali', currencyCode: 'XOF', currencyName: 'Franc CFA', currencySymbol: 'CFA', flagEmoji: '🇲🇱' },
  { countryCode: 'BF', countryName: 'Burkina Faso', currencyCode: 'XOF', currencyName: 'Franc CFA', currencySymbol: 'CFA', flagEmoji: '🇧🇫' },
  { countryCode: 'BJ', countryName: 'Bénin', currencyCode: 'XOF', currencyName: 'Franc CFA', currencySymbol: 'CFA', flagEmoji: '🇧🇯' },
  { countryCode: 'TG', countryName: 'Togo', currencyCode: 'XOF', currencyName: 'Franc CFA', currencySymbol: 'CFA', flagEmoji: '🇹🇬' },
  { countryCode: 'NE', countryName: 'Niger', currencyCode: 'XOF', currencyName: 'Franc CFA', currencySymbol: 'CFA', flagEmoji: '🇳🇪' },
  { countryCode: 'GW', countryName: 'Guinée-Bissau', currencyCode: 'XOF', currencyName: 'Franc CFA', currencySymbol: 'CFA', flagEmoji: '🇬🇼' },
];

// =========================================================
// TAUX DE CHANGE INITIAUX (à ajuster selon les vrais taux)
// =========================================================

const EXCHANGE_RATES = [
  // Base EUR
  { pair: 'EUR_XOF', rate: 655.957, inverseRate: 1 / 655.957 },
  { pair: 'EUR_GNF', rate: 9450.0, inverseRate: 1 / 9450.0 },
  { pair: 'EUR_USD', rate: 1.08, inverseRate: 1 / 1.08 },
  { pair: 'EUR_GBP', rate: 0.85, inverseRate: 1 / 0.85 },

  // Base GBP
  { pair: 'GBP_EUR', rate: 1.176, inverseRate: 1 / 1.176 },
  { pair: 'GBP_XOF', rate: 770.0, inverseRate: 1 / 770.0 },
  { pair: 'GBP_GNF', rate: 11100.0, inverseRate: 1 / 11100.0 },
  { pair: 'GBP_USD', rate: 1.27, inverseRate: 1 / 1.27 },

  // Base USD
  { pair: 'USD_EUR', rate: 0.926, inverseRate: 1 / 0.926 },
  { pair: 'USD_XOF', rate: 607.0, inverseRate: 1 / 607.0 },
  { pair: 'USD_GNF', rate: 8750.0, inverseRate: 1 / 8750.0 },
  { pair: 'USD_GBP', rate: 0.787, inverseRate: 1 / 0.787 },

  // Base XOF
  { pair: 'XOF_EUR', rate: 1 / 655.957, inverseRate: 655.957 },
  { pair: 'XOF_GNF', rate: 14.4, inverseRate: 1 / 14.4 },

  // Base GNF
  { pair: 'GNF_EUR', rate: 1 / 9450.0, inverseRate: 9450.0 },
  { pair: 'GNF_XOF', rate: 1 / 14.4, inverseRate: 14.4 },
];

// =========================================================
// MAIN
// =========================================================

async function main() {
  console.log('🔥 NETTOYAGE DE LA BASE...');

  // Ordre de suppression : du plus dépendant au moins dépendant
  const cleanupOps = [
    'webhookDelivery',
    'webhookEndpoint',
    'apiKey',
    'auditLog',
    'alert',
    'amlFlag',
    'communicationLog',
    'commsTemplate',
    'notification',
    'kycDocument',
    'otpLog',
    'userDevice',
    'userSession',
    'loyaltyTransaction',
    'loyaltyConfig',
    'rateAlert',
    'scheduledTransfer',
    'promotionUse',
    'promotion',
    'commissionTier',
    'commissionConfig',
    'ledgerEntry',
    'wallet',
    'withdrawal',
    'transaction',
    'beneficiary',
    'user',
    'agency',
    'treasurySnapshot',
    'exchangeRateHistory',
    'exchangeRate',
    'countryCurrency',
    'client',
    'tenant',
  ];

  for (const model of cleanupOps) {
    try {
      if (prisma[model]) {
        await prisma[model].deleteMany();
      }
    } catch (e) {
      console.log(`   ↳ skip ${model}: ${(e && e.message ? e.message : e).toString().substring(0, 80)}`);
    }
  }

  console.log('🌱 DÉBUT DU SEEDING...\n');

  // ========================================================
  // 1. COUNTRY ↔ CURRENCY MAP
  // ========================================================
  console.log('🌍 Insertion CountryCurrency map...');
  for (const cc of COUNTRY_CURRENCIES) {
    await prisma.countryCurrency.upsert({
      where: { countryCode: cc.countryCode },
      update: cc,
      create: { ...cc, isSupported: true },
    });
  }
  console.log(`   ✅ ${COUNTRY_CURRENCIES.length} pays mappés\n`);

  // ========================================================
  // 2. TENANT DONIKO
  // ========================================================
  if (prisma.tenant) {
    await prisma.tenant.create({
      data: {
        code: 'DONIKO',
        name: 'Tenant Doniko (Platform)',
        isActive: true,
      },
    });
    console.log('✅ TENANT DONIKO créé\n');
  }

  // ========================================================
  // 3. CLIENT PLATEFORME (DONIKO)
  // ========================================================
  const doniko = await prisma.client.create({
    data: {
      code: 'DONIKO',
      name: 'Doniko SAS',
      primaryColor: '#DC2626',
      secondaryColor: '#1E40AF',
      timezone: 'Europe/Paris',
      locale: 'fr-FR',
      defaultCurrency: 'EUR',
      country: 'FR',
      city: 'Paris',
      subscriptionType: SubscriptionType.PURCHASE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      email: 'contact@doniko.com',
      phone: '+33600000000',
      address: 'Paris, France',
      allowedCurrencies: ['XOF', 'EUR', 'USD', 'GNF', 'GBP'],
      featureScheduledTransfers: true,
      featureRateAlerts: true,
      featureLoyaltyPoints: true,
      requireKyc: false,
    },
  });
  console.log('✅ CLIENT DONIKO créé\n');

  // ========================================================
  // 4. WALLETS PLATEFORME — 5 devises pour DONIKO
  // ========================================================
  const platformCurrencies = ['XOF', 'EUR', 'USD', 'GNF', 'GBP'];
  for (const cur of platformCurrencies) {
    await prisma.wallet.create({
      data: {
        clientId: doniko.id,
        currency: cur,
        balance: 0,
        isDefault: cur === 'EUR',
        isActive: true,
      },
    });
  }
  console.log(`💼 5 wallets plateforme créés (${platformCurrencies.join(', ')})\n`);

  // ========================================================
  // 5. SUPER ADMIN (UNIQUEMENT)
  // ========================================================
  const password = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);

  const superAdmin = await prisma.user.create({
    data: {
      email: SUPER_ADMIN_EMAIL,
      password,
      firstName: 'Thierno',
      lastName: 'Doniko',
      role: Role.SUPER_ADMIN,
      clientId: doniko.id,
      country: 'FR',
      city: 'Paris',
      primaryCurrency: 'EUR',
      jobTitle: 'Super Administrateur',
      isEmailVerified: true,
      isActive: true,
      kycLevel: KycLevel.LEVEL_3,
      preferredLanguage: 'fr',
      referralCode: 'DONIKO001',
    },
  });

  // Wallet personnel du Super Admin (EUR)
  await prisma.wallet.create({
    data: {
      userId: superAdmin.id,
      currency: 'EUR',
      balance: 0,
      isDefault: true,
      isActive: true,
    },
  });

  console.log('✅ SUPER ADMIN créé');
  console.log(`   👤 Email      : ${SUPER_ADMIN_EMAIL}`);
  console.log(`   🔑 Password   : ${SUPER_ADMIN_PASSWORD}`);
  console.log(`   💼 Wallet EUR : créé\n`);

  // ========================================================
  // 6. TAUX DE CHANGE (5 devises × paires importantes)
  // ========================================================
  console.log('💱 Insertion taux de change...');
  for (const r of EXCHANGE_RATES) {
    await prisma.exchangeRate.upsert({
      where: { pair: r.pair },
      update: { rate: r.rate, inverseRate: r.inverseRate },
      create: {
        pair: r.pair,
        rate: r.rate,
        inverseRate: r.inverseRate,
        source: 'manual',
      },
    });
  }
  console.log(`   ✅ ${EXCHANGE_RATES.length} paires de taux créées\n`);

  // ========================================================
  // 7. CONFIG FIDÉLITÉ DONIKO (optionnel)
  // ========================================================
  await prisma.loyaltyConfig.create({
    data: {
      clientId: doniko.id,
      pointsPerEuro: 1.0,
      euroPerPoint: 0.01,
      bronzeThreshold: 0,
      silverThreshold: 1000,
      goldThreshold: 5000,
      platinumThreshold: 20000,
      isActive: true,
    },
  });
  console.log('🎁 LoyaltyConfig DONIKO créé\n');

  // ========================================================
  // RÉCAP
  // ========================================================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 SEEDING TERMINÉ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 ${COUNTRY_CURRENCIES.length} pays mappés (devise auto)`);
  console.log(`💱 ${EXCHANGE_RATES.length} paires de taux`);
  console.log(`💼 5 wallets plateforme (XOF, EUR, USD, GNF, GBP)`);
  console.log(`👤 1 Super Admin`);
  console.log('');
  console.log('🎯 PROCHAINES ÉTAPES (via UI) :');
  console.log('   1. Créer une société cliente (formulaire Super Admin)');
  console.log('   2. Créer un admin société pour cette société');
  console.log('   3. Créer une agence + son agent');
  console.log('   4. Créer un client final via inscription');
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