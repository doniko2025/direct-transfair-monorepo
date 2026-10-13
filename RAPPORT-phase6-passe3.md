# Phase 6 — Scanner : rapport de la passe 3 (paiements, trésorerie, taux, plafonds)

Modules lus en entier : rates-admin, fees-admin, fee-schedule (barème et moteur), validation-thresholds, commission-rules, limits, agent-desk, payments (recharges, moyens de paiement, paiement d'un envoi), treasury, rate-alerts, platform, common (middleware tenant, garde admin, throttling, téléphone), main.ts et app.module.ts.
Les autres modules (auth, transactions, wallets, withdrawals, users, agencies, etc.) ont été lus dans les lots précédents.

Légende : ✅ corrigé dans ce lot · 🟡 décision à toi · ⚪ noté, faible enjeu.

## Ce qui est propre

`rates-admin`, `fees-admin`, `fee-schedule`, `validation-thresholds`, `commission-rules`, `limits`, `agent-desk`, `platform` : rôles déclarés, toutes les lectures et écritures limitées à la société de l'appelant, validations en place, modifications journalisées. Rien de critique.

---

## HAUT

### Q1 — `POST /payments/initiate` : l'expéditeur pouvait marquer son propre envoi « payé » ✅
Un envoi est débité du wallet dès sa création. Cette route, ouverte à tout compte connecté, faisait pourtant passer la transaction à PAID (méthode WALLET, ou « paiement » Orange Money / Sendwave simulé) sans que l'agence ait versé le cash.
Conséquence : l'envoi ne pouvait plus être annulé ni remboursé, et le bénéficiaire ne pouvait plus retirer son argent (le retrait exige le statut VALIDATED). Aucun écran mobile ni web n'appelle cette route.
**Corrigé** : fermée par défaut (403). Elle se rouvre en développement avec `ALLOW_SIMULATED_PAYMENTS=true`. `GET /payments/status/:id` reste ouvert (lecture, propriétaire seulement).

### Q2 — `GET /treasury/snapshots` sans contrôle de rôle ✅
Tout compte rattaché à une société (client, agent) pouvait lire les volumes envoyés, frais, commissions et soldes de clôture quotidiens de sa société. `GET /treasury/overview`, lui, était bien réservé aux administrateurs.
**Corrigé** : réservé au super admin et à l'admin de société.

### Q3 — Limitation de débit partagée par toute la plateforme ✅
Le backend tourne derrière le proxy de Railway et n'avait pas l'option « trust proxy » : Express voyait l'adresse du proxy comme adresse du client. Les limites (100 requêtes/min en général, 5 connexions/min sur le login) étaient donc **communes à tous les utilisateurs**, et les journaux de connexion enregistraient l'IP du proxy.
**Corrigé** : en production, 1 proxy de confiance par défaut. `TRUST_PROXY_HOPS=<n>` pour ajuster (0 = désactivé ; 2 si un CDN type Cloudflare est devant Railway). À vérifier après déploiement : l'IP affichée dans l'historique de connexion doit être celle du client.

## MOYEN

| # | Constat | Statut |
|---|---|---|
| Q4 | **Alertes de taux** : corps non validé (`body: any` : paire non textuelle ou direction inconnue = erreur 500, seuil texte = alerte qui ne se déclenche jamais) ; une alerte sur le sens inverse (XOF_EUR) ne se déclenchait **jamais** (seules les paires de base sont stockées) ; deux passages du cron qui se chevauchent envoyaient deux fois la même alerte ; une panne d'email/SMS arrêtait toutes les alertes suivantes ; comptes supprimés toujours notifiés ; prénom non échappé dans l'email ; nombre d'alertes illimité. Aucun écran n'utilise ces routes aujourd'hui. | ✅ DTO validé, taux inverse, déclenchement réservé par mise à jour conditionnelle, envois isolés, 20 alertes actives max |
| Q5 | **Trésorerie** : `inject`, `inject-all`, `withdraw` et le transfert interne du super admin créent ou déplacent de l'argent sans aucune trace dans le journal d'audit ; montants sans plafond (un montant énorme = erreur 500 de la base) ; `inject-all` acceptait des chaînes ; le snapshot **global** était cherché avec la clé 0 mais créé avec NULL : chaque déclenchement manuel ajoutait un doublon. | ✅ audit (action `BALANCE_ADJUSTMENT`, visible dans la supervision), plafond 1 000 000 000 000, montants convertis et contrôlés, snapshot global mis à jour sur place |
| Q6 | **Moyens de paiement** : lier un nouveau numéro Orange Money gardait l'ancien (l'écran affichait l'un ou l'autre au hasard) ; plusieurs cartes « par défaut » possibles ; nombre de cartes illimité ; numéro et nom sans longueur maximale ; recharge sans montant maximum (montant énorme = erreur 500). | ✅ un numéro par opérateur, une seule carte par défaut (la première l'est d'office), 10 cartes max, champs bornés |
| Q7 | `POST /limits/request` notifie **tous** les admins de la société à chaque appel : on pouvait les inonder. | ✅ 3 demandes par heure |

## À savoir (non modifié)

- ⚪ **Recharges simulées** (carte, Orange Money, Sendwave) : toute personne connectée peut se créditer n'importe quel montant. C'est ta décision pour la phase de test. J'ai ajouté l'interrupteur pour le lancement : `BLOCK_SIMULATED_RECHARGES=true` ferme les trois routes (503 « La recharge du wallet n'est pas encore disponible »). Le suivi `GET /payments/recharge/:id/status` reste ouvert.
- ⚪ `fund-self` / `admin/inject` / `inject-all` : toujours sans plafond, comme voulu, mais maintenant tracés dans l'audit.
- ⚪ Le super admin peut déplacer de l'argent entre **deux wallets quelconques** (même de sociétés différentes) via `POST /treasury/transfer`. C'est son rôle de plateforme ; c'est désormais journalisé.
- ⚪ **CORS** accepte toute origine `*.vercel.app` et `*.railway.app` avec `credentials`. L'API s'authentifie par en-tête (pas de cookie), donc un site tiers ne peut pas lire de jeton ; mais il serait plus propre de ne lister que tes déploiements.
- ⚪ **Swagger** (`/swagger`, `/api/swagger`) est public en production : il décrit toutes les routes.
- ⚪ `totalReceivedToday` est toujours 0 dans la trésorerie (jamais calculé, définition de « reçu » à confirmer).
- ⚪ `rates-admin` : deux super admins qui modifient la même paire exactement en même temps — le dernier écrase l'autre (la version est incrémentée sans contrôle). Improbable (un seul super admin en pratique).
- ⚪ Barème de frais : le contrôle de chevauchement ne compare que les règles de même devise ; deux règles en devises différentes peuvent se recouvrir une fois converties (la plus spécifique, puis la plus récente, l'emporte : le résultat est déterministe).
- ⚪ Alertes de taux : l'option « alertes activées » de la société n'est contrôlée qu'à la création.

## Décisions qu'il me faut

1. **Au lancement** : mets `BLOCK_SIMULATED_RECHARGES=true` dans les variables Railway le jour J (sans redéploiement de code).
2. **CORS** : je limite à une liste précise de domaines (+ les domaines personnalisés des sociétés, déjà gérés) ? Il faudrait que tu me donnes tes URL Vercel/Railway exactes.
3. **Swagger** : on le coupe en production (activable avec une variable) ?
