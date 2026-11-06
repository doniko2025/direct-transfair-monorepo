# Lot 5 — Audit de l'argent (backend)

Périmètre lu ligne à ligne : moteur des wallets, création d'envoi, dépôt agent, recharge d'agence, virements B2B, annulation / remboursement / expiration des codes, paiement d'un retrait en agence, répartition des commissions, remontée / retrait forcé de caisse, trésorerie, recharges, envois programmés, plafonds, taux de change, rôles des routes d'argent.

**Pas de migration. Aucune variable d'environnement nouvelle.** Compilation propre, 557 tests verts (24 nouveaux).

---

## Corrigé dans ce lot

### 1. CRITIQUE — un agent pouvait se fabriquer de l'argent
`GET /payments/recharge/:id/status` (ouvert à tout utilisateur connecté) cherchait « une transaction de type DEPOSIT dont je suis l'expéditeur ». Or un **dépôt en agence** est aussi de type DEPOSIT, payé, avec l'**agent** comme expéditeur. En appelant cette route avec l'identifiant d'un de ses propres dépôts, l'agent faisait créditer son wallet personnel du montant du dépôt, **en plus** du client déjà crédité. Recommençable à chaque dépôt.
**Correctif** (`payments/recharge.service.ts`) : seule une vraie recharge est réglée (direction entrante, expéditeur = destinataire). Test reproduisant la faille : il échoue sur l'ancien code, passe sur le nouveau.

### 2. ÉLEVÉ — arrondis qui créaient ou perdaient de l'argent
Les colonnes d'argent sont en `Decimal(18,4)`, mais le moteur de wallets écrivait les montants tels quels. Plusieurs DTO (`RefillAgencyDto`, `FundSelfDto`, `DeclareB2BDto`) acceptaient n'importe quelle précision. PostgreSQL arrondit chaque colonne séparément : 9,99995 devenait 10,0000 d'un côté et 10,00005 devenait 10,0001 de l'autre. Un dix-millième d'écart par opération, répétable.
**Correctif** : nouveau `wallets/money.ts` (`toMoney`) : arrondi unique à 4 décimales avant d'écrire le solde ET le journal, avec la même valeur. NaN, infini, zéro et montants qui s'annulent à l'arrondi sont refusés. Branché sur `debitInTx`, `creditInTx`, `hold`, `unhold`, `transferInTx` (donc sur tous les flux). DTO bornés (4 décimales, min 0,01, max).

### 3. MOYEN — recharge d'agence par un Super Admin : mauvaise société débitée
`refillAgency` débitait toujours le wallet de la société de l'admin qui clique. Pour un Super Admin, la caisse d'une agence de la société A était rechargée avec l'argent de **sa** société, et la ligne était rangée chez lui. (`collectFromAgency` faisait déjà le bon choix.)
**Correctif** : la société débitée est celle de l'agence ; la transaction et l'audit lui sont rattachés.

### 4. MOYEN — statuts manuels qui fermaient une ligne sans que l'argent suive
Un admin société pouvait passer à la main un virement B2B à « validé / payé » : facture soldée, société débitée, **plateforme jamais créditée** (l'argent disparaissait). De même, une recharge pouvait être passée « payée » à la main, ce qui déclenche le crédit du wallet.
**Correctif** : B2B (VALIDATED / PAID) et recharge (PAID) refusés en manuel. L'annulation d'un B2B en attente reste possible et rembourse. La validation d'un envoi au-dessus du seuil (PENDING → VALIDATED) fonctionne comme avant.

### 5. MOYEN — frais convertis au taux du jour au lieu du taux de l'envoi
Un code reste payable jusqu'à 5 mois. Au paiement, les frais étaient convertis au taux du moment, alors que le montant remis au bénéficiaire l'avait été au taux de l'envoi : commissions et cash partaient de deux taux différents, l'écart tombait dans la caisse de la société sans trace.
**Correctif** (`withdrawals.service.ts`) : conversion au taux enregistré sur l'envoi ; repli sur le taux courant uniquement pour les anciens envois sans taux (comportement d'avant, y compris le 503 si aucun taux).

