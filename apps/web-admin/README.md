# Direct Transf'air — Web admin

Back-office web pour **super admin**, **admins de société** et **agents**.
Les clients wallet (rôle `USER`) restent sur l'application mobile : un compte client qui tente de se connecter ici est refusé et sa session est refermée côté serveur.

## Démarrer

```bash
pnpm install
cp apps/web-admin/.env.example apps/web-admin/.env.local   # puis ajuster
pnpm dev:web-admin                                         # http://localhost:5173
```

Autres commandes : `pnpm build:web-admin`, `pnpm typecheck:web-admin`.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `VITE_API_URL` | URL du backend NestJS, sans `/api` (ex. `https://api.example.com`). Obligatoire. |
| `VITE_PLATFORM_HOSTS` | Hôtes du portail plateforme (super admin), séparés par des virgules. Si défini, tout hôte inconnu qui n'est pas une société affiche « Portail introuvable ». |
| `VITE_TENANT_CODE` | Force un code société (déploiement dédié à une seule société). |
| `VITE_ALLOW_TENANT_QUERY` | `true` autorise `?tenant=CODE` hors développement (à éviter en production). |

## Comment le portail est choisi (tenant)

Ordre de résolution :

1. `?tenant=CODE` (en dev, ou si `VITE_ALLOW_TENANT_QUERY=true`)
2. `VITE_TENANT_CODE`
3. `localhost` → portail plateforme
4. `GET /api/branding/by-host?host=<domaine>` → société rattachée à ce domaine
5. Hôte inconnu → plateforme (ou « Portail introuvable » si `VITE_PLATFORM_HOSTS` est défini)

Le code retenu est envoyé dans l'en-tête `x-tenant-id` à chaque appel. Les couleurs, le logo, la police et le titre viennent du branding de la société.

Cohérence portail : un `SUPER_ADMIN` n'est accepté que sur le portail plateforme ; les autres rôles que sur le portail de leur société (le backend l'impose au login, le front le revérifie à la restauration de session).

## Déployer sur Vercel

- Root Directory : `apps/web-admin`
- `vercel.json` fournit le build, la réécriture SPA et les en-têtes de sécurité.
- Un domaine par société : l'ajouter au projet Vercel et renseigner `customDomain` côté société ; le front le résout via `by-host`.
- Ne nomme pas le projet Vercel comme un code de société : sur `*.vercel.app`, `by-host` fait aussi correspondre `code = premier label`.
- Ajouter l'origine du web-admin dans la liste CORS dynamique du backend si elle n'est pas couverte par `*.vercel.app` ou un `customDomain`.

## Ajouter un écran (phases suivantes)

