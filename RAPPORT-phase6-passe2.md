# Phase 6 — Scanner : rapport de la passe 2 (fuites entre sociétés et accès)

Modules lus en entier : users, beneficiaries, agencies, agents-admin, supervision, clients (+ branding), tenants, locations, rates, exchange-rates, notifications (+ canaux), push, mail (envoi et journal), sms, enregistrement des appareils.

Légende : ✅ corrigé dans le lot 3 · 🟡 à valider par toi (changement de comportement) · ⚪ noté, faible enjeu.

## Ce qui est propre

`supervision`, `agents-admin`, `beneficiaries`, `notifications` : toutes les requêtes sont limitées à la société (ou à l'utilisateur) de l'appelant, les rôles sont déclarés, les actions sensibles sont journalisées. Rien à corriger. Les routes `clients` sont réservées au super admin, sauf la lecture de sa propre société.

---

## CRITIQUE

### P1 — `/admin/tenants` ouvert à l'administrateur de n'importe quelle société ✅
Le contrôleur utilisait `AdminGuard`, qui laisse passer COMPANY_ADMIN. Un admin de société pouvait donc :
- **lister toutes les sociétés avec l'adresse de leur base de données, mot de passe compris** ;
- **désactiver n'importe quelle société** (`PATCH /admin/tenants/active`) ;
- **provisionner un « tenant » vers une base de son choix** : connexion `pg` vers l'hôte donné, `CREATE DATABASE`, puis `prisma migrate deploy` lancé sur cette adresse.

**Corrigé** : réservé au SUPER_ADMIN (`RolesGuard`). Par ailleurs, l'adresse de base n'est plus jamais renvoyée avec son mot de passe, le code de société, l'URL (postgres:// uniquement) et le nom de base (utilisé dans `CREATE DATABASE "…"`) sont validés.

## HAUT

| # | Constat | Statut |
|---|---|---|
| P2 | **`GET /locations` public et global** : sans authentification, renvoyait les agences (nom, adresse, téléphone) de TOUTES les sociétés, y compris à leurs concurrents. | ✅ limité à la société de l'en-tête `x-tenant-id` (liste vide sans en-tête ou société inconnue), agences supprimées exclues |
| P3 | **Écran mobile « Agences » cassé pour les clients** : il essayait `/agencies` (403 pour un client), puis `/agencies/public` qui n'existe pas (erreur) — la route publique `/locations`, jamais atteinte, était la bonne. | ✅ l'écran n'appelle plus que `/locations` |
| P4 | **`GET /agencies` et `/agencies/:id` ouverts aux agents** : un agent voyait les caisses (soldes) de toutes les autres agences de sa société et l'email / téléphone de leurs agents. Aucun écran agent ne les appelait. | ✅ réservés aux administrateurs |
| P5 | **Jeton push gardé par l'ancien compte** : si deux comptes se connectent sur le même téléphone, l'ancien continue de recevoir ses notifications (montants, « code de retrait prêt ») sur un appareil utilisé par un autre. Le corps de `POST /auth/devices` n'était pas validé (plateforme inconnue = erreur 500). | ✅ le jeton est retiré aux autres comptes à l'enregistrement ; champs validés |
| P6 | **Suppression d'un utilisateur, d'une agence ou d'une société avec de l'argent dedans** : les wallets sont désactivés, le solde reste gelé ; seul un texte d'avertissement est renvoyé. | 🟡 voir « Décisions » |

## MOYEN

| # | Constat | Statut |
|---|---|---|
| P7 | `PATCH /users/:id` : corps non validé (valeur non textuelle = erreur 500) et email non mis en minuscules — la connexion cherche l'email en minuscules, le compte ne pouvait plus se connecter. | ✅ `UpdateUserDto` + email en minuscules |
| P8 | Réinitialisation du mot de passe d'un agent : ses sessions ouvertes restaient valides (renouvelables à l'infini avec leur refresh token). | ✅ sessions supprimées dans la même transaction |
| P9 | **Le journal des communications garde le corps complet des emails et SMS en clair** : mots de passe temporaires (création d'agent / d'agence / de société, réinitialisation), codes OTP, **codes de retrait cash**. Aucune route ne le lit aujourd'hui, mais toute personne ayant accès à la base les voit. | 🟡 voir « Décisions » |
| P10 | Changer le pays d'une agence ou d'un utilisateur recalcule sa devise principale **sans créer le wallet correspondant** : la caisse reste dans l'ancienne devise, les opérations de l'agence cherchent la nouvelle et échouent. | 🟡 |

## BAS

- `GET /users` non paginé (avec les wallets de chaque utilisateur) ; `users/public/:id` donne le téléphone de n'importe quel compte de la société, administrateurs compris.
- Taux de change : `/rates` et `/exchange-rates` écrivent la même table, mais seul `/exchange-rates` écrit l'historique ; `POST /exchange-rates/convert` est public et non validé.
- Agences : `PATCH` avec un code déjà pris = erreur 500 (contrainte d'unicité), téléphone d'agence enregistré sans normalisation.
- `PATCH /clients/:id` (super admin) accepte n'importe quel champ (`body: any`).
- Sans Twilio configuré, le SMS « stub » écrit le message (donc l'OTP) dans les logs du serveur.
- L'email d'une agence est l'identifiant de connexion de son responsable : il n'est donc volontairement pas servi par `/locations` (la carte « Agences » du mobile n'affiche plus d'email).

## Décisions qu'il me faut

1. **P6 — supprimer avec solde** : on bloque la suppression (erreur 409 « videz d'abord le wallet ») tant qu'un wallet de l'utilisateur / de l'agence / de la société a un solde ou une réserve non nuls ? Aujourd'hui l'argent est gelé et il faut une opération manuelle en base pour le récupérer.
2. **P9 — journal des communications** : je propose de ne plus enregistrer le corps des emails / SMS sensibles (OTP, mot de passe temporaire, code de retrait), seulement le sujet, le destinataire et le statut. D'accord ?
3. **P10 — changement de pays** : créer automatiquement le wallet de la nouvelle devise, ou interdire le changement de pays d'une agence qui a une caisse ?
4. Passe 3 éventuelle : `rates-admin`, `fees-admin`, `payments`, `limits`, `platform` (non relus dans cette passe).