### 6. FAIBLE — deux incohérences
- Remboursement d'un envoi fait depuis une caisse d'agence **désactivée** : il partait sur le wallet personnel d'un agent désactivé (argent bloqué). Il revient maintenant à la caisse d'origine.
- Alerte « solde bas » du dépôt : seuil de 50 000 en dur pour toutes les devises. Elle utilise maintenant le seuil réglé par la société, par devise (comme le paiement d'un retrait).

---

## Constaté sain (vérifié, rien à changer)
- Verrous de wallet, ordre de verrouillage des transferts à deux wallets, solde relu sous verrou, `balanceAfter` exact dans le journal.
- Annulation / échec / expiration : statut réservé par `updateMany` puis remboursement dans la **même** transaction SQL, impossible de rembourser deux fois ni de payer un code annulé en même temps.
- Paiement d'un retrait : même mécanique ; somme des commissions = frais, au centime (la société prend le reste).
- Envois programmés : clé d'idempotence + réservation de l'échéance, pas de double débit.
- Rôles et isolation entre sociétés sur les routes d'argent ; clés d'idempotence bien envoyées par le mobile et le web (envoi, dépôt, recharge d'agence, remise, collecte).
- Seul `wallets.service` modifie les soldes (les autres services ne font que créer des wallets à 0 ou les désactiver).

---

## À décider ou à faire plus tard (non modifié ici)
1. **Taux de change** : si un taux manque en base, un taux **en dur** est utilisé en silence (simple avertissement dans les logs), sans contrôle d'ancienneté. En production, mieux vaut refuser (503) qu'appliquer un taux inventé, et alerter si un taux a plus de 24 h.
2. **Suppression** d'une société / agence / utilisateur avec solde non nul ou envois en cours : simples avertissements. Choix à faire : bloquer tant que le solde n'est pas nul et qu'aucun envoi n'est en cours.
3. **Dépôt en agence** : pas de plafond ni de scoring LCB-FT (l'envoi en a).
4. **Séparation des tâches** : un agent peut encaisser un code qu'il a lui-même créé (même agence). Pas une perte d'argent, mais un point de contrôle de fraude.
5. **Envois programmés** après une longue panne : rattrapage un par passage (rafale de prélèvements) ; dates en heure du serveur.
6. **Déjà signalés** : OTP stockés en clair, ~67 `findMany` sans borne (dont la liste admin de toutes les transactions de la société), taux en flottant, double envoi des alertes de taux avec plusieurs instances, crons en heure du serveur.

## Non couvert par cet audit
`commissions.service.ts` (seul son test de journal a été lu), le détail des écrans mobile / web, les alertes de taux, le KYC. À faire dans un second temps si tu veux.

---

## Fichiers du lot (11)
```
apps/backend/src/wallets/money.ts                       (nouveau)
apps/backend/src/wallets/money.spec.ts                  (nouveau)
apps/backend/src/wallets/wallets.service.ts
apps/backend/src/payments/recharge.service.ts
apps/backend/src/payments/recharge.settle.spec.ts       (nouveau)
apps/backend/src/transactions/transactions.service.ts
apps/backend/src/transactions/transactions.money-audit.spec.ts   (nouveau)
apps/backend/src/transactions/dto/create-transaction.dto.ts
apps/backend/src/withdrawals/withdrawals.service.ts
apps/backend/src/withdrawals/withdrawals.service.spec.ts
docs/LISEZ-MOI-corrections-5.md
```

## Application
Décompresser à la racine du dépôt (les chemins sont déjà relatifs), puis :
```bash
cd apps/backend && npx tsc --noEmit && npx jest --ci
```
Aucune migration, aucun redémarrage particulier. Je n'ai pas touché à git : le commit est à toi.
