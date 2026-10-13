# Phase 6 — Scanner : rapport de la passe 1 (argent + authentification) — mis à jour après le lot 2c

Périmètre de cette passe : tout ce qui touche à l'argent et aux connexions. Toutes les routes du backend ont été inventoriées par script (garde, rôle, contrôle dans le code) ; les services suivants ont été lus en entier : auth (v1 et v2), jetons, gardes, transactions, retraits, wallets, trésorerie (société et agences), barème de frais, commissions, recharges, virements programmés, guichet agent.

**Pas encore lus en détail (passe 2)** : users, clients, agencies, agents-admin, supervision, tenants, rates / exchange-rates, notifications, push, mail, sms, bénéficiaires. Il faudra y chercher surtout les fuites entre sociétés.

Légende : ✅ corrigé (lot 1 ou lot 2a) · 🟡 à valider par toi · 🔵 lot 2 (plus gros chantier, je le propose après ta validation) · ⚪ décidé : on garde tel quel.

---

## CRITIQUE

### C1 — Les recharges carte, Orange Money et Sendwave créditent le wallet sans aucun paiement ⚪ gardé jusqu'au lancement (décision de Doniko)
`POST /payments/recharge/card` passe la transaction à PAID et crédite tout de suite (mock « tant qu'aucun vrai PSP n'est branché »). Orange Money réussit par défaut, et le client peut même envoyer `simulateSuccess` lui-même. Tout client connecté peut donc se créditer n'importe quel montant, puis l'envoyer et le faire retirer en cash dans une agence.
**Décision :** les recharges simulées restent actives pour le moment ; tu les bloqueras au grand lancement. Rappel : d'ici là, tout client connecté peut se créditer. Si tu veux, je prépare l'interrupteur (variable d'environnement) pour que le blocage soit une ligne à changer le jour J.

### C2 — Annulation : double remboursement et remboursement d'argent jamais débité ✅
- Le wallet était crédité *avant* de changer le statut, sans verrou : deux clics, ou un clic au moment où l'agent paie le code, remboursaient deux fois (et le cash sortait quand même).
- `cancel()` acceptait n'importe quelle opération de l'expéditeur : une recharge Orange Money en attente (créditée nulle part) ou une déclaration B2B pouvaient être « annulées » et rembourser un montant jamais débité. Combiné à C1, c'est de la création d'argent sans même passer par le mock.
- Un envoi fait par un agent était remboursé sur le wallet *personnel* de l'agent au lieu de la caisse de l'agence.
**Corrigé** (`transactions.service.ts` v4.24) : le statut est réservé par un `updateMany` conditionné, le remboursement est écrit dans la même transaction SQL, seuls TRANSFER et SCHEDULED sont remboursables, et le remboursement va au wallet qui a été débité. Même chose pour l'annulation par un admin.

### C3 — Un admin de société crée de la monnaie électronique à volonté ⚪ voulu (décision de Doniko)
`POST /transactions/admin/fund-self`, `POST /treasury/admin/inject` et `POST /treasury/admin/inject-all` créditent sans contrepartie, sans plafond, sans journal d'audit. `fund-self` crédite même le wallet *personnel* de l'admin (pas celui de la société, que l'écran affiche) : cet argent peut ensuite être envoyé comme un transfert normal.
**Décision :** l'auto-alimentation (`fund-self`, `admin/inject`) est voulue. Non traité, à garder en tête : journal d'audit et plafond n'existent toujours pas sur ces routes.

---

## HAUT

| # | Constat | Statut |
|---|---|---|
| H1 | **Mouvements d'argent non atomiques** : envoi, dépôt, recharge d'agence, remontée / retrait forcé font « débit », « crédit », puis « écriture de la transaction » en trois opérations séparées. Une panne (ou une référence en doublon) entre deux laisse de l'argent débité sans trace. | ✅ lot 2c — création de l'opération, débit, contrôle des plafonds et crédits dans UNE transaction SQL (`transactions.service.ts` v4.27, `agency-treasury.service.ts` v1.3, `wallets.service.ts` v5.6) ; les plafonds sont vérifiés sous le verrou du wallet débité : deux envois simultanés ne passent plus ensemble sous un plafond |
| H2 | **`@Roles(AGENT)` ignoré sur `agent-desk`** : le `RolesGuard` partagé ne lisait que la méthode. N'importe quel compte connecté (même un client) pouvait chercher les clients de sa société par téléphone. | ✅ `roles.guard.ts` v1.1 |
| H3 | **`adminUpdateStatus` d'un retrait sans filtre société** : l'admin d'une société pouvait modifier le statut d'un retrait d'une autre. | ✅ `withdrawals.service.ts` v4.11 |
| H4 | **N'importe quelle référence était « payable » en agence** : dépôt, recharge, facture B2B, remise de caisse… Un agent qui connaissait une référence (elles s'affichent dans l'historique) pouvait la payer et faire créditer sa caisse sans remettre de cash. | ✅ seuls TRANSFER / SCHEDULED en CASH_PICKUP sont payables |
| H5 | **Les sessions v2 ne pouvaient jamais être renouvelées** : `/auth/v2/login-password` (utilisé par le web-admin et le mobile) stockait le refresh token en clair, alors que `/auth/refresh` cherche son SHA-256. D'après le code, toute session tombait en 401 au bout d'une heure, et la base contenait des jetons valides en clair. | ✅ `v2-auth.service.ts` v2.5 + `refresh-token.util.ts` |
| H6 | **Plafonds et KYC jamais appliqués** : `LimitsService` affichait des plafonds mais aucun flux d'argent ne les contrôlait. `POST /limits/request` répondait « Demande enregistrée » sans rien enregistrer. | ✅ lot 2b — plafonds par niveau KYC et par devise réglés par l'admin de société, contrôlés à l'envoi ; changement de niveau depuis la fiche client |
| H7 | **Virements programmés** : frais à 0 (barème ignoré), toujours VALIDATED (seuil ignoré), pas de plafonds ; aucune protection contre un double passage (cron qui se chevauche, ou deux instances) ; une notification qui échoue *après* un succès décalait l'échéance une 2ᵉ fois et pouvait mettre le virement en échec. | ✅ lot 2c — frais du barème, seuil de la société, plafonds KYC ; l'exécution « réserve » l'échéance (mise à jour conditionnelle) puis débite et crée l'envoi dans la même transaction SQL : un seul passage possible ; notifications isolées ; corps de requête validé (DTO), réservé aux clients (rôle USER), retrait cash uniquement |
| H8 | **Rôle et société lus dans le JWT**, pas en base : un compte rétrogradé ou déplacé gardait ses droits jusqu'à une heure. | ✅ `jwt-auth.guard.ts` v4.3 |
| H9 | **Inscription publique en AGENT** (`role` dans le body). | ✅ champ `role` supprimé de `RegisterDto` (ta demande) |

---

## MOYEN

| # | Constat | Statut |
|---|---|---|
| M1 | OTP v1 (6 et 4 chiffres) tirés avec `Math.random()` ; code de retrait à 9 chiffres idem. | ✅ `crypto.randomInt` |
| M2 | Références horodatées (`BILL-`, `DEP-`, `REFILL-`, `REMIT-`, `COLL-`, `WD-`, `CARDMOCK-`) : deux opérations dans la même milliseconde se heurtent à la contrainte d'unicité *après* le mouvement d'argent. Code de retrait à 9 chiffres jamais vérifié unique avant le débit. | ✅ suffixe aléatoire + vérification avant débit |
| M3 | **B2B** : `rejectBankTransfer` remboursait le wallet personnel de l'admin (invisible depuis wallets v5.3) au lieu de celui de la société qui avait été débité ; `validateBankTransfer` pouvait créditer deux fois (double clic) et, si le Super Admin n'a pas de société, cherchait un wallet avec `clientId = null` (c'est-à-dire n'importe quel wallet sans société). | ✅ |
| M4 | `agentProcessPayment` : si la caisse n'a pas la devise payée, il créditait la caisse par défaut ou la première trouvée (autre devise). Même repli pour la caisse de l'agence d'envoi. | ✅ erreur claire / part reversée à la société |
| M5 | `agentCheckCode` / `agentProcessPayment` : 100 essais par minute sur un code à 9 chiffres. | ✅ 20 / minute |
| M6 | Tarif plat et taux par défaut non arrondis (12 345 XOF × 1,5 % = 185,175 XOF), alors que le barème arrondit. | ✅ `fee-schedule.service.ts` v1.1 |
| M7 | `upsertRule` pouvait écraser une ligne de tarif par mode (filtre `payoutMethod: null` manquant). | ✅ |
| M8 | Recharge : deux sondages simultanés de `/payments/recharge/:id/status` créditaient deux fois (contrôle « déjà crédité » hors verrou). | ✅ `WalletsService.creditOnce` |
| M9 | Demande de retrait par `transactionId` : n'importe quelle transaction de la société, doublon → erreur 500. | ✅ |
| M10 | `POST /withdrawals` (retrait cash d'un client depuis son wallet) : frais 1,5 % codés en dur (barème ignoré), débit hors transaction, statut PENDING sans chemin de validation clair. Côté mobile, `requestWithdrawal()` est défini mais **aucun écran ne l'appelle**. | ✅ lot 2a — route, DTO, méthode du service et `requestWithdrawal()` du mobile retirés |
| M11 | Seuil de validation de 500 000 codé en dur, identique pour toutes les devises (500 000 GNF ≈ 50 €, 500 000 EUR). | ✅ lot 2a — réglé par l'admin de société, par devise, dans Réglages (500 000 tant qu'il n'a rien réglé) |
| M12 | Commissions payées en arithmétique flottante, parts non arrondies ; si la conversion des frais échoue, commissions = 0 en silence ; `balanceAfter` du ledger calculé sur un solde lu avant la transaction ; part de la société mise à 0 en silence si son wallet manquait ; parts par défaut dupliquées. | ✅ lot 2c — `commission-split.ts` : chaque part arrondie à la devise, la société prend le reste (payeur + envoi + société = frais exactement) ; taux indisponible = erreur 503 claire, le retrait reste payable plus tard ; crédits via `creditInTx` (solde verrouillé, `balanceAfter` exact) ; constantes par défaut uniques |
| M13 | Commission de l'agence d'envoi calculée avec l'agence *actuelle* de l'expéditeur au lieu de `Transaction.agencyId`. | ✅ lot 2c — `Transaction.agencyId` d'abord, repli sur l'agence de l'expéditeur ; type de l'agence lu en base |
| M19 | **Statut de retrait libre** : `PATCH /admin/withdrawals/:id` acceptait n'importe quel statut, y compris PAID sans aucun mouvement d'argent, et ne figeait pas les statuts finaux. | ✅ lot 2c — PAID interdit à la main (seul l'agent qui remet le cash le pose), statuts finaux figés, transition conditionnelle, journal d'audit |
| M14 | Sessions : v1 supprimait *toutes* les sessions de l'utilisateur à chaque connexion (se connecter sur le mobile déconnectait le web), v2 n'en supprime aucune. | ✅ lot 2a — illimitées partout (`auth.service.ts` v5.10) |
| M15 | Pas de détection de réutilisation d'un refresh token ; deux rafraîchissements simultanés avec le même jeton réussissent tous les deux. | 🔵 |
| M16 | Mot de passe : 6 caractères minimum à l'inscription. | 🟡 |
| M17 | Web : JWT dans `localStorage` (`dtw.access`, `dtw.refresh`) → cookies httpOnly + CSP ; plusieurs pages relancent leurs requêtes deux fois après un rechargement. | 🔵 chantier à part |
| M18 | Écriture de `Transaction.note` / `providerRef` : le prénom / nom d'expéditeur saisi par l'agent est concaténé dans `providerRef` avec un `|` ; un nom contenant `|` fausse l'affichage. | 🔵 mineur |

## BAS

- `rate-alerts` : `body: any` (aucune validation) ; `limits/request` : type en ligne, pas de DTO.
- `GET /users/by-phone` répond à tout compte connecté (100 requêtes / minute) : énumération possible des clients de sa société. À mettre en regard du besoin de l'écran d'envoi.
- Frais fixe du tarif plat non converti dans la devise de l'envoi (documenté dans `fee-rules.ts`, seul le barème convertit).
- ~~Grand livre des commissions `/commissions/ledger/*` non paginé.~~ ✅ lot 2c — `?page=&limit=` (100 par défaut, 500 max) ; totaux calculés par la base sur toute la période.
- Mobile : `hooks/useProtectedRoute.ts` mort, préférences de notifications plus reliées au menu, thèmes par rôle dans quelques écrans, fichiers `expo-router` copiés dans le dossier (voir le mémo de la phase 5).
- **Erreur de compilation déjà présente** (phase 4) : `fee-schedule.service.ts` ligne 277 (`string` contre l'énumération `PayoutMethod`). Corrigée dans le zip.

---

## Ce que contient le lot 1 (24 fichiers, 79 tests au vert)

Backend (`apps/backend/src`) :
- `auth/roles.guard.ts` v1.1, `auth/jwt-auth.guard.ts` v4.3, `auth/refresh-token.util.ts` (nouveau), `auth/auth.service.ts` v5.9, `auth/auth.controller.ts`, `auth/dto/register.dto.ts`, `auth/v2-auth.service.ts` v2.5
- `wallets/wallets.service.ts` v5.5 (`creditInTx`, `debitInTx`, `creditOnce`)
- `transactions/transactions.service.ts` v4.24, `transactions/agency-treasury.service.ts` v1.2
- `withdrawals/withdrawals.service.ts` v4.11, `withdrawals/withdrawals.controller.ts` v4.7
- `payments/recharge.service.ts` v1.2, `commissions/commissions.service.ts` v5.1, `fee-schedule/fee-schedule.service.ts` v1.1
- 8 fichiers de tests `*.spec.ts` (garde des rôles, garde JWT, jeton de renouvellement v2, wallets, remboursements / B2B / références, retraits, arrondi des frais, DTO d'inscription)

Mobile : `services/types.ts` (le champ `role` a disparu de `RegisterPayload`).

## Comment j'ai vérifié

- J'ai pu générer le client Prisma sans moteur : le backend compile entièrement (`tsc --noEmit`) hors module `platform` (8 erreurs, sans lien : `generated/platform-client` n'est pas généré ici).
- Tests : 79 au vert, dont 4 suites qui existaient déjà. Le test sur la garde des rôles échoue bien avec l'ancienne version (vérifié).
- Je n'ai **pas** de base de données ici : les tests utilisent une base simulée en mémoire. Les verrous réels (Postgres) ne sont donc pas exercés — à faire chez toi : une annulation et un paiement de code simultanés sur une base de test.

## Décisions déjà prises

- C1 : recharges simulées gardées jusqu'au lancement. C3 : auto-alimentation voulue. M10 : `POST /withdrawals` retiré. M11 : seuil réglé par l'admin de société. M14 : sessions illimitées.

## Décisions qu'il me faut encore

1. **Passe 2** — On balaie users, clients, agencies, agents-admin, supervision, tenants, rates, notifications, push, mail, bénéficiaires (fuites entre sociétés surtout) ? C'est la suite.
2. Optionnel : l'interrupteur de blocage des recharges simulées (C1), prêt pour le jour du lancement.
3. Optionnel : journal d'audit et plafond sur `fund-self` / `admin/inject` (C3), même si l'auto-alimentation est voulue.
4. Restent ouverts : M15 (réutilisation de refresh token), M16 (mot de passe de 6 caractères), M17 (JWT du web en `localStorage`), M18.
