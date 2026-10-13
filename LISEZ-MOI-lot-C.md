# Lot C — Un domaine par société de transfert

Chaque société de transfert obtient l'adresse de son portail web (celui de ses administrateurs et agents), avec **ses couleurs et son logo** : le portail la reconnaît par son adresse (`GET /branding/by-host`, déjà en place). Ce lot ajoute ce qui manquait : **configurer le DNS et l'hébergeur automatiquement et suivre l'avancement jusqu'à la mise en ligne.**

Tout se pilote depuis la console, côté « sociétés de transfert » : menu **Domaines** (une carte par société).

## Deux façons d'attribuer une adresse
1. **Sous-domaine de la plateforme** — `flash.dkmoney.store`. En ligne en quelques minutes : la plateforme crée l'enregistrement DNS dans la zone `dkmoney.store` et rattache l'adresse à l'hébergeur. Rien à demander à la société.
2. **Domaine propre** — `flash-transfer.com` (ou `portail.flash-transfer.com`).
   - **DNS géré par la plateforme** : la zone est créée chez Cloudflare, la carte affiche les **2 nameservers à copier** ; la société les saisit chez son registrar. Dès qu'ils sont actifs, les enregistrements sont posés tout seuls. ⚠️ À réserver aux domaines neufs : les enregistrements existants du domaine (email, site) **ne sont pas repris**.
   - **DNS géré par la société** : la carte affiche les enregistrements **A / CNAME à ajouter** chez son gestionnaire DNS (à utiliser pour un domaine déjà en service).

