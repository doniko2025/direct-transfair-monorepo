# Lot « audit » — corrections (16 novembre)

## Ordre d'application

1. **Copier le contenu du zip à la racine du dépôt** (les fichiers existants sont remplacés par leur version complète).
2. **Lancer `bash supprimer-fichiers-audit.sh`** (Git Bash, racine du dépôt). Il retire les anciens dossiers de migration, la config EAS de
   la racine, ~68 fichiers de code mort du mobile, le client Prisma versionné par erreur (20 Mo) et les configs d'hébergeurs abandonnés.
   Ni commit ni push : tu relis `git status`, puis tu valides toi-même.
3. **Base de production — seulement si ces 6 migrations y sont déjà appliquées** : exécuter `renommer-migrations-prod.sql` sur la base
   principale (`DATABASE_URL`) **avant** le prochain `prisma migrate deploy`. Sans cela, Prisma verrait 6 « nouvelles » migrations et
   tenterait de les rejouer (certaines, comme `exchange_rates_per_company`, ne sont pas rejouables). Si elles ne sont pas encore appliquées, le script est sans effet.
4. **Render (variables)** : vérifier `CORS_ORIGINS` / `FRONTEND_URL` (adresses exactes des portails), puis définir `CORS_ALLOWED_SUFFIXES=` (vide).
   Tant qu'elle n'est pas définie, tout site `*.vercel.app` reste autorisé à appeler l'API.
5. **Mobile** : `app.json` change (permissions Android) → **nouveau build natif EAS** nécessaire (pas de simple mise à jour OTA).

## Ce qui change

| Sujet | Changement |
|---|---|
| Migrations | 6 dossiers renommés `20261116090000…20261121090000` → `20261115100000…20261115150000` (même ordre, contenu SQL strictement identique). Références mises à jour dans `LISEZ-MOI.txt` et 3 fichiers de `docs/`. |
| CI | Nouveau contrôle : nom de migration `AAAAMMJJHHMMSS_nom` et jamais daté dans le futur (tolérance 12 h). |
| EAS | Projet de production = celui de `apps/direct-transfair-mobile` (`com.doniko.directtransfair`). `app.json` et `eas.json` de la racine (`com.dftransfer…`) supprimés. Le profil `production` reçoit les mêmes variables `EXPO_PUBLIC_*` que `preview`. |
| Permissions Android | `RECORD_AUDIO` et `WRITE_CONTACTS` bloquées (aucun usage : l'app ne lit que les contacts et ne filme pas). |
| Mobile | `babel.js` → `babel.config.js` (l'ancien nom n'était pas lu par Metro). Nouveau `.env.example` (toutes les variables `EXPO_PUBLIC_*` avec leur défaut). |
| Backend | `main.ts` v2.9 : `.railway.app` retiré du CORS par défaut ; message d'avertissement plus précis. `.env.example` corrigé (CORS, chemin Swagger). `README.md` réel à la place du texte Nest. |
| Divers | `.gitignore` : `!.env.example` (sinon les modèles de config sont ignorés par `.env*`). `tsconfig.base.json` : alias vers des paquets inexistants retirés. `docs/PLATFORM-CONFIG.md` : variable `EXPO_PUBLIC_FALLBACK_RATES` (inexistante dans le code) retirée. |

## Vérifié

- Typage de l'app mobile après suppressions : `tsc --noEmit` = 0 erreur (163 fichiers contrôlés).
- Analyse des imports : aucun fichier conservé n'importe un fichier supprimé ; aucune route conservée ne pointe vers un écran supprimé.
- Les 6 `migration.sql` renommés ont la même empreinte que ceux du dernier commit.
- Non exécuté ici : le typage et les tests du backend (le téléchargement des moteurs Prisma est bloqué dans l'environnement). La CI GitHub les rejouera.

## Volontairement NON modifié

- **Contournement « DEV » de la vérification du téléphone** (`v2-auth.service.ts`, `verify-contact.tsx`) : le réactiver touche aussi `auth.service.ts` (v1),
  `account-verified.guard.ts`, `AuthProvider.tsx` et exige que le SMS (Twilio) fonctionne, sinon plus personne ne peut s'inscrire. À traiter dans un lot dédié.
- Workflow `keep-alive.yml` : GitHub ne le lance que 3-4 fois par jour. Remplacer par un ping externe (UptimeRobot / cron-job.org, toutes les 10 min sur `/api/health`).
- Doublons (3 API de taux, auth v1/v2, tables pays → devise), 12 modèles Prisma inutilisés : demandent des décisions de ta part.
