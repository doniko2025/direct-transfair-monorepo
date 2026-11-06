# Lot 6 — Taux jamais en dur, code non auto-encaissable, plafond + anti-blanchiment des dépôts

Aucun commit ni push n'a été fait. Dépliez le zip à la racine du dépôt, puis `pnpm install` n'est pas nécessaire (aucune dépendance ajoutée) et **aucune migration Prisma** n'est requise.

Vérifications : backend `tsc` propre, `jest` 60 suites / 595 tests verts ; `tsc` propre sur web-admin, mobile et packages/shared.

---

## 1. Un agent ne peut plus encaisser un code qu'il a créé lui-même

- `transactions/pickup-rules.ts` : nouvelle règle `assertNotOwnSend`. Erreur 403 `SELF_PAYOUT_FORBIDDEN` : « un autre agent doit remettre le cash ».
- Appliquée dans `withdrawals.service.ts` à **la vérification du code** (`agentCheckCode`) et **au paiement** (`agentProcessPayment`), avant toute écriture.
- Tests : `pickup-rules.spec.ts` et `withdrawals.service.spec.ts`.

## 2. Taux de change : plus aucun taux écrit dans le code

Avant, une table cachée (EUR→XOF 655,957, EUR→GNF 9 500…) prenait le relais en silence quand la base n'avait pas de taux ou en cas de panne : montants reçus, commissions et seuils anti-blanchiment pouvaient être faux sans que personne ne le voie.

Maintenant :
- `rates/rate-resolver.ts` (nouveau, fonction pure) : direct → inverse → pivot par l'euro, formats `EUR_XOF` et `EUR/XOF` lus, taux nul/négatif ignoré.
- `rates/rates.service.ts` : taux lus **uniquement en base**. Taux absent → erreur **503** « Taux de change X → Y indisponible : il doit être fixé par l'administrateur ». `getRate()` synchrone et `FALLBACK_RATES` supprimés. Au démarrage, les couples manquants sont listés dans les logs.
- Option : `RATE_MAX_AGE_HOURS` (ex. `72`) refuse un taux plus vieux que cette durée (503 « trop ancien »). Absent = pas de contrôle.
- Anti-blanchiment : si le taux est indisponible, l'opération est **signalée pour revue manuelle** au lieu d'être évaluée avec un montant deviné (`aml-scoring.ts` v1.1).
- Alertes de taux : elles utilisent le même résolveur. Avant, une alerte XOF→GNF (via l'euro) ou sur une ligne à l'ancien format ne se déclenchait jamais.
- Écran admin des taux (web) : plus de « taux de secours ». Un couple sans taux affiche **« Non configuré »** avec l'avertissement que les conversions sont refusées. `fallbackRate` retiré de `packages/shared` et de l'API admin.
- Mobile : `send.tsx` et `send-cash.tsx` utilisent `utils/rateLookup.ts` (taux publiés uniquement). Taux absent → aucune estimation, message clair, bouton d'envoi bloqué. Les taux de secours `EXPO_PUBLIC_FALLBACK_RATES` et les valeurs 655,95 / 8600 / 9600… sont supprimés.

### À faire avant de déployer
1. **Renseigner tous les taux** dans Admin › Taux (EUR→XOF, EUR→GNF, EUR→GBP, EUR→USD au minimum). Les autres couples (XOF↔GNF…) se calculent via l'euro.
2. Surveiller les logs de démarrage : ils listent les couples encore manquants.
3. `prisma/seed.ts` contient toujours des taux **initiaux** pour une base neuve : c'est une donnée en base, modifiable, pas un taux en dur — mais vérifiez qu'elle correspond à vos taux réels.

## 3. Dépôt en agence : plafond + anti-blanchiment

- Plafond : `deposit()` applique les **mêmes plafonds KYC que l'envoi** (par dépôt, jour, mois, an, par devise), cumul propre aux dépôts du client (`transfer-limits.service.ts` v1.1, `assertDepositWithinLimits`). Dépassement → 403 `DEPOSIT_LIMIT_EXCEEDED` avec le montant restant. Vérifié **dans la transaction SQL**, donc le dépôt est annulé en bloc.
- Anti-blanchiment : `scoreAml(..., 'DEPOSIT')` évalue le dépôt au nom du **client qui reçoit le cash** (montant, rafale sur 24 h, ancienneté du compte), crée un `AmlFlag` « Dépôt en agence — … » si le score atteint le seuil. Non bloquant, comme pour l'envoi. Seuils inchangés : `AML_THRESHOLD_XOF` (2 000 000) et `AML_FLAG_SCORE` (60).
- L'écran Réglages › Plafonds précise désormais que les plafonds couvrent aussi les dépôts.

### ⚠️ Changement de comportement à connaître
Un client **niveau KYC 0** a par défaut un plafond d'environ 100 € par opération (≈ 65 000 XOF). Des dépôts cash plus gros qu'avant seront refusés tant que son niveau n'est pas relevé (fiche client) ou que les plafonds ne sont pas ajustés (Réglages › Plafonds).

## 4. Autres corrections de l'audit

- **Commissions** (`commissions.service.ts`) : l'historique n'exclut plus les caisses désactivées — des gains réellement crédités disparaissaient de l'historique et des totaux si l'agence était désactivée ensuite ; la caisse d'agence est aussi filtrée par société (cloisonnement).
- **Alertes de taux** : voir §2.

## 5. Constats non traités (décisions à prendre)

- **KYC** : le niveau est changé à la main par l'admin ; il n'existe **aucun parcours de dépôt/validation de pièces** (upload, revue, statut). Les plafonds ne valent donc que ce que valent les contrôles manuels de l'admin. À construire avant l'ouverture au public.
- **Envois « au comptoir » par un agent** (send-cash) : pas de plafond ni de suivi par client, l'expéditeur n'a pas de compte. Décision métier (plafond par agent/jour ? pièce d'identité obligatoire au-dessus d'un seuil ?).
- Facteurs d'échelle des plafonds par défaut (XOF ×650, GNF ×10 000) inchangés : à confirmer avec vos taux réels.
- Audit des écrans mobile/web : j'ai audité en détail les écrans qui affichent ou calculent des montants et des taux (envoi wallet, envoi cash agent, taux admin, plafonds). Les autres écrans n'ont pas été relus ligne à ligne dans ce lot.

## Fichiers modifiés / ajoutés

Backend : `commissions/commissions.service.ts`, `rate-alerts/rate-alerts.service.ts` (+spec), `rates/rate-resolver.ts` (+spec), `rates/rates.service.ts`, `rates-admin/rates-admin.service.ts`, `rates-admin/rates-admin.module.ts`, `transactions/aml-scoring.ts` (+spec), `transactions/pickup-rules.ts` (+spec), `transactions/transactions.service.ts`, `transactions/transactions.atomicity.spec.ts`, `transactions/transactions.deposit-aml.spec.ts`, `transfer-limits/transfer-limits.service.ts`, `transfer-limits/transfer-limits.deposit.spec.ts`, `withdrawals/withdrawals.service.ts` (+spec).
Partagé : `packages/shared/src/rates.ts`.
Web-admin : `lib/ratesRules.ts`, `pages/rates/{RatesPage,RateEditDialog,RateHistoryPage}.tsx`, `pages/settings/{LimitsDialog,LimitsSection}.tsx`.
Mobile : `app/(tabs)/send.tsx`, `app/agent/send-cash.tsx`, `services/api.ts`, `services/platformConfig.ts`, `utils/rateLookup.ts`.
