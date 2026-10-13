# Phase 6 — Lot 2c : mouvements d'argent atomiques, virements programmés, commissions, statuts de retrait, journal paginé (à appliquer après les lots 2a et 2b)

## Contenu du zip

- 18 fichiers **complets** + `RAPPORT-phase6.md` mis à jour (chemins relatifs à la racine du dépôt). Aucune migration, aucune suppression.
- `transactions.service.ts` contient aussi les lots 2a et 2b : applique-les d'abord (ou ensemble).

## Ce qui change

**Argent atomique (H1)**
- Envoi, dépôt au guichet, recharge d'agence, remontée de caisse et retrait forcé : la création de l'opération, le débit, le contrôle des plafonds et les crédits se font dans **une seule transaction SQL**. Une panne ou une référence en doublon au milieu annule tout : plus d'argent débité sans trace.
- Les plafonds KYC sont vérifiés **sous le verrou du wallet** débité : deux envois simultanés d'un même client ne peuvent plus passer ensemble juste sous un plafond (point laissé ouvert au lot 2b).

**Virements programmés (H7)**
- Ils appliquent maintenant le **barème de frais**, le **seuil de validation** de la société (lot 2a) et les **plafonds KYC** (lot 2b). Avant : frais à 0, toujours validés.
- Un virement ne peut plus s'exécuter deux fois (cron qui se chevauche, deux instances) : l'échéance est « réservée » par une mise à jour conditionnelle dans la même transaction que le débit.
- Une notification ou un email qui échoue après un succès ne décale plus l'échéance une seconde fois.
- Création validée : montant positif, devise et fréquence connues, **retrait cash uniquement** (les autres modes envoyaient l'argent sans crédit côté destinataire), première exécution par défaut 60 secondes après la création. Réservé aux clients (rôle USER).

**Commissions au paiement d'un retrait (M12, M13)**
- Chaque part est arrondie à la devise (0 décimale en XOF / GNF, 2 sinon) et la part de la société est **le reste** : agence payeuse + agence d'envoi + société = frais, exactement.
- Si le taux pour convertir les frais est indisponible, le paiement répond **503** avec un message clair (le retrait reste payable plus tard). Avant : toutes les commissions étaient mises à 0 en silence, définitivement.
- Wallet de la société introuvable : erreur au lieu d'une part perdue en silence.
- Crédits via `WalletsService.creditInTx` : wallet verrouillé, solde relu, `balanceAfter` exact dans le journal.
- Agence d'envoi = celle enregistrée sur l'envoi (`Transaction.agencyId`), pas l'agence actuelle de l'expéditeur ; son type (filiale / partenaire) est lu en base.

**Statut d'un retrait (admin)**
- `PATCH /admin/withdrawals/:id` : **PAID ne peut plus être posé à la main** (il ne correspondait à aucun mouvement d'argent). Seul l'agent qui remet le cash avec le code paie. Les statuts finaux (payé, rejeté, échoué, annulé, expiré) ne sont plus modifiables ; chaque changement est journalisé. Aucun écran web ni mobile n'appelle cette route aujourd'hui.

**Journal des commissions paginé**
- `GET /commissions/ledger/mine` et `/company` : `?page=1&limit=100` (500 max). Les totaux et `count` couvrent toute la période (calculés par la base), `entries` la page demandée, plus `page`, `limit`, `hasMore`. Les écrans actuels affichent donc les 100 plus récentes écritures ; un bouton « Voir plus » pourra utiliser `hasMore`.

## À savoir

- Un envoi refusé par un plafond annule maintenant tout, y compris le débit : c'est voulu.
- `shared/commissions.ts` : `createCommissionsApi().mine/company(period, { page, limit })`.

## Vérifications faites

- Backend : `tsc --noEmit` propre (hors module `platform`) ; **19 suites, 172 tests** au vert, dont 9 sur l'atomicité (validation et annulation complète en cas d'échec), 10 sur les virements programmés, 7 sur le calcul des parts, 16 sur les retraits, 5 sur le journal paginé. `tsc` du package shared propre.
- **Pas de base Postgres ici** : les verrous réels et les transactions SQL ne sont pas exercés (tests sur base simulée). À faire chez toi sur une base de test : deux envois simultanés du même client près d'un plafond, une annulation en même temps que le paiement du code, deux exécutions simultanées d'un virement programmé.
- Aucune migration dans ce lot. Après copie : `pnpm build` dans `apps/backend`.
