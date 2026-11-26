# Utilisateurs : comptes client / marchand séparés (un compte qui a les deux apparaît dans les deux)

## Constat
- Les comptes marchands étaient bien renvoyés par l'API, mais mélangés aux clients : tous affichés « Client wallet », aucun onglet « Marchands »,
  et l'onglet « Clients » comptait les marchands comme des clients.
- Le serveur ne disait pas si un compte était client, marchand ou les deux.

## Fichiers (chemins identiques au dépôt — à remplacer)
- apps/backend/src/users/users.service.ts (GET /users renvoie hasClientAccount, hasMerchantAccount, merchant)
- packages/shared/src/users.ts (type UserSummary : 3 champs optionnels ajoutés)
- apps/web-admin/src/lib/userRules.ts (hasClientAccount, hasMerchantAccount, profileLabels)
- apps/web-admin/src/pages/users/UsersPage.tsx (onglet « Marchands », pastilles « Client wallet » + « Marchand », recherche par nom du commerce)
- apps/web-admin/src/pages/wallet-clients/WalletClientsPage.tsx (n'affiche que les comptes qui ont un compte client ; pastille « Aussi marchand »)
- apps/web-admin/src/pages/dashboard/AdminDashboard.tsx (compteur de clients cohérent)

## Règle
- Marchand = une fiche commerce existe. Client = un portefeuille personnel actif (ou tout compte USER sans fiche commerce).
- Compte avec les deux : dans « Clients » ET « Marchands » (une seule fois dans « Tous »).
- Déployer backend + web ensemble ; un web ancien avec un backend neuf (ou l'inverse) retombe sur l'ancien comportement sans erreur.

## Vérifications
- web-admin : tsc --noEmit sans erreur. Backend : syntaxe valide ; compilation complète non faite ici (client Prisma non générable hors ligne).
