# Lot 7 — Vérification d'identité (KYC) obligatoire et envois au comptoir

Ce lot traite les deux derniers points restés ouverts de l'audit : **le KYC** et **les envois faits au comptoir par un agent**.
Aucun commit ni push n'a été fait : appliquez les fichiers du zip puis commitez vous-même.

## Ce qui change pour les gens

### Client wallet (application mobile)
- **Tant que son identité n'est pas validée par un administrateur, un client ne peut ni envoyer, ni programmer un virement.**
  Il peut toujours recevoir de l'argent, recharger et se faire déposer du cash (dans les plafonds du niveau 0).
- Nouveau parcours **Profil › Vérification d'identité** : une carte d'état animée, puis deux étapes obligatoires
  (pièce d'identité recto/verso selon la pièce, puis selfie) et une étape facultative (justificatif de domicile) qui relève les plafonds.
  Un refus affiche le motif de l'administrateur et propose de renvoyer ; une pièce expirée est signalée.
- **Bannière sur l'accueil** tant que l'identité n'est pas vérifiée.
- Si le client tente quand même d'envoyer, il reçoit « Vérification d'identité requise » avec un bouton qui ouvre l'écran de vérification.
- **Alertes et rappels** (notification dans l'application + notification push + e-mail) :
  décision de l'administrateur (validée / partielle / refusée / révoquée), pièce expirée, et **rappels automatiques** tous les jours à 10 h (Paris)
  tant que rien n'est validé : 24 h après l'inscription, puis +2 jours, +4 jours, puis chaque semaine, 12 rappels au maximum.
  Pas de rappel quand un dossier est déjà en cours d'examen.

### Administrateur de société / super administrateur (portail web)
- Nouvelle entrée de menu **Vérifications KYC** avec pastille du nombre de dossiers à valider.
- **File de validation** : onglets À valider / Refusés / Rien envoyé / Vérifiés / Tous, recherche, compteurs, ancienneté du plus vieux dossier,
  ordre « premier arrivé, premier servi », pagination côté serveur.
- **Dossier d'un client** : informations du compte (nom, naissance, adresse) à côté des pièces pour comparer, photos agrandissables avec zoom et rotation (PDF ouvert dans un onglet),
  **Valider** (note interne facultative), **Refuser** (motif obligatoire, motifs fréquents en un clic, envoyé au client), **Révoquer** une pièce déjà validée,
  **Relancer** le client (au plus un rappel toutes les 12 h), historique des versions.
- Un résumé quotidien prévient les administrateurs des dossiers qui attendent depuis plus de 24 h.
- Lien « Voir le dossier d'identité » depuis la fiche d'un client wallet. Le changement manuel de niveau KYC n'est plus possible sans pièces validées
  (erreur 409 `KYC_DOCUMENTS_REQUIRED`) ; baisser un niveau reste toujours possible.

### Agent (envoi cash au comptoir)
- L'envoi pour un client de passage **exige désormais son identité** : prénom, nom, téléphone, date de naissance (18 ans révolus),
  type, numéro et date d'expiration d'une pièce en cours de validité (pays émetteur facultatif). Sans cela : 400 `COUNTER_ID_REQUIRED`.
- Chaque personne a une **fiche** par société (clé = numéro de pièce). Même numéro de pièce avec un autre nom ou une autre date de naissance : 403 `COUNTER_ID_MISMATCH`.
  Même téléphone avec une autre pièce : accepté mais signalé à la conformité.
- **Plafonds** : un envoi au comptoir est limité par les plafonds du **niveau 1** de la société, **cumulés par personne** (toutes ses fiches, tous agents et agences confondus) :
  403 `COUNTER_LIMIT_EXCEEDED` avec le reste disponible. Un verrou par personne empêche deux agents simultanés de contourner le plafond.
- Le score anti-blanchiment évalue l'historique de la personne (motif préfixé « Envoi au comptoir »).

## Règles de niveau
- Niveau 1 = pièce d'identité validée + selfie validé (non expirés). Niveau 2 = en plus un justificatif de domicile / relevé bancaire validé. Niveau 3 = décision manuelle de l'administrateur.
- Le niveau ne monte que par une validation de l'administrateur. Il redescend si une pièce validée est révoquée ou arrive à expiration
  (un job de nuit à 03 h 40 passe les pièces expirées en « EXPIRED » et prévient le client).

## À faire pour appliquer
1. Copier les fichiers du zip dans le projet (dossier par dossier, mêmes chemins).
2. `cd apps/backend && npx prisma migrate deploy && npx prisma generate`
   La migration `20261107090000_kyc_documents_and_counter_customers` crée `kyc_files`, `counter_customers`, les colonnes de rappel sur `users`
   et `transactions.counterCustomerId`. **Elle est écrite à la main** (idempotente) et n'a pas pu être testée sur une vraie base ici : lancez-la d'abord sur une copie.
3. Redémarrer le backend. Le corps des requêtes JSON reste limité à 100 ko **sauf** `POST /api/kyc/documents` (18 Mo, pour les photos) : c'est le seul changement dans `main.ts`.
4. Mobile : les photos demandent la permission caméra/galerie (textes ajoutés dans `app.json`) → **nouveau build** de l'application nécessaire (plugin `expo-image-picker` reconfiguré).
5. Variable facultative `KYC_ENFORCEMENT=off` : suspend le blocage et les rappels (recette, déploiement progressif). Par défaut, actif.

## Nouvelles routes (préfixe `/api`)
`GET /kyc/me` · `POST /kyc/documents` · `GET /kyc/documents/:id/(front|back)` ·
`GET /kyc/admin/stats` · `GET /kyc/admin/queue` · `GET /kyc/admin/users/:userId` ·
`POST /kyc/admin/documents/:id/approve` · `POST /kyc/admin/documents/:id/reject` · `POST /kyc/admin/users/:userId/remind`

Sécurité des pièces : lecture réservée au propriétaire, à l'administrateur de sa société et au super administrateur (404 sinon) ; réponses `no-store`,
`nosniff` et CSP bac à sable ; formats vérifiés sur les octets réels (JPEG, PNG, WebP, PDF), 8 Ko à 6 Mo par fichier, 12 envois par client et par 24 h ;
décisions atomiques (deux administrateurs ne traitent jamais la même pièce deux fois) ; tout est dans le journal d'audit
(`KYC_SUBMIT`, `KYC_APPROVE`, `KYC_REJECT`).

## Points d'attention (à connaître avant la mise en ligne)
- **Les clients wallet existants au niveau 0 sont bloqués pour envoyer tant qu'ils n'ont pas été vérifiés** et commencent à recevoir des rappels le lendemain.
  Pour une montée en charge douce : `KYC_ENFORCEMENT=off`, communiquer, puis réactiver.
- Les photos sont stockées **dans la base** (colonnes binaires). Correct pour démarrer ; à terme, un stockage objet chiffré (S3 ou équivalent) sera préférable.
- La pièce d'identité du **client de passage** n'est pas photographiée : l'agent en recopie les références (le serveur les contrôle et les compare aux fiches existantes).
- Les consultations de pièces par un administrateur ne sont pas encore journalisées (seules les décisions le sont).
- Le rappel « votre pièce expire dans 30 jours » n'existe pas encore : le client est prévenu le jour de l'expiration.
- L'ancien écran agent du mobile (`app/agent/send-cash.tsx`) n'envoie pas les nouveaux champs. Il est inaccessible (les agents n'ont plus le droit de se connecter au mobile) ; le vrai parcours est la page web **Envoi cash**, mise à jour.
- Les 6 points de mise en production restent à votre charge, comme convenu.

## Vérifications faites
- Backend : `tsc` propre ; **64 suites, 678 tests verts** (dont plus de 80 nouveaux : règles KYC, service, rappels / expiration, notifications, garde, fiches de passage, plafonds au comptoir, atomicité des envois).
- Portail web : `tsc` propre et `vite build` réussi. Application mobile et `packages/shared` : `tsc` propre.
- Non testé : la migration sur une vraie base, l'envoi réel d'e-mails/push, l'appareil photo sur téléphone.

## Fichiers
Backend : `src/kyc/*` (nouveau module), `prisma/schema.prisma` + migration, `transactions/*`, `transfer-limits/*`, `scheduled-transfers/*`, `main.ts`, `app.module.ts`, `.env.example`.
Partagé : `packages/shared/src/kyc.ts`, `api.ts`, `index.ts`, `agentDesk.ts`.
Web : `pages/kyc/*`, `styles/kyc.css`, `lib/kycRules.ts`, `lib/counterSenderRules.ts`, `lib/useKycPending.ts`, `pages/desk/SendCashPage.tsx`, `pages/wallet-clients/*`, `AppShell`, `navigation`, `modules`.
Mobile : `services/kyc.ts`, `utils/kycGate.ts`, `hooks/useKycStatus.ts`, `components/wallet/KycStatusCard.tsx`, `profile/kyc.tsx`, `profile/kyc-submit.tsx`, `profile/index.tsx`, `profile/limits.tsx`, `send.tsx`, `wallet-transfer.tsx`, `ClientDashboard.tsx`, `app.json`.
