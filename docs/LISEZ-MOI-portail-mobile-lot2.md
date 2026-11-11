# Portail web — mobile : rien de tronqué, plus de défilement latéral
Extraire à la racine du monorepo, puis reconstruire / redéployer `apps/web-admin`.

Nouveau `apps/web-admin/src/styles/mobile-fit.css` (importé dans `index.css`), actif UNIQUEMENT sous 640 px :
- ~30 textes qui finissaient par « … » passent à la ligne : cartes sociétés, utilisateurs, agences et agents, clients wallet, marchands, contrats, domaines, transactions, notifications (aperçu limité à 3 lignes), support, tableau de bord, groupes de réglages, montants de trésorerie ;
- carte société : statut et domaine sur la même ligne ;
- réglages : les 4 onglets tiennent sur une ligne (plus de défilement latéral) ;
- tableau de bord : statistiques en grille 2 colonnes (plus de bande qui défile).
Reste volontairement sur une ligne : barre du haut, menu, boutons, pastilles, heures.
Grand écran : aucun changement. À ajouter en plus du lot « fiche société mobile » (company-mobile.css).
