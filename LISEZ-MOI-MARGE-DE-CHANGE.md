# Marge de change propre à chaque société

Chaque société règle un pourcentage (0 à 10 %) retenu sur **chaque conversion côté client**. C'est son gain sur le change, même avec des frais d'envoi à 0.

Exemple : taux publié EUR → GNF = 10 700, marge 2 % → le client obtient 10 486. Sur 1 000 € envoyés, la société gagne 20 € (estimation, en devise d'envoi).

**Par défaut la marge vaut 0 : aucun changement de comportement pour les sociétés existantes.**

## Ordre de déploiement (important)
1. **Backend** : copier les fichiers, puis `pnpm --filter direct-transfair-backend prisma migrate deploy` (migration `20261122230000_fx_margin` : 2 colonnes, `IF NOT EXISTS`, sans risque), puis `prisma generate` et redémarrer.
2. **Web-admin** (dépend de `packages/shared`).
3. **Mobile** (en dernier : il lit `fxMarginPct` publié par le backend ; sans backend à jour, il se comporte comme avant).

## Fichiers (chemins depuis la racine du monorepo)
**Backend** : `prisma/schema.prisma`, `prisma/migrations/20261122230000_fx_margin/migration.sql`, `src/rates-admin/{rate-rules.ts, rates-admin.service.ts, rates-admin.controller.ts, dto/rates-admin.dto.ts, fx-margin.spec.ts}`, `src/rates/rates.service.ts`, `src/exchange-rates/{exchange-rates.service.ts, .spec.ts}`, `src/transactions/{transactions.service.ts, transactions.atomicity.spec.ts}`, `src/agent-desk/{agent-desk.service.ts, agent-desk.threshold.spec.ts}`, `src/growth/growth.service.ts`, `src/pilotage/{pilotage.service.ts, pilotage.rules.ts, pilotage.rules.spec.ts}`
**Shared** : `packages/shared/src/{rates.ts, pilotage.ts}`
**Web-admin** : `src/pages/rates/{FxMarginCard.tsx (nouveau), RatesPage.tsx}`, `src/pages/pilotage/ProfitabilityPage.tsx`, `src/lib/ratesRules.ts`, `src/styles/rates.css`
**Mobile** : `utils/rateLookup.ts`, `services/{api.ts, types.ts}`, `components/home/ExpressSendCard.tsx`, `app/(tabs)/rates.tsx`

## Ce qui change
- **API** : `GET /rates-admin` renvoie aussi `fxMarginPct` et `maxFxMarginPct` ; `GET/PATCH /rates-admin/margin` (écriture : admin de société ; super admin en lecture seule). Chaque changement est tracé (audit `FX_MARGIN_UPDATE`).
- **Taux publiés** (`GET /exchange-rates`) : chaque ligne porte `fxMarginPct`. Les taux restent les taux publiés ; les apps affichent taux × (1 − marge).
- **Envoi / dépôt agent / verrouillage de taux** : le montant reçu est calculé avec le taux net. La marge appliquée est enregistrée sur la transaction (`Transaction.fxMarginPct`) pour une rentabilité exacte même si la marge change plus tard.
- **Web-admin** : carte « Marge de change » en haut de la page Taux (valeurs rapides, saisie, exemple chiffré en direct). La page Rentabilité, le CSV et le rapport mensuel affichent le « Gain de change » ; la marge nette l'inclut.
- **Mobile** : accueil, simulateur, Express, écran Taux et Envoyer affichent le taux net, donc exactement ce que le destinataire reçoit.

## Périmètre
- Pas de marge sur les transferts entre portefeuilles, les paiements de factures, ni sur les conversions internes (limites, frais, trésorerie, conformité) : elles restent au taux brut.
- La marge **s'ajoute** à la marge du verrouillage de taux (`RATE_LOCK_MARGIN_PCT`, 0,2 % par défaut). Pour que le client ne subisse que votre marge, mettez cette variable à 0.
- Le gain de change est une estimation en devise d'envoi (montant × marge) ; il est calculé sur les envois VALIDATED, PROCESSING et PAID.

## Vérifications
1. Taux > Marge de change : régler 2 % → l'exemple passe de 10 700 à 10 486.
2. Appli mobile : accueil et écran Taux affichent 10 486 ; envoyer 1 000 € → le destinataire reçoit 10 486 000 GNF (moins la marge de verrouillage éventuelle).
3. Rentabilité : « Gain de change » = 20 € pour cet envoi.
4. Remettre 0 % : tout redevient comme avant.

## Testé / non testé
- Testé : tests unitaires backend ciblés (26 suites, 311 tests), contrôle de types mobile et web-admin, formule `lookupRate` vérifiée.
- Non testé : appareil réel, serveur et base en direct (migration non rejouée ici ; `prisma generate` impossible dans mon environnement). Les suites hors périmètre qui échouent dans mon bac à sable viennent de ma simulation de Prisma, pas de ces changements.
