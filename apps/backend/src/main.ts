// apps/backend/src/main.ts
// =========================================================
// ✅ v2.7 (phase 7) : titre et description Swagger lus dans la configuration plateforme (PLATFORM_NAME).
// MAIN v2.7
// ✅ v2.6 : SÉCURITÉ — Swagger n'est plus public en production : désactivé par défaut quand NODE_ENV=production,
//   réactivable avec SWAGGER_ENABLED=true (en développement il reste actif, SWAGGER_ENABLED=false le coupe).
//   Avertissement au démarrage si, en production, CORS_ALLOWED_SUFFIXES n'est pas défini (le défaut historique
//   « .vercel.app,.railway.app » autorise TOUT site hébergé chez ces fournisseurs) — comportement inchangé, à restreindre.
// ✅ v2.5 : CORS — plus AUCUN domaine en dur (retrait de direct-transfair.eu / www.direct-transfair.eu, ancien site
//   vitrine). Plateforme multi-tenant : les origines autorisées viennent uniquement des variables d'environnement
//   (FRONTEND_URL / CORS_ORIGINS, PLATFORM_CONSOLE_HOSTS, PORTAL_BASE_DOMAIN) et des domaines des sociétés lus en base. Nouvelles variables : CORS_ORIGINS (origines exactes, séparées par des
//   virgules ; FRONTEND_URL est ajoutée), CORS_ALLOWED_SUFFIXES (défaut « .vercel.app,.railway.app » = comportement
//   précédent ; vide = aucun suffixe, recommandé en production), CORS_ALLOW_LOCALHOST (défaut true ; « false » = refuse
//   localhost). Les deux adresses Vercel/Railway codées en dur sont retirées (couvertes par les suffixes ou CORS_ORIGINS).
// ✅ v2.4 : CORS — les sous-domaines de portail (<sous-domaine>.PORTAL_BASE_DOMAIN) des sociétés sont autorisés en plus de
//   leurs domaines propres (lot C : sans cela le portail d'une société servi sur son sous-domaine était bloqué par CORS).
// ✅ v2.3 : CORS — PLATFORM_CONSOLE_HOSTS (ex. dkmoney.store,www.dkmoney.store) : domaines de la console du
//   Grand Chef, qui sert ce back-office sous /transfert. Liste vide par défaut : comportement inchangé.
// ✅ v2.2 (phase 6, passe 3) : « trust proxy ». Derrière Railway, sans cette option Express voit l'adresse du
//   proxy comme adresse du client : le rate limiting (100 req/min, 5 connexions/min) était partagé par TOUS les
//   utilisateurs de la plateforme, et les journaux de connexion enregistraient l'IP du proxy. En production on
//   fait confiance à 1 proxy (Railway) ; TRUST_PROXY_HOPS=<n> ajuste (0 = désactivé, ex. derrière Cloudflare : 2).
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
import { platform } from './common/platform.config';
import { PrismaService } from './prisma/prisma.service'; // ✅ v2.1

// =========================================================
// ✅ v2.1 : CORS dynamique — domaines personnalisés clients
// =========================================================

// Domaines connus dès le déploiement, indépendants du cache DB —
// filet de sécurité immédiat (fonctionne même si le premier
// rafraîchissement échoue ou n'a pas encore eu lieu).
// ✅ v2.5 : vide au départ, rempli uniquement depuis PLATFORM_CONSOLE_HOSTS (aucun domaine en dur).
const STATIC_KNOWN_HOSTNAMES = new Set<string>();