Le domaine nu et `www` sont servis tous les deux (un seul est enregistré, l'autre est reconnu automatiquement).

## Suivi de statut
`Nameservers à pointer` → `Validation en cours` → `Actif` (ou `En erreur`, avec le message). Le serveur vérifie toutes les 5 minutes (rythme ralenti après 48 h d'attente), relance les erreurs avec une attente croissante (5 min, 10, 20… jusqu'à 6 h, 8 tentatives par défaut) et recontrôle les domaines actifs une fois par jour (si le DNS est modifié, la carte repasse en « Validation en cours »). Le bouton **Vérifier** relance tout de suite. L'écran se rafraîchit seul tant qu'un domaine n'est pas actif.

## Ce qui est livré
**Backend Direct Transf'air** (`direct-transfair/apps/backend/`)
- `prisma/schema.prisma` + `prisma/migrations/20261013110000_add_portal_domains/` : table `client_portal_domains` (isolée, sans clé étrangère), 3 enums, 2 actions d'audit. Migration additive, rejouée sur un vrai Postgres.
- `src/portal-domains/` : module neuf (règles de nommage, clients Cloudflare et Vercel, service, contrôleur `/portal-domains`, planificateur, tests). Réservé au `SUPER_ADMIN`.
- `src/clients/clients.service.ts` : un domaine propre est reconnu avec ou sans `www`.
- `src/main.ts` : CORS autorise aussi les sous-domaines `<sous-domaine>.PORTAL_BASE_DOMAIN` (sans cela le portail d'un sous-domaine serait bloqué).
- `src/app.module.ts` : import du module.

**Web-admin et partagé** (`direct-transfair/`)
- `packages/shared/src/{portalDomains,api,index}.ts`
- `apps/web-admin/src/pages/portal-domains/PortalDomainsPage.tsx`, `lib/portalDomainRules.ts`, `styles/{portal-domains,index}.css`, `modules.tsx`, `navigation.ts`, `pages/companies/CompanyDetailPage.tsx` (le bloc « Portail web » renvoie vers « Domaines »).

Aucun changement côté LCD pour ce lot.

## Déploiement
1. Copie les fichiers du dossier `direct-transfair/`, puis `prisma migrate deploy` et `prisma generate` dans `apps/backend`.
2. **Variables du backend Direct Transf'air** (aucune n'est en dur) :

| Variable | Rôle |
|---|---|
| `PORTAL_VERCEL_PROJECT_ID` | projet Vercel des **portails de sociétés** (le web-admin servi à la racine — pas celui de `/transfert`) |
| `VERCEL_API_TOKEN`, `VERCEL_TEAM_ID` | accès Vercel (équipe optionnelle) |
| `CLOUDFLARE_API_TOKEN` | jeton Cloudflare à droits limités : *Zone → Zone → Edit* et *Zone → DNS → Edit* (recommandé). Repli : `CLOUDFLARE_EMAIL` + `CLOUDFLARE_GLOBAL_KEY` |
| `CLOUDFLARE_ACCOUNT_ID` | compte où créer les zones des domaines propres |
| `PORTAL_BASE_DOMAIN` | `dkmoney.store` — active les sous-domaines (sa zone doit être **active** dans le même compte Cloudflare ; elle n'est jamais créée par le code) |
| `PORTAL_RESERVED_SUBDOMAINS` | libellés interdits (par défaut : www, api, admin, console, transfert, mail…) |
| `PORTAL_MULTIPART_SUFFIXES` | suffixes à deux niveaux (co.uk, com.gn…) pour retrouver le domaine enregistrable |
| `PORTAL_DNS_A_TARGET`, `PORTAL_DNS_CNAME_TARGET` | cibles DNS (par défaut `76.76.21.21` et `cname.vercel-dns.com`) |
| `PORTAL_DOMAINS_CRON` | `false` coupe la vérification planifiée |
| `PORTAL_DOMAINS_MAX_ATTEMPTS` | tentatives automatiques avant action manuelle (défaut 8) |

   `PLATFORM_CONSOLE_HOSTS` (lot B) reste nécessaire : ces hôtes ne peuvent jamais être attribués à une société.
3. **Vercel** : ne mets **pas** de domaine générique `*.dkmoney.store` sur le projet LCD (il capterait les sous-domaines des sociétés). Chaque adresse est rattachée individuellement au projet des portails.
4. Si tu n'as qu'un process Direct Transf'air, le planificateur interne suffit ; avec plusieurs instances, un verrou par domaine évite les doublons.

## Sécurité et garde-fous
- Un hôte de la plateforme (console, site vitrine, `dkmoney.store` et ses sous-domaines côté « domaine propre », `*.vercel.app`…) ne peut pas être attribué comme domaine propre. Pas d'adresse IP, pas de libellé invalide.
- Un domaine déjà pris par une autre société (avec ou sans `www`) est refusé (409). Un domaine déjà rattaché à un autre projet Vercel produit un message explicite.
- Changer de domaine détache l'ancien de Vercel ; retirer un sous-domaine supprime aussi son CNAME. Les enregistrements d'un domaine **propre** restent en place (ils appartiennent à la société). Un échec de détachement devient un avertissement, jamais un blocage.
- Aucun jeton n'apparaît dans les messages d'erreur. Chaque attribution / retrait est dans le journal d'audit.

## Vérifications faites
- Backend DT : `tsc` propre ; **312 tests verts** (65 nouveaux : règles de domaine, machine d'états complète, conflits, erreurs fournisseurs, verrou, planification, clients Cloudflare/Vercel) ; migration rejouée sur Postgres 16.
- Web-admin : `tsc` propre, build Vite ; **26 vérifications Playwright** (liste, filtres, copie des nameservers, édition avec erreurs locales et serveur, domaine propre, DNS externe, vérification, retrait avec avertissement, échec, mobile 390 px sans défilement horizontal).
- Limites : Cloudflare et Vercel ont été simulés (pas de compte réel ici) — fais un premier essai avec un sous-domaine de test (`test-lot-c.dkmoney.store`) avant un domaine client. La base réelle n'a pas été interrogée par le service (Prisma sans moteur ici) ; la migration l'a été.

## Reste de ton côté
- Les décisions restées ouvertes plus tôt : liste CORS restreinte de Direct Transf'air, Swagger coupé en production, `BLOCK_SIMULATED_RECHARGES=true` au lancement, vérification de l'IP réelle derrière le proxy.
