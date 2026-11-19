# Audit de la logique d'argent — 19/11/2026

Périmètre lu ligne à ligne : portefeuilles (`wallets`), création d'envoi, annulation / remboursement / rappel / expiration, paiement d'un code en agence et répartition des commissions, dépôts, recharge d'agence, virements B2B, trésorerie, recharges, retraits marchands, factures, envois planifiés, garantie de taux, conformité (lot 3).
Non couvert en profondeur (lecture par recherche ciblée seulement) : paiements marchands (`merchant-payments`), connecteurs de factures, administration des taux, code des applications mobile et web.
Méthode : chaque constat ci-dessous a été vérifié dans le code ; aucun n'est une supposition. Je n'ai pas pu rejouer de scénario sur une vraie base (voir « Limites »).

## Verdict
**Le moteur d'argent est solide. L'application n'est pas prête pour de l'argent réel** à cause de deux interrupteurs de développement ouverts par défaut (C1, C2) et de l'absence de vrai prestataire de paiement. Ce sont des réglages et un branchement à faire, pas des défauts de conception.

## Ce qui est solide (vérifié)
- **Aucune écriture de solde ne contourne le journal** : tous les mouvements passent par `WalletsService` (verrou par portefeuille, solde relu sous verrou, ligne de journal avec solde après). Aucune requête SQL brute ne touche les soldes.
- **Atomicité** : création d'envoi, débit, crédit, commissions, plafonds sont dans UNE transaction SQL ; en cas d'échec, rien ne bouge.
- **Pas de double traitement** : chaque changement de statut est « réservé » par un `updateMany` conditionné à l'ancien statut (paiement d'un code, annulation, expiration, rappel, virements B2B, retraits marchands, factures). Deux clics, deux agents ou deux instances ne peuvent pas rembourser ou payer deux fois.
- **Idempotence** : clé unique `(expéditeur, clé)` sur envois, dépôts et recharges d'agence ; envois planifiés avec clé « virement + échéance » ; trésorerie rejouable.
- **Remboursement sur le portefeuille réellement débité** (lu dans le journal), y compris si l'agence a été désactivée depuis.
- **Séparation des tâches** : l'agent qui a créé un envoi ne peut pas le payer ; un code ne se paie que dans le pays de destination ; code expiré refusé même avant le passage de la tâche de nuit ; envoi bloqué par la conformité (`ON_HOLD`) non payable et non modifiable à la main.
- **Frais** : calculés côté serveur depuis le barème, jamais fournis par le client ; répartition figée à l'envoi ; la société prend le reste d'arrondi (la somme des parts égale toujours les frais).
- **Plafonds re-contrôlés sous le verrou du portefeuille** (deux envois simultanés ne dépassent pas la limite) ; dépôts plafonnés aussi.
- Parrainage, envoi sans frais et garantie de taux sont consommés dans la même transaction que l'envoi.

## Constats

### Critiques — à fermer avant d'ouvrir au public
**C1. Auto-alimentation administrateur ouverte par défaut.** `POST /transactions/admin/fund-self`, `POST /treasury/admin/inject` et `/inject-all` créent de l'argent sans contrepartie. Un administrateur de société peut s'ajouter des fonds puis les envoyer. Fermées par `ALLOW_SELF_FUNDING=false`.
**C2. Recharges simulées ouvertes par défaut.** Carte, Orange Money et Sendwave créditent le portefeuille sans paiement réel (succès systématique, et le client peut même choisir `simulateSuccess`). Tout client peut se créditer des fonds puis les envoyer en cash. Fermées par `BLOCK_SIMULATED_RECHARGES=true`. **Conséquence : tant qu'aucun vrai prestataire n'est branché, les clients ne peuvent alimenter leur portefeuille que par un dépôt en agence.**
*Correction livrée* : le contrôle de mise en production (K4) rend ces deux oublis impossibles.