// ✅ v2.3 : domaines de la console du Grand Chef (variable d'environnement, jamais en dur)
for (const h of (process.env.PLATFORM_CONSOLE_HOSTS ?? '').split(',')) {
  const host = h.trim().toLowerCase();
  if (host) STATIC_KNOWN_HOSTNAMES.add(host);
}

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
    const portalBase = (process.env.PORTAL_BASE_DOMAIN ?? '').trim().toLowerCase().replace(/^\.+|\.+$/g, '');
    const clients = await prisma.client.findMany({
      where:  {
        isActive: true,
        OR: [{ customDomain: { not: null } }, ...(portalBase ? [{ subdomain: { not: null } }] : [])],
      },
      select: { customDomain: true, subdomain: true },
    });

    const next = new Set<string>();
    for (const c of clients) {
      if (portalBase && c.subdomain) next.add(`${c.subdomain.toLowerCase()}.${portalBase}`);
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

  // ✅ v2.2 : adresse IP réelle du client (rate limiting, journaux de connexion)
  const configuredHops = process.env.TRUST_PROXY_HOPS;
  const proxyHops =
    configuredHops !== undefined && configuredHops.trim() !== ''
      ? Number(configuredHops)
      : process.env.NODE_ENV === 'production'
        ? 1
        : 0;
  if (Number.isInteger(proxyHops) && proxyHops > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', proxyHops);
  }

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
      // ✅ v2.5 : tout vient de l'environnement, relu à chaque requête (aucun changement de code pour ajouter un domaine)
      const listEnv = (v: string | undefined): string[] =>
        (v ?? '').split(',').map((s) => s.trim().replace(/\/+$/, '').toLowerCase()).filter(Boolean);

      const allowedOrigins = [...listEnv(process.env.CORS_ORIGINS), ...listEnv(process.env.FRONTEND_URL)];
      const allowedSuffixes =
        process.env.CORS_ALLOWED_SUFFIXES === undefined
          ? ['.vercel.app', '.railway.app'] // comportement historique, à restreindre en production
          : listEnv(process.env.CORS_ALLOWED_SUFFIXES);
      const allowLocalhost = (process.env.CORS_ALLOW_LOCALHOST ?? 'true').trim().toLowerCase() !== 'false';

      const hostname = origin ? extractHostname(origin) : null;
      const originLc = origin ? origin.replace(/\/+$/, '').toLowerCase() : null;

      const isAllowed =
        !origin ||
        (originLc !== null && allowedOrigins.includes(originLc)) ||
        (allowLocalhost && hostname !== null && (hostname === 'localhost' || hostname === '127.0.0.1')) ||
        (hostname !== null && allowedSuffixes.some((s) => hostname.endsWith(s))) ||
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
      'x-app-client', // ✅ phase 5 : le portail web s'identifie (voir auth/app-client.policy.ts)
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
  const isProduction = process.env.NODE_ENV === 'production';
  const swaggerFlag = (process.env.SWAGGER_ENABLED ?? '').trim().toLowerCase();
  const swaggerEnabled = swaggerFlag ? swaggerFlag === 'true' : !isProduction;

  if (isProduction && process.env.CORS_ALLOWED_SUFFIXES === undefined) {
    console.warn(
      "⚠️  [CORS] CORS_ALLOWED_SUFFIXES n'est pas défini : « .vercel.app » et « .railway.app » restent autorisés (tout site hébergé là). " +
      'Définis CORS_ORIGINS / FRONTEND_URL puis CORS_ALLOWED_SUFFIXES= (vide) pour restreindre.',
    );
  }

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle(`${platform.name} API`)
      .setDescription(`Documentation officielle du backend ${platform.name}`)
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' }, 'access-token')
      .addApiKey({ type: 'apiKey', name: 'x-tenant-id', in: 'header' }, 'x-tenant-id')
      .build();

    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('swagger',     app, swaggerDocument);
    SwaggerModule.setup('api/swagger', app, swaggerDocument);
  }

  // =========================================================
  // START
  // =========================================================
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Backend démarré sur le port ${port}`);
  console.log(swaggerEnabled ? `📚 Swagger : http://localhost:${port}/swagger` : '📚 Swagger désactivé (SWAGGER_ENABLED=true pour l\'activer)');
}

void bootstrap();