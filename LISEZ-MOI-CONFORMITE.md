# Lot 3 — Conformité et robustesse

Ce lot ajoute : le **filtrage des listes de surveillance** (sanctions, personnes exposées, liste interne), des **règles anti-blanchiment réglables par société** avec des dossiers à examiner, et des **webhooks sortants fiables** (signature, reprises, rejeu, protection contre les adresses internes, désactivation automatique).

## Mise en service (dans cet ordre)

1. Appliquer les fichiers du zip (mêmes chemins que le dépôt).
2. **Base de données** : `pnpm --filter direct-transfair-backend exec prisma migrate deploy` (migration `20261119170000_compliance`, idempotente), puis `prisma generate`.
3. Redémarrer le backend. Le moteur des webhooks et le reste démarrent seuls.
4. Se connecter en administrateur de société : menu **Conformité** et **Webhooks**.

Variables facultatives (`apps/backend/.env.example`) : `WEBHOOKS_CRON`, `WEBHOOK_DISABLE_AFTER`, `WEBHOOK_ALLOW_HTTP` (développement seulement).

## Ce que ça fait

### Listes de surveillance (Conformité → Listes)
- Saisie fiche par fiche, ou **import en masse** : `Nom ; alias1 | alias2 ; pays ; année ; référence`.
- Chaque envoi (expéditeur, destinataire, bénéficiaire, client de passage) est comparé aux fiches actives. La comparaison ignore accents, casse, ponctuation et ordre des mots, et tolère les fautes de frappe (« Mohamed » ≈ « Mohammed »).
- **Un nom seul ne correspond pas à un nom complet** : « Diallo » dans une liste ne déclenche pas l'alarme pour chaque Diallo.
- Outil **Tester un nom** (pourcentage de ressemblance, sans rien enregistrer) pour régler les seuils.
- Bouton **Contrôler toute la clientèle** : compare tous vos clients aux listes, un dossier par correspondance.

### Dossiers (Conformité)
- Un dossier est ouvert pour chaque correspondance, **et pour chaque envoi signalé par le score anti-blanchiment** (les anciens signalements `AmlFlag`, jusque-là sans écran, deviennent examinables ; ils passent « examinés » quand le dossier est clos).
- Détail explicable : noms rapprochés avec pourcentage, raisons du score, règles déclenchées.
- Actions : prendre en charge, escalader, clore, classer sans suite — **justification obligatoire** (5 caractères) et tracée au journal d'audit.
- Alerte (page Supervision) + notification aux administrateurs.

### Blocage d'un envoi (désactivé par défaut)
- Réglages → Règles → « Bloquer automatiquement une correspondance forte » : un envoi encore **en attente ou validé** est suspendu (`ON_HOLD`) jusqu'à décision. Un envoi déjà payé n'est jamais bloqué (dossier seulement).
- Décision : **Débloquer** (l'envoi reprend son statut d'avant) ou **Rejeter et rembourser** (annulation + remboursement atomique, même chemin que toute annulation).
- Le client voit seulement « Vérification en cours » (aucune raison donnée : devoir de discrétion). Les webhooks **n'émettent rien** pour un envoi bloqué.

### Règles anti-blanchiment par société (Conformité → Règles)
- Seuil de contrôle et score de signalement (à défaut : valeurs de la plateforme).
- Nouveaux critères, +25 points chacun : **pays à risque**, **fractionnement** (N envois juste sous le seuil en 24 h), **regroupement de fonds** (N expéditeurs vers un même bénéficiaire en 24 h). 0 coupe la règle.
- Le score ne bloque jamais seul : il ouvre un dossier.

### Webhooks (menu Webhooks)
- Événements : `transaction.created / validated / processing / paid / cancelled / failed / expired / refunded`.
- Chaque appel : POST JSON signé (`X-DirectTransfair-Signature: t=…,v1=…`, HMAC-SHA256 de `horodatage.corps`), exemple de vérification fourni dans la page.
- **Reprises** à délai croissant (×2 à chaque fois, plafonné à 6 h) ; après épuisement : « Échec », **rejouable** (un envoi ou tous les échecs d'un point de réception).
- **Désactivation automatique** après 20 échecs consécutifs : alerte + notification ; la réactivation reprend les envois en attente.
- **Sécurité** : https obligatoire, adresses internes/privées refusées (y compris après résolution DNS), aucune redirection suivie, délai maximal 8 s, secret montré une seule fois (régénérable).
- Fiabilité : aucun point du code existant n'est modifié pour émettre les événements — un relevé chaque minute déduit les changements d'état, avec clé d'unicité (jamais de doublon). Si un envoi passe par plusieurs états en moins d'une minute, seul l'état courant est notifié.

## Fichiers

- Backend : `src/compliance/*` (nouveau), `src/webhooks/*` (nouveau), `src/transactions/transactions.service.ts` (règles AML par société, dossiers, filtrage après chaque envoi, `releaseHeld` / `rejectHeld`), `src/transactions/aml-scoring.ts` (seuil/score réglables), `src/app.module.ts`, `prisma/schema.prisma` + migration.
- Partagé : `compliance.ts`, `webhooks.ts`, `api.ts`, `index.ts`, `supervision.ts` (3 types d'alerte).
- Web : pages `compliance/` (Dossiers, Listes, Règles) et `webhooks/`, `lib/complianceRules.ts`, `styles/compliance.css`, routes, menu, libellés d'alertes.
- Mobile : libellé neutre « Vérification en cours » pour un envoi suspendu.

## Vérifications faites

- 27 tests Conformité (noms proches, règles, import, filtrage), 13 tests Webhooks (anti-SSRF, signature, reprises, événements), 10 tests d'envoi (règles par société, rejet/déblocage avec remboursement) : tous passent.
- Compilation : partagé, web (+ build), mobile OK ; backend OK hors types Prisma.
- **Non exécuté ici** : la génération du client Prisma et la migration (téléchargement bloqué sur mon poste), donc aucun test contre une vraie base ni un vrai serveur de webhooks. Après `prisma generate`, lancez `pnpm --filter direct-transfair-backend test`, puis un test de bout en bout : ajouter une fiche, faire un envoi au même nom, vérifier le dossier ; créer un webhook sur un service de test (webhook.site) et utiliser « Tester ».

## Pistes (pas faites)
- Import automatique de listes officielles publiques (ONU, UE, OFAC) par tâche planifiée.
- Événements webhook pour KYC et dépôts ; relevé en temps réel (outbox transactionnelle) si le volume l'exige.
- Rapport de conformité mensuel (dossiers ouverts/clos, délais de traitement) envoyé aux administrateurs.