### Importants — à traiter avant de monter en volume
**I1. Pas d'authentification renforcée pour créer un envoi.** Les factures demandent un code PIN ; les envois non. Un jeton volé suffit pour envoyer de l'argent. À ajouter : PIN ou code SMS au-dessus d'un montant, et délai (ou alerte) avant le premier envoi vers un nouveau bénéficiaire.
**I2. Le filtrage des listes de sanctions ne peut pas BLOQUER un envoi wallet → wallet.** Le filtrage s'exécute juste après la création. Un envoi vers un client inscrit est payé immédiatement : il est signalé (dossier, alerte) mais pas bloqué, même si le blocage automatique est activé. Pour un envoi cash validé automatiquement, une fenêtre de quelques secondes existe avant le blocage. Option recommandée : un contrôle synchrone AVANT le débit qui refuse l'opération et ouvre un dossier (aucun argent ne bouge). Je peux le faire.
**I3. Pas de contrepartie ni de position de change.** Le circuit est cohérent (débit à l'envoi, crédits au paiement), mais l'argent « en transit » et l'écart de change entre devises n'apparaissent dans aucun compte : on ne peut pas prouver que la somme des portefeuilles égale l'argent réellement détenu. À prévoir : un rapport de réconciliation quotidien par devise (somme des portefeuilles + envois non retirés + positions de change = solde bancaire / mobile money). Une requête de contrôle journal ↔ solde est en annexe.
**I4. Retrait de trésorerie sans double validation.** `POST /treasury/admin/withdraw` permet à un seul administrateur de société de sortir des fonds du portefeuille de la société (tracé au journal d'audit, sans plafond ni second validateur). Un compte administrateur compromis peut le vider. Recommandé : seconde validation au-dessus d'un seuil, plafond journalier, alerte immédiate.
**I5. Désactiver une agence, un agent ou une société avec un solde non nul** n'est qu'un avertissement : les fonds restent sur des portefeuilles désactivés, « à réconcilier séparément ». Recommandé : refuser la désactivation tant que le solde n'est pas soldé (ou imposer un transfert de clôture tracé).

### Mineurs
- **M1. Arrondi des devises à 2 décimales** : `roundToCurrency` ajoute `Number.EPSILON`, sans effet au-delà de ~2 ; une demi-unité exacte (ex. 100,005 EUR) peut s'arrondir vers le bas. Écart maximal : 0,01 par opération, uniquement EUR / USD / GBP. XOF et GNF ne sont pas concernés.
**M2. Garantie de taux = option gratuite pour le client** : la société supporte le risque de change pendant la durée de la garantie. Garder une durée courte et une marge dans le taux garanti.
**M3. Verrous de portefeuille pris dans des ordres différents selon les opérations** (paiement d'un code, recharge d'agence) : en cas de concurrence extrême, PostgreSQL annule une des transactions (aucune perte, le client réessaie). À surveiller dans les journaux.

## Corrigé dans cette livraison
- **K1. Montants avec fraction en XOF / GNF** : un envoi de 1 000,4 XOF débitait 1 000,4 + frais mais ne versait que 1 000 au bénéficiaire ; la fraction n'apparaissait dans aucun portefeuille (écart de 0 à 0,5 XOF par envoi, impossible à rapprocher). Désormais refusé avec un message clair (XOF / GNF : nombre entier ; autres devises : 2 décimales). Appliqué aux envois, dépôts et recharges d'agence. `wallets/money.ts` → `assertAmountFitsCurrency`.
- **K2. Motif du gel divulgué.** Quand un portefeuille gelé (LCB-FT) recevait un envoi, l'expéditeur lisait « Ce wallet est gelé (motif…) » : information sur une mesure de conformité donnée à un tiers. Le message est désormais neutre ; le code d'erreur `WALLET_FROZEN` est conservé, le motif reste visible de l'administration.
- **K3. Portefeuilles de la société lisibles par ses clients.** Un client (rôle USER) qui connaissait l'identifiant d'un portefeuille de la société pouvait en lire le solde et le journal. Réservé aux administrateurs de la société.
- **K4. Contrôle de mise en production au démarrage** (`common/production-readiness.ts`) : en `NODE_ENV=production`, chaque interrupteur ouvert est écrit dans les journaux (critiques : `ALLOW_SELF_FUNDING`, `BLOCK_SIMULATED_RECHARGES`, `ALLOW_SIMULATED_PAYMENTS`, `KYC_ENFORCEMENT=off` ; avertissements : http autorisé, localhost autorisé, Swagger public, base sans SSL). Avec `STRICT_PRODUCTION=true`, l'API refuse de démarrer tant qu'un point critique reste ouvert. Rien ne change hors production.

## Avant l'ouverture : réglages à poser
```
NODE_ENV=production
ALLOW_SELF_FUNDING=false
BLOCK_SIMULATED_RECHARGES=true
STRICT_PRODUCTION=true
CORS_ALLOW_LOCALHOST=false
```
(ne pas définir `ALLOW_SIMULATED_PAYMENTS`, ne pas mettre `KYC_ENFORCEMENT=off`.)

## Annexe — requêtes de contrôle (PostgreSQL, lecture seule)
Chaque portefeuille doit avoir un solde égal à la somme de son journal (à lancer chaque jour ; tout résultat est un écart à expliquer) :
```sql
SELECT w.id, w.currency, w.balance,
       COALESCE(SUM(CASE l.type WHEN 'CREDIT' THEN l.amount WHEN 'DEBIT' THEN -l.amount ELSE 0 END), 0) AS journal
FROM wallets w
LEFT JOIN ledger_entries l ON l."walletId" = w.id
GROUP BY w.id, w.currency, w.balance
HAVING w.balance <> COALESCE(SUM(CASE l.type WHEN 'CREDIT' THEN l.amount WHEN 'DEBIT' THEN -l.amount ELSE 0 END), 0);
```
Soldes négatifs ou réservé supérieur au solde (doit renvoyer zéro ligne) :
```sql
SELECT id, currency, balance, "reservedBalance" FROM wallets WHERE balance < 0 OR "reservedBalance" < 0 OR "reservedBalance" > balance;
```
Si les deux requêtes renvoient zéro ligne sur la base de recette, une contrainte de sécurité supplémentaire peut être ajoutée : `ALTER TABLE wallets ADD CONSTRAINT wallets_balance_nonneg CHECK (balance >= 0 AND "reservedBalance" >= 0);` (non appliquée : à décider après le contrôle ci-dessus).

## Limites de cet audit
- Aucune base PostgreSQL ici : les migrations et les requêtes n'ont pas été exécutées ; les tests utilisent une base simulée (module `decimal.js` réel pour les montants).
- 9 anciennes suites de tests échouent dans mon environnement à cause du client Prisma simulé (ex. « Cannot convert object to primitive value »), sans lien avec les modifications ; elles doivent passer avec le vrai client.
- Un audit de code ne remplace pas un test d'intrusion externe ni une recette de bout en bout avec de petits montants réels.
