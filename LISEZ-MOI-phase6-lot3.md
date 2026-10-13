# Phase 6 — Lot 3 : passe 2 (fuites entre sociétés et accès) — à appliquer après les lots 2a, 2b et 2c

## Contenu du zip

- 14 fichiers **complets** + `RAPPORT-phase6-passe2.md` (constats par gravité, décisions à prendre).
- Aucune migration, aucune suppression, pas de changement dans web-admin ni shared.
- `auth.controller.ts` contient aussi les changements du lot 1.

## Ce qui change

- **`/admin/tenants` réservé au super admin** (avant : n'importe quel admin de société pouvait lister les bases de toutes les sociétés avec leur mot de passe, en désactiver, ou provisionner vers une base de son choix). Les adresses de base ne sortent plus avec leur mot de passe ; code, URL et nom de base sont validés.
- **`GET /locations`** : agences de la seule société de l'en-tête `x-tenant-id` (avant : toutes les sociétés, sans authentification).
- **Mobile, écran « Agences »** : n'appelle plus que `/locations` (il était cassé pour les clients). Plus d'email d'agence affiché.
- **`GET /agencies` et `/agencies/:id`** : administrateurs seulement (un agent voyait les soldes des autres caisses).
- **Jeton push** : un jeton n'appartient qu'à un compte ; champs de `POST /auth/devices` validés.
- **`PATCH /users/:id`** : corps validé, email en minuscules.
- **Réinitialisation du mot de passe d'un agent** : ses sessions ouvertes sont fermées.

## ⚠️ À savoir

- Un client ou un agent qui appelait `/agencies` ne l'aura plus (rien dans tes applications ne le faisait, hormis l'écran « Agences » corrigé ici).
- `/locations` exige l'en-tête `x-tenant-id` (le mobile l'envoie déjà). Un appel sans en-tête renvoie une liste vide.
- Aucune migration. Après copie : `pnpm build` dans `apps/backend`.

## Vérifications faites

- Backend : `tsc --noEmit` propre (hors module `platform`) ; **23 suites, 189 tests** au vert (nouveaux : accès `/admin/tenants` par rôle et masquage des mots de passe, `/locations`, appareils push, réinitialisation d'agent). Mobile : `tsc --noEmit` propre.
- Pas de base de données ici : tests sur base simulée.
