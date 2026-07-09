// apps/backend/src/main.ts
// =========================================================
// MAIN v2.1
// ✅ v1.0 : ValidationPipe, CORS, Swagger, TenantGuard
// ✅ v2.0 : Helmet (en-têtes HTTP sécurité)
//   Prérequis : npm install helmet
//   Active : X-Content-Type-Options, X-Frame-Options,
//            X-XSS-Protection, Strict-Transport-Security,
//            Content-Security-Policy, et autres.
//
// ✅ v2.1 : 🚨 FIX — CORS bloquait les domaines personnalisés clients
//
//   PROBLÈME RÉSOLU (juillet 2026) :
//   allowedOrigins était une liste figée en dur (Vercel/Railway/
//   localhost uniquement). Un client avec un domaine personnalisé
//   déjà vérifié côté DNS (ex: "www.direct-transfair.eu") obtenait
//   "Network Error" au login — pas un vrai rejet HTTP avec message
//   explicite, mais un blocage CORS côté navigateur AVANT même que
//   la requête n'atteigne /auth/login, puisque son origine ne
//   matchait ni la liste statique ni les suffixes .vercel.app /
//   .railway.app. Le même formulaire fonctionnait parfaitement via
//   l'URL Vercel brute, ce qui confirmait que ni le domaine ni le
//   backend lui-même n'étaient en cause — uniquement la politique
//   CORS.
//
//   CORRECTIF (deux niveaux) :
//   1. Le domaine connu de Doniko est ajouté directement à la liste
//      statique (STATIC_KNOWN_HOSTNAMES) — débloque immédiatement,
//      sans dépendre du cache dynamique.
//   2. En plus de la liste statique (infra fixe), l'origine est
//      désormais aussi vérifiée contre un cache en mémoire des
//      Client.customDomain actifs en base (table déjà utilisée par
//      getBrandingByHost() pour le branding par hostname), rafraîchi
//      toutes les 5 minutes. Direct Transf'air étant une plateforme
//      multi-tenant où CHAQUE client peut configurer son propre
//      domaine, une liste statique aurait fait revivre ce même
//      blocage à chaque nouveau client — nécessitant une modification
//      de ce fichier + un redéploiement à chaque fois. Avec ce cache,
//      un client qui configure son domaine personnalisé devient
//      automatiquement autorisé, sans toucher au code. Le cache
//      tolère les deux variantes avec/sans "www." (évite un piège de
//      saisie si le domaine est enregistré sans www mais visité avec,
//      ou l'inverse). En cas d'indisponibilité momentanée de la DB au
//      rafraîchissement, le cache précédent est conservé (non
//      bloquant) plutôt que de vider la liste des domaines autorisés.
// =========================================================

import { ValidationPipe } from '@nestjs/common';
import { NestFactory }    from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet'; // ✅ v2.0 — npm install helmet

import { AppModule }     from './app.module';
import { TenantGuard }   from './tenants/tenant.guard';
import { PrismaService } from './prisma/prisma.service'; // ✅ v2.1

// =========================================================
// ✅ v2.1 : CORS dynamique — domaines personnalisés clients
// =========================================================

// Domaines connus dès le déploiement, indépendants du cache DB —
// filet de sécurité immédiat (fonctionne même si le premier
// rafraîchissement échoue ou n'a pas encore eu lieu).
const STATIC_KNOWN_HOSTNAMES = new Set<string>([
  'direct-transfair.eu',
  'www.direct-transfair.eu',
]);

const CUSTOM_DOMAIN_REFRESH_MS = 5 * 60 * 1000; // 5 min
let knownCustomDomains = new Set<string>();

