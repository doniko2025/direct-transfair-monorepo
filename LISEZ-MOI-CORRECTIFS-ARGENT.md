# Correctifs de l'audit « argent » — mise en place

## Ce qui change
| Point | Ce qui change pour vous |
|---|---|
| **I1 — Code PIN avant un envoi** | Un client (rôle USER) doit saisir son code à 6 chiffres pour **chaque envoi** (Wallet, Cash Pickup, écran « Envoyer à un wallet ») et pour **programmer** un virement. 5 erreurs = blocage 30 min (même compteur que la connexion). Agents et admins en sont dispensés (pas de code à 6 chiffres) ; les envois programmés déjà créés s'exécutent sans code. Backend : `transactions/send-pin.ts`. Mobile : feuille « Confirmez avec votre code secret ». |
| **I2 — Sanctions avant débit** | Envoi vers un portefeuille = crédité tout de suite, donc impossible à retenir après coup. Si la société a activé « bloquer sur correspondance forte », les noms sont filtrés **avant le débit** : refus neutre (« opération impossible pour le moment »), aucun argent bougé, dossier de conformité + alerte + administrateurs prévenus. Sans cette option, rien ne change. |
| **I3 — Réconciliation quotidienne** | Chaque nuit à 02:30 : solde de chaque portefeuille comparé à son journal, par société et par devise ; soldes négatifs, réservé incohérent, argent « en route ». Un écart ouvre **une** alerte (par société et devise) et prévient les administrateurs. Écran : « Réconciliation » (admin société, menu Pilotage) et section dans la Supervision (super admin, bouton « Relancer maintenant »). Rien n'est corrigé automatiquement. |
| **I4 — Double validation des retraits** | « Retirer » devient « Demander un retrait » : rien n'est débité. **Un autre administrateur** de la société (ou le super admin, utile si la société n'a qu'un administrateur) valide ; l'argent part alors, dans la même transaction que la validation. Expiration à 48 h, refus avec motif, annulation par le demandeur, tout est tracé. |
| **I5 — Désactivation avec solde** | Désactiver une **agence** ou une **société** est refusé (409 `BALANCE_NOT_EMPTY`) tant qu'un portefeuille (caisse, agents, clients, commerces, société) détient de l'argent. Pour couper l'accès tout de suite : **suspendre** (agent, agence, société) — la suspension ne touche pas aux soldes. (La suppression d'un utilisateur refusait déjà.) |
| **M1 — Arrondis** | `roundToCurrency` (EUR/USD/GBP) arrondissait mal certaines demi-valeurs (ex. 10,075). Corrigé côté serveur, marchands et mobile (mêmes résultats partout). |
| **M2 — Taux garanti** | Durée par défaut 5 min (au lieu de 10) et marge de 0,2 % retenue sur le taux garanti (`RATE_LOCK_MINUTES`, `RATE_LOCK_MARGIN_PCT`). Le client voit le montant garanti exact. |
| **M3 — Verrous** | Pas de changement de code : le risque d'inter-blocage entre deux portefeuilles est déjà évité par le tri des identifiants. À surveiller dans les journaux (erreurs `deadlock detected`) lors des premiers jours de charge. |

## Mise en place
1. Appliquer les fichiers du zip.
2. **Base de données** : `pnpm --filter direct-transfair-backend prisma migrate deploy` puis `prisma generate`. Deux migrations : `20261119210000_reconciliation` (table + valeur d'alerte `RECONCILIATION_GAP`) et `20261119220000_treasury_withdrawal_requests`.
3. Redémarrer le backend, reconstruire le web-admin et republier l'application mobile (nouvelle feuille de code secret).
4. Super admin → Supervision → « Relancer maintenant » : premier rapport de réconciliation. **Tout écart sur la base de recette est à expliquer avant la mise en production.**

## À vérifier à la recette
- Envoi mobile : code faux (message « il vous reste N essais »), 5 erreurs (blocage), bon code (envoi).
- Retrait : demandé par l'admin A, validé par l'admin B ; tentative de validation par A (impossible) ; solde insuffisant (la demande reste en attente avec la cause).
- Désactivation d'une agence avec 1 XOF en caisse : refusée ; à zéro : acceptée.
- Liste de surveillance + « bloquer sur correspondance forte » : un envoi wallet→wallet vers un nom listé est refusé sans débit.

## Limites de cette livraison
- Aucune base PostgreSQL ici : les requêtes SQL de la réconciliation et les migrations n'ont pas été exécutées (tests avec bases simulées). À valider sur la base de recette.
- Hors périmètre à votre demande : auto-alimentation / simulations / réapprovisionnement admin (à retirer avant le lancement).
- 8 anciennes suites de tests échouent dans mon environnement à cause du client Prisma simulé (« Cannot convert object to primitive value »), sans lien avec ces changements.
