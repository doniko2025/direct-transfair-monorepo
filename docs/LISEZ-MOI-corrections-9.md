# Lot 9 — Compte « Service client » (web) avec délégations activables par l'administrateur

Aucun commit ni push n'a été fait : appliquez les fichiers du zip puis commitez vous-même.

## 1. À appliquer
1. Copier les fichiers du zip dans le projet.
2. **Migration** : `cd apps/backend && npx prisma migrate deploy` (migration `20261109090000_support_staff_disputes_refunds`, idempotente), puis `npx prisma generate`.
3. Rien à ajouter dans `.env`.

## 2. Principe
- Nouveau rôle **SUPPORT** (service client), **web uniquement** : il ne peut pas se connecter à l'application mobile.
- Il est créé et piloté par l'**administrateur de la société** : menu **Service client** › « Nouveau compte » (mot de passe provisoire affiché une seule fois, changement obligatoire à la première connexion).
- L'administrateur **active ou coupe chaque délégation avec un interrupteur**. Une délégation coupée = le bouton, le menu et la page **n'existent plus** pour le service client, et le **serveur refuse** l'action (403 `PERMISSION_REQUIRED`) même si quelqu'un appelle l'API à la main.
- **Effet immédiat** : le serveur relit les droits à chaque requête ; l'interface du service client se rafraîchit seule toutes les 30 secondes (et au retour sur l'onglet). Pas besoin de se reconnecter.
- Profils types en un clic : Aucun accès, Lecture seule, Niveau 1, Niveau 2, Responsable. Réglage libre ensuite.

## 3. Catalogue des délégations
| Groupe | Délégation | Ce que le service client voit / peut faire |
|---|---|---|
| Comptes | Consulter les clients | Liste et fiche client |
| Comptes | Suspendre un compte | Bouton « Suspendre » (motif obligatoire, sessions fermées, client prévenu) |
| Comptes | Réactiver un compte | Bouton « Réactiver » |
| Conformité | Valider les pièces d'identité | Menu Vérifications KYC, ouverture des pièces, validation / refus (consultation journalisée) |
| Conformité | Clients de passage | Fiches et photos des pièces des clients de passage |
| Assistance | Répondre aux demandes | Demandes, réponses, notes internes, prise en charge, clôture |
| Assistance | Trancher les litiges | Décision finale (accepté / rejeté / information) d'un litige |
| Argent | Décider des remboursements | Créer et valider des demandes de remboursement |
| Argent | Consulter les opérations | Recherche d'opérations en lecture seule (aucun code de retrait) |

Certaines délégations en impliquent d'autres (ex. suspendre ⇒ consulter les clients) : l'interrupteur induit est alors verrouillé avec l'explication.

## 4. Remboursements : règle des « quatre yeux »
- Un membre du service client **ne valide jamais sa propre demande** : une autre personne (collègue délégué ou administrateur) la valide.
- La décision est prise de façon atomique (pas de double remboursement si deux personnes cliquent en même temps).
- **Limite assumée** : seuls les envois **pas encore payés** (en attente / validé / en cours) sont remboursés automatiquement (le client est recrédité montant + frais). Un envoi déjà payé ou clos ne peut pas être rendu depuis la plateforme : la demande passe en **« À traiter hors plateforme »** et le client est prévenu. Aucun mouvement d'argent n'est inventé.
- Une erreur technique remet la demande « à valider » (rien n'est perdu).

## 5. Litiges et demandes (côté client)
- Un litige = une demande liée à une de **ses propres** opérations. Maximum **5 demandes ouvertes** par client.
- **Mobile** : Profil › **Assistance** (liste, nouvelle demande, fil de discussion, réponse) et, dans le détail d'un envoi, **« Signaler un problème »**.
- Le client est prévenu (notification, push, email) à chaque réponse et décision. Les notes internes ne lui sont jamais transmises.

## 6. Nouvelles routes
- `/support-staff` (administrateur ; catalogue lisible aussi par le service client).
- `/support-desk/overview | clients | transactions | tickets | refunds`, chacune protégée par sa délégation.
- `/support/tickets` (client, rôle USER).
- Le journal d'audit enregistre : création du compte, changements de droits (avant / après), réponses, résolutions, demandes et décisions de remboursement, suspensions, consultations KYC.

## 7. Autres fichiers modifiés
Schéma Prisma, `jwt-auth.guard`, `kyc.service`, `counter-admin.service`, `transactions.service` (`refundOnSupportDecision`), `users.controller`, navigation / routes / garde du portail web, tableau de bord dédié au service client, `packages/shared` (client API `support`), mobile (`services/api.ts`, profil, détail d'opération).

## 8. Vérifications
Backend 764 tests (70 suites) ; typecheck shared, web et mobile ; `vite build` OK.

## 9. À suivre
Lot 10 : code secret à 6 chiffres protégé · Lot 11 : compte marchand · Lot 12 : refonte des wallets (fond blanc pur, couleurs configurables).
