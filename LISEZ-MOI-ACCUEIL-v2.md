# Accueil client — libellés retirés, carte « Renvoyer » refaite, compte client par défaut

## Fichiers (chemins identiques au dépôt — à remplacer ; ce zip inclut aussi app/index.tsx v6.9 déjà livré)
- apps/direct-transfair-mobile/app/index.tsx (v6.9, 3 étapes stables)
- apps/direct-transfair-mobile/components/home/ExpressSendCard.tsx (v1.2)
- apps/direct-transfair-mobile/components/home/RepeatSendChip.tsx (v2.0)
- apps/direct-transfair-mobile/hooks/useAccountSpace.ts (v1.1)
- apps/direct-transfair-mobile/services/accountSpaceStore.ts (NOUVEAU)
- apps/direct-transfair-mobile/providers/AuthProvider.tsx (v7.6)
- apps/direct-transfair-mobile/i18n/messages/home.ts
- apps/direct-transfair-mobile/i18n/messages/assist.ts

## Changements
1. « Calculé au taux du jour » → « 0 » grisé ; « frais affichés avant confirmation » retiré (la ligne du taux = « 1 EUR = 10 500 GNF »).
2. Carte « Renvoyer » : pleine couleur société, initiale du destinataire, bouton rond animé, reflet, ressort à l'appui (animations coupées si « réduire les animations »).
3. Compte CLIENT par défaut à chaque connexion (mot de passe, SMS, biométrie, inscription). Rouvrir l'app sans déconnexion garde le compte en cours.

## Vérifications
- tsc --noEmit sur apps/direct-transfair-mobile : 0 erreur. Non testé sur appareil réel.