function extractHostname(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

// Ajoute les deux variantes avec/sans "www." pour un hostname donné,
// pour éviter un piège de saisie (domaine enregistré sans www côté
// admin, mais DNS/visite avec www — ou l'inverse).
function withWwwVariants(hostname: string): string[] {
  const bare = hostname.replace(/^www\./, '');
  return [bare, `www.${bare}`];
}

async function refreshCustomDomains(prisma: PrismaService): Promise<void> {
  try {
    const clients = await prisma.client.findMany({
      where:  { customDomain: { not: null }, isActive: true },
      select: { customDomain: true },
    });

    const next = new Set<string>();
    for (const c of clients) {
      if (!c.customDomain) continue;
      const hostname =
        extractHostname(`https://${c.customDomain}`) ??
        c.customDomain.toLowerCase().trim();
      for (const variant of withWwwVariants(hostname)) next.add(variant);
    }

    knownCustomDomains = next;
  } catch (e) {
    // Non-bloquant : on garde le cache précédent si la DB est
    // temporairement indisponible, plutôt que de bloquer tous les
    // domaines personnalisés le temps d'un incident DB transitoire.
    console.error(
      '[CORS] Échec rafraîchissement domaines personnalisés (cache précédent conservé)',
      e,
    );
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // =========================================================
  // ✅ v2.0 : HELMET — En-têtes HTTP sécurité
  // Doit être le premier middleware appliqué
  // =========================================================
  app.use(
    helmet({
      // CSP permissif pour Swagger UI
      contentSecurityPolicy: {
        directives: {
          defaultSrc:  ["'self'"],
          scriptSrc:   ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
          styleSrc:    ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'fonts.googleapis.com'],
          imgSrc:      ["'self'", 'data:', 'cdn.jsdelivr.net'],
          connectSrc:  ["'self'"],
          fontSrc:     ["'self'", 'fonts.gstatic.com', 'data:'],
        },
      },
      // HSTS — force HTTPS pendant 1 an
      hsts: {
        maxAge:            31_536_000,
        includeSubDomains: true,
        preload:           true,
      },
      // Masquer "X-Powered-By: Express"
      hidePoweredBy: true,
    }),
  );

  // =========================================================
  // GLOBAL PREFIX
  // =========================================================
  app.setGlobalPrefix('api');

  // =========================================================
  // VALIDATION
  // =========================================================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:           true,
      transform:           true,
      forbidNonWhitelisted: false,
    }),
  );

  // =========================================================
  // CORS ✅ v2.1 : liste statique + domaines personnalisés dynamiques
  // =========================================================
  const prismaForCors = app.get(PrismaService);
  await refreshCustomDomains(prismaForCors); // cache chaud dès la 1ère requête
  setInterval(() => {
    void refreshCustomDomains(prismaForCors);
  }, CUSTOM_DOMAIN_REFRESH_MS).unref(); // .unref() : ne bloque pas l'arrêt propre du process

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:8081',
        'https://direct-transfair-monorepo-direct-tr.vercel.app',
        'https://direct-transfair-backend-production.up.railway.app',
      ];

      const hostname = origin ? extractHostname(origin) : null;

      const isAllowed =
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app')  ||
        origin.endsWith('.railway.app') ||
        (hostname !== null && STATIC_KNOWN_HOSTNAMES.has(hostname)) || // ✅ v2.1
        (hostname !== null && knownCustomDomains.has(hostname));       // ✅ v2.1

      if (isAllowed) callback(null, true);
      else callback(new Error(`CORS blocked: ${origin}`));
    },
    methods:        ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials:    true,
    allowedHeaders: [
      'Origin', 'X-Requested-With', 'Content-Type',
      'Accept', 'Authorization', 'x-tenant-id',
    ],
  });

  // =========================================================
  // GLOBAL GUARDS
  // =========================================================
  app.enableShutdownHooks();
  app.useGlobalGuards(app.get(TenantGuard));

  // =========================================================
  // SWAGGER
  // =========================================================
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Direct Transf'air API")
    .setDescription("Documentation officielle du backend Direct Transf'air")
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' }, 'access-token')
    .addApiKey({ type: 'apiKey', name: 'x-tenant-id', in: 'header' }, 'x-tenant-id')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger',     app, swaggerDocument);
  SwaggerModule.setup('api/swagger', app, swaggerDocument);

  // =========================================================
  // START
  // =========================================================
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Backend démarré sur le port ${port}`);
  console.log(`📚 Swagger : http://localhost:${port}/swagger`);
}

void bootstrap();