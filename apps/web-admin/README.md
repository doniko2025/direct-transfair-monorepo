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

Points de contrat à connaître (relevés dans le backend) :

- `PATCH /clients/:id` n'est pas validé côté serveur : le web valide lui-même chaque champ et n'envoie que les champs modifiés (un champ vidé part en `null`, jamais en `""`).
- `country` / `ownerCountry` ne sont volontairement pas éditables sur la fiche : le serveur en recalcule la devise par défaut à chaque mise à jour.
- `GET /users` n'est pas paginé : le web filtre en mémoire et affiche les cartes par tranches de 48.
- `POST /users` laisse choisir n'importe quel rôle et ignore `agencyId` : le web ne crée que des `COMPANY_ADMIN` (les agents viendront avec le module Agences) et l'admin de société ne gère que agents et clients.
- L'email d'un compte n'est pas modifiable depuis le web (le serveur ne revérifie pas le nouvel email).
- Le statut d'abonnement (`SUSPENDED`…) n'est appliqué aujourd'hui qu'à la trésorerie ; la connexion n'est bloquée que par `isActive`.

## Design

Cartes uniquement, pas de tableaux. Jetons de couleur et de typographie dans `src/styles/tokens.css`. Le branding de société surcharge `--brand`, `--brand-ink`, `--accent`, `--accent-ink`.

## À durcir à l'étape « scanner »

- Les jetons sont dans `localStorage` (`dtw.access`, `dtw.refresh`) : passer à des cookies `httpOnly` émis par le backend.
- Ajouter une Content-Security-Policy avec l'origine de l'API.
