# Phase 5 — Mobile réservé aux clients (rôle USER)

## Contenu du zip

- 17 fichiers complets à copier à leur emplacement (chemins relatifs à la racine du dépôt).
- `supprimer-fichiers-phase5.sh` : supprime les 44 fichiers du mobile réservés au web (liste dans `fichiers-supprimes.txt`). À lancer à la racine du dépôt.

## Ce qui change

**Backend** (`apps/backend`)
- Nouveau `src/auth/app-client.policy.ts` : les rôles `SUPER_ADMIN`, `COMPANY_ADMIN` et `AGENT` ne peuvent ouvrir ni renouveler de session que si la requête porte l'en-tête `x-app-client: web`. Sinon : `403` avec `code: "USE_WEB_PORTAL"` et un message qui renvoie vers le portail web. Le rôle `USER` n'est jamais concerné.
- Chemins verrouillés : `/auth/v2/login-password`, `/auth/v2/request-otp-email`, `/auth/v2/request-otp-phone`, `/auth/v2/verify-otp-login`, `/auth/login`, `/auth/login-by-phone`, `/auth/login/verify-otp`, `/auth/refresh`, `/auth/register` (inscription d'un `AGENT`).
- Le contrôle de `login-password` se fait **après** la vérification du mot de passe (pas de fuite du rôle à un appelant non authentifié).
- `main.ts` : `x-app-client` ajouté aux en-têtes CORS autorisés.

**Web** (`packages/shared`, `apps/web-admin`)
- Le client HTTP partagé accepte l'option `appClient` ; le web-admin l'active avec `'web'` (envoyé sur toutes les requêtes, refresh compris).

**Mobile** (`apps/direct-transfair-mobile`)
- 44 fichiers supprimés : `app/(tabs)/admin/**`, `app/agent/**`, `app/(tabs)/agencies`, `app/(tabs)/withdraw.tsx`, dashboards agent / admin société / super admin, `RefillAgencyModal`, `CommissionFilter`, `useAdminRoute`, `personal-info-{admin,agent,super-admin}`.
- Onglets, accueil, historique, détail d'une transaction et profil : parcours client uniquement.
- `AuthProvider` : toute session d'un autre rôle est refusée et fermée (connexion, OTP, biométrie, inscription, restauration d'une session stockée par une ancienne version).
- `login-v2` : message « Compte réservé au portail web ».
- `services/api.ts` : 51 méthodes réservées aux rôles web retirées (trésorerie, agences, retraits d'agence, commissions, clients/sociétés, webhooks, clés API, taux admin…).
- Corrige au passage 4 erreurs TypeScript déjà présentes dans `AuthProvider` (`segments[1]`).

## Ordre de déploiement (important)

1. **Web-admin d'abord** (il envoie l'en-tête `x-app-client: web`).
2. **Backend ensuite.** Si le backend passe avant, les admins et agents du web sont bloqués tant que le web n'est pas à jour.
3. Application mobile : nouvelle version via EAS / le web mobile.

## Comportement pour une ancienne version du mobile

- Un agent ou admin encore connecté sur l'ancienne app garde son jeton d'accès jusqu'à son expiration (1 h). Ensuite le renouvellement est refusé (`403 USE_WEB_PORTAL`) : la session ne peut plus se prolonger et il doit repasser par le portail web.
- Une nouvelle connexion depuis l'ancienne app est refusée avec le message du backend.
- Il n'y a pas de mécanisme de « version minimale » dans l'app actuelle : le contrôle côté serveur suffit, aucune version à imposer.

## Outils de test (Swagger, Postman, scripts)

Pour se connecter avec un compte agent / admin, ajouter l'en-tête `x-app-client: web`.

## Vérifications faites / à faire

- Mobile : `tsc --noEmit` sans erreur.
- Web-admin + `packages/shared` : `pnpm typecheck:web-admin` sans erreur.
- Politique d'accès : 28 cas testés (3 rôles × en-tête absent / vide / `mobile` / `web` / casse, rôle `USER`, rôle inconnu).
- **À faire chez toi : `pnpm build` dans `apps/backend`.** Je n'ai pas pu compiler le backend ici (téléchargement des moteurs Prisma bloqué, donc pas de client Prisma généré). Les fichiers modifiés ne remontent aucune erreur propre à mes changements, mais seul ton build le confirme.

## Constats pour la phase 6 (non modifiés ici)

1. **`POST /auth/register` accepte `role: "AGENT"`** (route publique, `RegisterDto.role` est un `@IsEnum(Role)`) : n'importe qui peut s'auto-créer un compte agent. Depuis la phase 5 il faut l'en-tête `web`, mais il est déclaratif : la vraie correction est d'ignorer `role` à l'inscription publique.
2. L'en-tête `x-app-client` sépare les publics, il ne remplace pas les contrôles `@Roles` côté API.
3. `hooks/useProtectedRoute.ts` (mobile) n'est utilisé nulle part et lit `loading` / `isAuthenticated`, qui n'existent pas dans `useAuth()`.
4. « Préférences de notifications » n'était accessible que depuis la section « ADMINISTRATION » du profil, désormais supprimée : l'écran existe toujours mais n'est plus relié au menu. À rajouter dans « MON COMPTE » si tu le veux pour les clients.
5. `profile/locations.tsx` essaie plusieurs routes d'agences et ignore les 401/403 : à vérifier que la route utilisée est bien ouverte aux clients.
6. Le dossier `apps/direct-transfair-mobile` contient des fichiers qui ressemblent à une copie du paquet `expo-router` (`_ctx*.js`, `drawer.js`, `rsc/`, `ios/ExpoHead*`, `vendor/react-helmet-async`…) : probablement à retirer.
7. Reste de rôles dans quelques écrans du profil (thèmes de couleurs par rôle dans `account`, `devices`, `locations`, `security`, `notifications`, `qr`) et types inutilisés dans `services/types.ts` : sans effet, nettoyage cosmétique possible.
