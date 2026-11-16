# Direct Transf'air — backend (NestJS)

API de la plateforme : NestJS 10, Prisma 5 (PostgreSQL), multi-sociétés (tenants), authentification JWT + refresh token,
trésorerie, transferts, wallets, KYC, comptes marchands, contrats, domaines de portail.

Ce dossier fait partie du monorepo pnpm (`apps/backend`, `apps/web-admin`, `apps/direct-transfair-mobile`, `packages/shared`).
Les commandes ci-dessous se lancent **depuis la racine du dépôt** (ou avec `pnpm --filter direct-transfair-backend <script>`).

## Démarrage local

```bash
pnpm install                       # lance aussi « prisma generate » (client principal + client plateforme)
pnpm db:up                         # PostgreSQL 16 en Docker (docker-compose.yml)
cp apps/backend/.env.example apps/backend/.env   # puis renseigner DATABASE_URL, DIRECT_URL, DATABASE_URL_PLATFORM, JWT_SECRET…
pnpm prisma:migrate                # applique les migrations (base principale)
pnpm prisma:seed                   # jeu de données initial (voir SEED_* dans .env.example)
pnpm dev:backend                   # http://localhost:3000/api   (Swagger : /swagger hors production)
```

Contrôle de santé : `GET /api/health`.

## Scripts (`apps/backend/package.json`)

| Script | Rôle |
|---|---|
| `dev` / `dev:watch` | démarrage de développement (ts-node / tsx) |
| `build` | compile dans `dist/` et copie le client Prisma « plateforme » généré |
| `start:prod` | `node dist/main.js` |
| `test` / `test:ci` | tests unitaires Jest (aucune base de données requise) |
| `prisma:generate`, `prisma:platform:generate` | régénère les clients Prisma |
| `prisma:migrate`, `prisma:deploy` | migrations de la base principale (dev / production) |
| `prisma:platform:migrate`, `prisma:platform:deploy` | migrations de la base « plateforme » |
| `prisma:seed`, `prisma:reset`, `prisma:studio` | jeu de données, remise à zéro (dev), interface graphique |

## Deux bases de données

- **Base principale** (`DATABASE_URL`, `DIRECT_URL`) — `prisma/schema.prisma`, migrations dans `prisma/migrations/`.
- **Base plateforme** (`DATABASE_URL_PLATFORM`) — `prisma-platform/schema.prisma`, migrations dans `prisma-platform/migrations/`.
  Son client est généré dans `src/platform/generated/` (dossier ignoré par git : ne jamais le committer).

## Déploiement (Render)

1. Commandes attendues côté Render : build `pnpm install && pnpm build:backend`, démarrage `pnpm start:backend:prod` (scripts de la racine).
2. **Appliquer les migrations avant (ou juste après) la mise en ligne du code qui en dépend** — elles ne sont pas lancées
   automatiquement au démarrage :
   ```bash
   cd apps/backend
   npx prisma migrate deploy                                            # base principale
   npx prisma migrate deploy --schema prisma-platform/schema.prisma     # base plateforme, si une migration plateforme est livrée
   ```
3. Variables d'environnement : voir `.env.example` (chaque variable y est documentée, avec sa valeur par défaut).
   Au minimum : `DATABASE_URL`, `DIRECT_URL`, `DATABASE_URL_PLATFORM`, `JWT_SECRET` (32 caractères), `NODE_ENV=production`,
   `CORS_ORIGINS` / `FRONTEND_URL`, `CORS_ALLOWED_SUFFIXES=` (vide), `TZ=Africa/Conakry`.

## Migrations : règles

- Nom du dossier : `AAAAMMJJHHMMSS_description_en_minuscules`. **Jamais de date future** : une migration datée dans le futur est
  triée après celles que Prisma créera ensuite. La CI (`.github/workflows/ci.yml`) refuse les noms invalides ou datés de plus de 12 h dans le futur.
- Ne jamais renommer ni modifier une migration déjà appliquée en production. Si un renommage est inévitable, il faut aussi
  mettre à jour la colonne `migration_name` de la table `_prisma_migrations` (voir `renommer-migrations-prod.sql` livré avec le lot d'audit).
- La CI rejoue toutes les migrations sur une base PostgreSQL vide à chaque push.

## Tâches planifiées et plusieurs instances

Les tâches `@nestjs/schedule` (expiration des codes de retrait, des demandes marchandes, vérification des domaines, snapshot de trésorerie)
tournent sur **chaque** instance. Avec plusieurs instances, couper les doublons : `PICKUP_EXPIRY_CRON=false`, `MERCHANT_EXPIRY_CRON=false`,
`PORTAL_DOMAINS_CRON=false` sur toutes sauf une.