1. Créer la page dans `src/pages/…`.
2. L'enregistrer dans `src/modules.tsx` (chemin, rôles autorisés, composant).
3. Passer son entrée `ready: true` dans `src/navigation.ts` (les entrées `ready: false` s'affichent grisées « Bientôt »).

Les gardes (`RequireAuth`, `RequireRole`) appliquent déjà les rôles autorisés de chaque route.

## Modules livrés

- **Sociétés** (super admin) : `/companies` (liste, recherche, filtres), `/companies/new` (création + administrateur, mot de passe temporaire généré puis affiché une seule fois), `/companies/:id` (identité, portail, apparence, mentions légales, équipe, portefeuilles, suspension, suppression avec saisie du code).
- **Utilisateurs** (super admin et admin de société) : `/users` (annuaire de cartes, filtres profil / statut / société, recherche, affichage par tranches), `/users/:id` (profil modifiable, compte, conformité, portefeuilles, suspension avec motif, réactivation, suppression avec saisie de l'email), `/users/new` (ajout d'un administrateur à une société, super admin seulement).
- **Transactions** (tous les rôles) : `/transactions` (cartes, recherche par référence / nom / téléphone, onglets de statut, filtres période / type / société / signalées ; l'agent ne voit que ses propres opérations), `/transactions/:id` (montants, parties, règlement, historique). Un administrateur peut valider, marquer payée, annuler (avec remboursement de l'expéditeur) ou marquer échouée un **transfert** ; le super admin valide ou refuse un paiement B2B. Les autres types d'opération n'ont volontairement aucune action manuelle (voir `lib/transactionRules.ts`).
- **Trésorerie** (super admin et admin de société) : `/treasury` et `/treasury/wallets/:id` (mouvements d'un portefeuille). Admin de société : soldes par devise avec activité du jour, alimenter / retirer, recharger une agence, récupérer des fonds d'une agence (motif obligatoire), déclarer un virement bancaire à la plateforme (débité immédiatement, remboursé en cas de refus). Super admin : ses soldes, conversion entre ses portefeuilles au taux du serveur, et les virements B2B des sociétés à valider ou refuser (avec la référence bancaire à comparer au relevé). Les montants sont validés avant l'envoi (pas de centimes en GNF/XOF, solde suffisant).
- **Supervision** (super admin) : `/supervision`. Points d'attention détectés sur les données réelles (transactions bloquées depuis plus de 24 h ou retenues, comptes verrouillés, sociétés suspendues ou expirées, abonnements échus sous 14 jours, alertes importantes), état réel de la base (SELECT 1 chronométré) et du serveur, chiffres des 24 dernières heures (activité, sécurité, parc de sociétés), alertes (à traiter / traitées, filtre de gravité, résolution avec confirmation) et journal d'audit paginé (filtres action, échecs seulement, société). **Nécessite le nouveau module backend `apps/backend/src/supervision/`** : les routes `/audit-logs` et `/alerts` appelées par le mobile n'existaient pas. Aucun code n'écrit encore de lignes dans la table `alerts` : la liste reste vide tant qu'une règle de génération n'est pas ajoutée (les points d'attention, eux, sont calculés en direct).
- **Taux de change** (super admin : lecture et écriture ; admin de société : lecture seule) : `/rates` (une carte par couple de devises, filtre par devise, taux appliqué, sens inverse, statut enregistré / calculé / taux de secours, variation du dernier changement, alerte si les deux sens sont incohérents) et `/rates/:pair/history`. Le super admin fixe **un seul sens** par couple (EUR, GBP, USD, XOF, GNF dans cet ordre) : l'autre se déduit (1 ÷ taux), ce qui supprime l'arbitrage possible quand deux sens saisis séparément ne sont pas inverses. Au-delà de 25 % de variation, une case de confirmation est exigée (et contrôlée par le serveur). **Nécessite le nouveau module backend `apps/backend/src/rates-admin/`.** Les anciennes routes d'écriture `POST /rates` et `PATCH /exchange-rates/:pair` étaient ouvertes (la seconde sans aucune authentification) : elles sont maintenant réservées au super admin et valident le taux ; l'application mobile ne peut donc plus modifier les taux.
- **Frais d'envoi** (admin de société : modifie ; super admin : consulte) : `/fees`. Admin de société : une carte par mode de retrait (retrait cash, virement bancaire, virement IBAN) avec taux et frais fixe, calcul d'exemple, modification avec aperçu, et journal des dernières modifications. Mobile Money et wallet vers wallet apparaissent comme **gratuits** : c'est ce que fait le serveur (`transactions.service.ts` n'y prélève jamais rien). Super admin : une carte par société avec ses tarifs (« par défaut » tant qu'elle n'a rien configuré), recherche, journal de toutes les sociétés. Le tarif appartient à chaque société : le super admin ne le modifie pas. **Nécessite le nouveau module backend `apps/backend/src/fees-admin/`.** Le taux est plafonné à 25 % et le frais fixe à 10 000 000 (deux décimales). L'ancienne route `POST /commissions` applique maintenant ces mêmes plafonds. Les paliers et remises partenaires de l'ancien écran mobile n'étaient enregistrés que dans le téléphone (AsyncStorage) et jamais appliqués par le serveur : ils ne sont pas repris.
- **Notifications** (tous les rôles) : `/notifications`, la boîte de réception de l'utilisateur connecté (les siennes uniquement) : cartes, onglets Toutes / Non lues, filtre par type, marquer comme lue (une ou toutes), lien vers la transaction concernée, affichage par tranches (50 puis 100). Une pastille dans le menu indique le nombre de non lues (rafraîchie chaque minute et au retour sur l'onglet). Le backend ajoute `GET /notifications/unread-count`, les paramètres `limit` et `unreadOnly`, ne renvoie plus les notifications expirées et enregistre la date de lecture ; sans paramètre, la liste reste identique pour l'application mobile.
- **Agences** (admin de société) : `/agencies` (cartes avec responsable, nombre d'agents et fonds par devise, résumé du réseau, recherche, filtre filiale / partenaire), `/agencies/new` (création de l'agence, de sa caisse et du compte de son responsable ; **le mot de passe est généré par le serveur** et affiché une seule fois), `/agencies/:id` (informations modifiables, caisse, équipe, désactivation avec saisie du nom). Désactiver une agence **désactive aussi tous ses agents** (c'est ce que fait `DELETE /agencies/:id`) : la boîte de confirmation le dit et signale une caisse non vide. Le pays, donc la devise de la caisse, n'est pas modifiable après la création. Utilise les routes existantes `/agencies`.
- **Agents** (admin de société) : `/agents` (cartes avec agence, portefeuille, dernière connexion ; filtres agence / responsables / suspendus, recherche), `/agents/new` (agent rattaché à une agence, mot de passe temporaire généré par le serveur), changement d'agence, désignation du responsable, nouveau mot de passe temporaire. La suspension et la suppression restent sur la fiche du compte (`/users/:id`). **Nécessite le nouveau module backend `apps/backend/src/agents-admin/`** (`POST /users` ignorait `agencyId` : un agent créé par là n'avait aucune agence).
- **Clients wallet** (admin de société) : `/wallet-clients` (une carte par client avec soldes, portefeuilles gelés barrés, niveau de vérification et statut ; résumé, recherche, filtre par pays, onglets Tous / Actifs / Suspendus / À vérifier ; cartes affichées par 48), `/wallet-clients/:id` (soldes, vérification d'identité, activité, opérations du client, lien vers le compte `/users/:id`). Utilise `GET /users` (filtré côté web sur le rôle USER) et `GET /transactions/admin`. Un id qui n'est pas un client de la société affiche « introuvable ».
- **Retraits d'agence** (admin de société) : `/agency-withdrawals` (cash disponible dans chaque caisse, bouton « Récupérer des fonds » qui réutilise la boîte de la Trésorerie, puis historique des mouvements de caisse : retraits, remises des agents, recharges). Utilise `GET /agencies`, `POST /transactions/agency/collect` et `GET /transactions/admin`. Aucune route backend nouvelle.
- **Barème d'envoi** (admin de société : ajoute, modifie, désactive, supprime ; super admin : consulte, société au choix) : `/fees/schedule`, accessible depuis la page Frais. La société fixe elle-même ses frais **par tranche de montant, par pays d'envoi, par pays de réception et par mode de retrait**. Chaque règle a une devise : tranche et frais fixe sont exprimés dedans, un envoi dans une autre devise y est converti pour être comparé, et le frais fixe est converti dans la devise de l'envoi (arrondi à 0 décimale en XOF/GNF, 2 ailleurs). La règle la plus précise gagne (pays de réception, puis pays d'envoi, puis mode) ; deux règles actives au même critère ne peuvent pas se chevaucher (contrôlé dans la boîte et par le serveur). Sans règle, le tarif du mode de retrait (page Frais), puis 1,5 %. Mobile Money et wallet vers wallet restent gratuits. Un simulateur appelle le calcul exact du serveur (`GET /fees-admin/quote`) et dit quelle règle s'applique. **Nécessite le nouveau module backend `apps/backend/src/fee-schedule/`, la table `fee_rules` et la migration `20261012120000_add_transaction_agency_and_fee_rules`.**
- **Commissions** (admin de société : société et chaque agence ; agent : les siennes) : `/commissions`. Ce qui a **réellement été crédité** (écritures du grand livre), par période (jour, semaine, mois, trimestre, année, depuis le début), totaux par devise sans conversion, détail lié à l'opération d'origine. Utilise `GET /commissions/ledger/company` et `/mine`.
- **Réglages** (admin de société : modifie ; super admin : consulte) : `/settings`. Répartition des frais d'un retrait payé en agence entre agence d'envoi, agence payeuse et société, pour les 6 combinaisons expéditeur (client wallet, filiale, partenaire) × agence payeuse (filiale, partenaire). La part société est le reste (100 − envoi − paiement). Un client n'a pas d'agence d'envoi : sa part d'envoi est 0 et revient à la société. Sans réglage : 20 / 40 / 40. S'applique aux prochains retraits seulement. **Nécessite le nouveau module backend `apps/backend/src/commission-rules/`.**
- **Agence sur chaque mouvement de caisse** : la transaction porte maintenant `agencyId` (l'agence dont la caisse a bougé : recharge, remise, collecte, dépôt ou envoi d'un agent ; ce n'est pas l'agence qui paie un retrait). Le nom de l'agence apparaît sur les cartes d'opération et sur la fiche (lien vers l'agence), et la page Retraits d'agence a un filtre par agence. La migration renseigne les anciennes lignes quand c'est déterminable ; pour les anciens dépôts et envois d'agent, elle utilise l'agence **actuelle** de l'agent.
- **Guichet de l'agent** (agent) : le tableau de bord devient « Mon guichet » (caisse de l'agence, raccourcis, bilan du jour) et les entrées Dépôt, Retrait, Envoi cash et Remise sont ouvertes. Chaque écran affiche la caisse de l'agence en tête, avec ce qu'il en restera après l'opération saisie, et se termine par un **reçu imprimable** (seul le reçu sort sur la feuille).
  - `/deposit` : recherche du client par téléphone (indicatif du pays + numéro, un « 0 » initial est ignoré), refus clair d'un compte suspendu, montant contrôlé contre la caisse, confirmation, reçu. La caisse est débitée du montant.
  - `/withdraw` : le bénéficiaire donne son code ; l'écran dit s'il est payable, en attente de validation, déjà payé ou annulé, et ne propose le paiement que dans le premier cas. Le montant à remettre est le montant converti dans la devise du pays de retrait. **Payer crédite la caisse** (espèces remboursées + commission de paiement). Sans caisse dans la devise à remettre, l'écran refuse de payer (voir « À repasser en phase 6 »).
  - `/send-cash` : bénéficiaire (nom, pays, ville, téléphone facultatif), montant, client au guichet (nom obligatoire). Les frais, le taux et le montant reçu viennent de `GET /agent-desk/send-preview`, calculés par les mêmes services que l'envoi : l'écran montre exactement ce que le serveur appliquera (barème de la société compris), signale une caisse insuffisante et un envoi qui dépassera le seuil de validation de 500 000. Le **code de retrait est la référence de l'opération**, affiché en grand avec un bouton « Copier ». Si l'envoi échoue après la création du bénéficiaire, un nouvel essai réutilise ce bénéficiaire.
  - `/remit` : montant (ou « Remettre toute la caisse »), libellé facultatif, confirmation, reçu à faire signer à l'administrateur.
  **Nécessite le nouveau module backend `apps/backend/src/agent-desk/`** (`GET /agent-desk/me`, `/agent-desk/clients/lookup`, `/agent-desk/send-preview`, réservés au rôle AGENT) : `GET /wallets/me` ne donne à un agent que ses portefeuilles personnels, pas la caisse de l'agence. Les écritures passent par les routes existantes (`POST /transactions/deposit`, `/withdrawals/agent/check|pay`, `/beneficiaries`, `/transactions`, `/transactions/agency/remit`).
- **Corrections serveur de la phase 4** (`transactions.service.ts` v4.23) : la devise d'un pays vient maintenant d'une table unique (`fee-schedule/country-currency.ts`) ; avant, « Guinée-Bissau » donnait GNF et « Allemagne », « Italie », « Pays-Bas » (saisis par leur nom) donnaient XOF. Un dépôt refuse un destinataire qui n'est pas un client wallet (un administrateur ou un agent dont on saisissait le numéro était crédité) ou qui est suspendu. Un dépôt débite la caisse **par défaut** de l'agence, comme la remise et l'aperçu d'envoi (sans ordre, une agence à deux devises était débitée au hasard).
- **Faille corrigée dans `users.controller.ts`** : un admin de société pouvait créer un `SUPER_ADMIN` ou un `COMPANY_ADMIN`, modifier / suspendre / supprimer ses collègues administrateurs et lui-même, et voyait les `SUPER_ADMIN` rattachés à sa société. Il ne crée et ne gère plus que des agents et des clients (et ne modifie que son propre profil) ; personne ne peut se suspendre ni se supprimer soi-même ; le corps de `POST /users` est maintenant validé. `agencies.service.ts` : le téléphone du responsable est normalisé et son unicité vérifiée à la création (un doublon renvoyait une erreur 500).

Points de contrat à connaître (relevés dans le backend) :

- `PATCH /clients/:id` n'est pas validé côté serveur : le web valide lui-même chaque champ et n'envoie que les champs modifiés (un champ vidé part en `null`, jamais en `""`).
- `country` / `ownerCountry` ne sont volontairement pas éditables sur la fiche : le serveur en recalcule la devise par défaut à chaque mise à jour.
- `GET /users` n'est pas paginé : le web filtre en mémoire et affiche les cartes par tranches de 48.
- `POST /users` ignore `agencyId` : les agents se créent par le module Agents (`/agents-admin`). Depuis la correction, le serveur applique aussi la règle « l'admin de société ne gère que agents et clients ».
- L'email d'un compte n'est pas modifiable depuis le web (le serveur ne revérifie pas le nouvel email).
- Le statut d'abonnement (`SUSPENDED`…) n'est appliqué aujourd'hui qu'à la trésorerie ; la connexion n'est bloquée que par `isActive`.

## Design

Cartes uniquement, pas de tableaux. Jetons de couleur et de typographie dans `src/styles/tokens.css`. Le branding de société surcharge `--brand`, `--brand-ink`, `--accent`, `--accent-ink`.

## À durcir à l'étape « scanner »

- Les jetons sont dans `localStorage` (`dtw.access`, `dtw.refresh`) : passer à des cookies `httpOnly` émis par le backend.
- Ajouter une Content-Security-Policy avec l'origine de l'API.
- Les lectures du grand livre des commissions (`/commissions/ledger/*`) ne sont pas paginées : les totaux sont calculés sur toutes les écritures de la période.
- `upsertRule` (réglages de répartition) : la recherche de la ligne existante doit aussi filtrer `payoutMethod: null`.
- Les parts par défaut de la répartition sont dupliquées dans `withdrawals.service.ts` et `commission-rule-defaults.ts` : à centraliser.
- Les frais du barème sont arrondis à la précision de la devise, ceux du tarif plat par mode ne le sont pas : à harmoniser.
- Plusieurs pages relancent leurs requêtes deux fois après un rechargement complet (restauration de session).
- `withdrawals.service.ts` → `agentProcessPayment` : sans caisse dans la devise à remettre, il retombe sur la caisse par défaut ou la première et la **crédite dans la mauvaise devise**. Le web refuse de payer dans ce cas ; le serveur devrait lever une erreur.
- `agentCheckCode` / `agentProcessPayment` retrouvent l'opération par `reference` ou `providerRef` **sans vérifier** qu'il s'agit d'un transfert à retirer en espèces (`type = TRANSFER`, `payoutMethod = CASH_PICKUP`), et acceptent aussi le rôle COMPANY_ADMIN.
- `transactions.service.ts` → `create` : le bénéficiaire doit appartenir à l'expéditeur (`userId = senderId`) ; un agent crée donc un bénéficiaire par envoi (le web réutilise celui d'un nouvel essai, mais pas d'un envoi à l'autre).
- La commission de l'agence d'envoi est calculée avec l'agence **actuelle** de l'expéditeur au moment du retrait, pas celle du moment de l'envoi (`Transaction.agencyId` permet de corriger).
