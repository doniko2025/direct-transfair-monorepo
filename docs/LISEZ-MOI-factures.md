# Lot 14 — Paiement de factures (électricité, eau, assurance, scolarité, loyer…)

Fonction **fermée par défaut** pour chaque société : rien ne change pour tes clients tant que tu ne l'ouvres pas.
Avis sur les partenariats et liste de ce qu'il faut obtenir de chaque partenaire : **`docs/FACTURES-PARTENARIATS.md`**.

## Ordre d'application

1. Copier le contenu du zip à la racine du dépôt (fichiers complets, ils remplacent les anciens).
2. **Migration** : `20261116010000_bill_payments` (ajoute 2 types d'opération, 4 actions d'audit, 3 tables `billers`, `bill_payments`, `saved_bills`). Appliquer avec `prisma migrate deploy` comme d'habitude — elle est sans risque pour les données existantes (`IF NOT EXISTS` partout).
3. Redéployer le backend et le portail web. Mobile : nouvelle version OTA/EAS (nouveaux écrans + entrée sur l'accueil).
4. Facultatif : `BILLS_SANDBOX_ALLOWED=true` sur une instance de démonstration en production (le mode simulation est sinon bloqué en production ; voir `.env.example`).

## Mise en route côté société (portail web → « Factures »)

1. **Factures — facturiers** → ajouter un facturier (reste invisible tant qu'il est « Brouillon »).
2. Régler le plafond par facture / par jour, puis le passer en **« Ouvert aux clients »**.
3. Activer l'interrupteur **« Paiement de factures »** : l'entrée « Payer mes factures » apparaît sur l'accueil des clients de la société.
4. **Factures à régler** : régler le facturier à la main, puis « Réglée » (numéro de reçu, jeton éventuel) ou « Refuser » (le client est remboursé).

Pour essayer sans argent réel : créer un facturier avec le mode de règlement **« Simulation »** (hors production). Un numéro contenant « FAIL » force un refus, pour voir le remboursement.

## Ce qui est livré

| Partie | Contenu |
|---|---|
| Backend | Module `bills` : catalogue par société, vérification de la facture (titulaire masqué), devis, paiement atomique et **idempotent** (un double appui ne débite pas deux fois), code secret + identité vérifiée, plafonds par facture et par jour, remboursement automatique, reçu avec **code de vérification** signé, factures enregistrées, file de règlement, export CSV, journal d'audit. Architecture à **connecteurs** : « manuel » et « simulation » livrés, un partenaire = un fichier à ajouter. |
| Réglages société | Nouvelle section `bills` (ouverture, frais rendus en cas d'échec, plafonds par devise) dans `/company-settings`. |
| Mobile | Accueil des factures (catégories animées, factures enregistrées, derniers paiements), choix du facturier avec recherche, saisie dynamique (champs demandés par le facturier), vérification, confirmation avec devis et code secret, suivi en direct, jeton à copier, partage du reçu. FR / EN / PT, clair / sombre. Les opérations apparaissent dans l'activité (« Facture payée », « Facture remboursée »). |
| Portail web | Catalogue des facturiers (création, modification, suspension, suppression, suivi du partenariat) et file « Factures à régler » (statistiques, retards, montants à verser par facturier, export). Réservé à l'administrateur de la société ; adapté mobile. |

## Règles à connaître

- **L'argent** : au paiement, le client est débité (facture + frais) et le **portefeuille de la société** est crédité. La société règle ensuite le facturier. Facture refusée → le portefeuille de la société rembourse le client : **il doit être approvisionné** (message clair sinon).
- **Frais** : fixes + pourcentage, payés **en plus** par le client, réglables par facturier. Si la facture est refusée, les frais sont rendus (réglage société).
- **Retard** : une facture non réglée au-delà du délai annoncé au client passe « En retard » (filtre dédié).
- **Confidentialité** : statut du partenariat, coordonnées de règlement et note interne ne sont **jamais** envoyés à l'application des clients ; le nom du titulaire renvoyé par un facturier est masqué (« Mamadou D. »).
- **Comptes séparés** : ces opérations et notifications relèvent du compte **client**, jamais du compte marchand.

## Bogue existant corrigé au passage

`PATCH /company-settings` **ignorait en silence** les sections `merchant` et `refunds` : le DTO ne les déclarait pas et le `ValidationPipe` global (`whitelist: true`) supprime tout champ non déclaré. Les réglages marchand et remboursements enregistrés depuis le portail n'étaient donc jamais pris en compte. `UpdateCompanySettingsDto` déclare maintenant `merchant`, `refunds` et `bills` (+ un test qui l'interdit à l'avenir). **Vérifie dans « Réglages » que tes valeurs marchand/remboursements sont bien celles que tu attends** : si tu avais tenté de les modifier, ce sont les valeurs par défaut qui s'appliquaient.

## Vérifié

- Backend : `tsc --noEmit` = 0 erreur ; **103 suites / 1177 tests passent** (+35 : règles, réglages, paiement, idempotence, remboursement, DTO).
- Mobile : `tsc --noEmit` = 0 erreur. Package `shared` : `tsc` = 0 erreur.
- Portail web : typé dans une copie de travail avec les dépendances installées — aucune erreur dans les fichiers du lot (seule remarque : `process` dans `vite.config.ts`, absent de ma copie faute de `@types/node`, sans rapport avec ce lot).
- **Non testé** : un vrai paiement de bout en bout sur ta base PostgreSQL et sur un téléphone (je n'ai ni l'un ni l'autre ici). Premier essai conseillé : facturier « Simulation » + compte de test.

## Pistes pour la suite (non faites)

Paiements récurrents (loyer, abonnements) et rappels d'échéance · reçu PDF · premier connecteur réel dès qu'un partenaire te donne une API · rapprochement automatique par import du fichier du facturier.
