# Phase 6 — Scanner : rapport de la passe 1 (argent + authentification)

Périmètre de cette passe : tout ce qui touche à l'argent et aux connexions. Toutes les routes du backend ont été inventoriées par script (garde, rôle, contrôle dans le code) ; les services suivants ont été lus en entier : auth (v1 et v2), jetons, gardes, transactions, retraits, wallets, trésorerie (société et agences), barème de frais, commissions, recharges, virements programmés, guichet agent.

**Pas encore lus en détail (passe 2)** : users, clients, agencies, agents-admin, supervision, tenants, rates / exchange-rates, notifications, push, mail, sms, bénéficiaires. Il faudra y chercher surtout les fuites entre sociétés.

Légende : ✅ corrigé dans le zip du lot 1 · 🟡 à valider par toi · 🔵 lot 2 (plus gros chantier, je le propose après ta validation).

---

## CRITIQUE

### C1 — Les recharges carte, Orange Money et Sendwave créditent le wallet sans aucun paiement 🟡
`POST /payments/recharge/card` passe la transaction à PAID et crédite tout de suite (mock « tant qu'aucun vrai PSP n'est branché »). Orange Money réussit par défaut, et le client peut même envoyer `simulateSuccess` lui-même. Tout client connecté peut donc se créditer n'importe quel montant, puis l'envoyer et le faire retirer en cash dans une agence.
**Décision à prendre :** bloquer ces routes en production tant qu'il n'y a pas de vrai prestataire (variable d'environnement, désactivée par défaut), ou les retirer. Je ne l'ai pas fait seul : ça désactive une fonction visible de l'app.

### C2 — Annulation : double remboursement et remboursement d'argent jamais débité ✅
- Le wallet était crédité *avant* de changer le statut, sans verrou : deux clics, ou un clic au moment où l'agent paie le code, remboursaient deux fois (et le cash sortait quand même).
- `cancel()` acceptait n'importe quelle opération de l'expéditeur : une recharge Orange Money en attente (créditée nulle part) ou une déclaration B2B pouvaient être « annulées » et rembourser un montant jamais débité. Combiné à C1, c'est de la création d'argent sans même passer par le mock.
- Un envoi fait par un agent était remboursé sur le wallet *personnel* de l'agent au lieu de la caisse de l'agence.
**Corrigé** (`transactions.service.ts` v4.24) : le statut est réservé par un `updateMany` conditionné, le remboursement est écrit dans la même transaction SQL, seuls TRANSFER et SCHEDULED sont remboursables, et le remboursement va au wallet qui a été débité. Même chose pour l'annulation par un admin.

### C3 — Un admin de société crée de la monnaie électronique à volonté 🟡
`POST /transactions/admin/fund-self`, `POST /treasury/admin/inject` et `POST /treasury/admin/inject-all` créditent sans contrepartie, sans plafond, sans journal d'audit. `fund-self` crédite même le wallet *personnel* de l'admin (pas celui de la société, que l'écran affiche) : cet argent peut ensuite être envoyé comme un transfert normal.
Je comprends que l'auto-alimentation fait partie du modèle (la société règle ensuite la plateforme par virement B2B). À confirmer : est-ce voulu ? Si oui, je propose au minimum un journal d'audit, un plafond configurable par le Super Admin, et la suppression de `fund-self` (doublon).

---

## HAUT

| # | Constat | Statut |
|---|---|---|
| H1 | **Mouvements d'argent non atomiques** : envoi, dépôt, recharge d'agence, remontée / retrait forcé, demande de retrait client font « débit », « crédit », puis « écriture de la transaction » en trois opérations séparées. Une panne (ou une référence en doublon) entre deux laisse de l'argent débité sans trace. | 🔵 lot 2 — `WalletsService.creditInTx / debitInTx` (déjà livrés dans ce lot) permettent de tout regrouper en une transaction SQL |
| H2 | **`@Roles(AGENT)` ignoré sur `agent-desk`** : le `RolesGuard` partagé ne lisait que la méthode. N'importe quel compte connecté (même un client) pouvait chercher les clients de sa société par téléphone. | ✅ `roles.guard.ts` v1.1 |
| H3 | **`adminUpdateStatus` d'un retrait sans filtre société** : l'admin d'une société pouvait modifier le statut d'un retrait d'une autre. | ✅ `withdrawals.service.ts` v4.11 |
| H4 | **N'importe quelle référence était « payable » en agence** : dépôt, recharge, facture B2B, remise de caisse… Un agent qui connaissait une référence (elles s'affichent dans l'historique) pouvait la payer et faire créditer sa caisse sans remettre de cash. | ✅ seuls TRANSFER / SCHEDULED en CASH_PICKUP sont payables |
| H5 | **Les sessions v2 ne pouvaient jamais être renouvelées** : `/auth/v2/login-password` (utilisé par le web-admin et le mobile) stockait le refresh token en clair, alors que `/auth/refresh` cherche son SHA-256. D'après le code, toute session tombait en 401 au bout d'une heure, et la base contenait des jetons valides en clair. | ✅ `v2-auth.service.ts` v2.5 + `refresh-token.util.ts` |
| H6 | **Plafonds et KYC jamais appliqués** : `LimitsService` affiche des plafonds (2 000 / 10 000 / 50 000 par défaut), mais aucun flux d'argent ne les contrôle. `POST /limits/request` répond « Demande enregistrée » sans rien enregistrer. | 🟡 il faut définir les règles (par niveau KYC, par devise) |
| H7 | **Virements programmés** : frais à 0 (barème ignoré), toujours VALIDATED (seuil 500 000 ignoré), pas de plafonds ; aucune protection contre un double passage (cron toutes les 5 min qui se chevauche, ou deux instances) ; une notification qui échoue *après* un succès décale l'échéance une 2ᵉ fois et peut mettre le virement en échec. | 🔵 lot 2 |
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
| M10 | `POST /withdrawals` (retrait cash d'un client depuis son wallet) : frais 1,5 % codés en dur (barème ignoré), débit hors transaction, statut PENDING sans chemin de validation clair. Côté mobile, `requestWithdrawal()` est défini mais **aucun écran ne l'appelle**. | 🟡 on le retire ? |
| M11 | Seuil de validation de 500 000 identique pour toutes les devises (500 000 GNF ≈ 50 €, 500 000 EUR). | 🟡 seuil par devise ? |
| M12 | Commissions payées en arithmétique flottante, parts non arrondies (la part société devrait être « le reste ») ; si la conversion des frais échoue, commissions = 0 en silence ; `balanceAfter` du ledger calculé sur un solde lu avant la transaction. Parts par défaut dupliquées (`withdrawals.service.ts` et `commission-rule-defaults.ts`). | 🔵 lot 2 |
| M13 | Commission de l'agence d'envoi calculée avec l'agence *actuelle* de l'expéditeur au lieu de `Transaction.agencyId`. | 🔵 lot 2 |
| M14 | Sessions : v1 supprime *toutes* les sessions de l'utilisateur à chaque connexion (se connecter sur le mobile déconnecte le web), v2 n'en supprime aucune (sessions illimitées). | 🟡 quelle politique ? |
| M15 | Pas de détection de réutilisation d'un refresh token ; deux rafraîchissements simultanés avec le même jeton réussissent tous les deux. | 🔵 |
| M16 | Mot de passe : 6 caractères minimum à l'inscription. | 🟡 |
| M17 | Web : JWT dans `localStorage` (`dtw.access`, `dtw.refresh`) → cookies httpOnly + CSP ; plusieurs pages relancent leurs requêtes deux fois après un rechargement. | 🔵 chantier à part |
| M18 | Écriture de `Transaction.note` / `providerRef` : le prénom / nom d'expéditeur saisi par l'agent est concaténé dans `providerRef` avec un `|` ; un nom contenant `|` fausse l'affichage. | 🔵 mineur |

## BAS

- `rate-alerts` : `body: any` (aucune validation) ; `limits/request` : type en ligne, pas de DTO.
- `GET /users/by-phone` répond à tout compte connecté (100 requêtes / minute) : énumération possible des clients de sa société. À mettre en regard du besoin de l'écran d'envoi.
- Frais fixe du tarif plat non converti dans la devise de l'envoi (documenté dans `fee-rules.ts`, seul le barème convertit).
- Grand livre des commissions `/commissions/ledger/*` non paginé.
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

## Décisions qu'il me faut

1. **C1** — On bloque les recharges simulées en production (variable d'environnement), ou on les retire ?
2. **C3** — L'auto-alimentation par l'admin de société est-elle voulue ? Plafond et journal d'audit ?
3. **H6** — Plafonds par niveau KYC : quelles valeurs, par devise ?
4. **M10** — On retire `POST /withdrawals` (retrait cash depuis le wallet d'un client) ?
5. **M11** — Seuil de validation par devise : quelles valeurs ?
6. **M14** — Politique de sessions : une seule par utilisateur, une par appareil, ou illimitées ?
7. **Lot 2** — On l'attaque ensuite ? Il regroupe H1 (atomicité), H7 (virements programmés), M12 / M13 (commissions) et les statuts libres d'un retrait (un admin peut mettre PAID sans mouvement d'argent).
