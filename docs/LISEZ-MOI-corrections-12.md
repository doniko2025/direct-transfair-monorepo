# Lot 12 — Refonte du portefeuille (client et marchand)

Application mobile uniquement (`apps/direct-transfair-mobile`). Aucun changement backend, web-admin ni shared.

## Ce qui change pour l'utilisateur

### Accueil client et accueil marchand : simples et sans encombrement
- Fond **blanc pur `#FFFFFF`**, codé en dur (il ne dépend plus d'aucun réglage).
- Barre du haut : salutation + nom, **icône scan QR** (ronde) et **cloche** de notifications.
- **Solde en grand format**, avec le **drapeau rond de la devise** (🇫🇷 EUR, 🇬🇳 GNF…) à côté du code.
- Lien **« Masquer le solde » / « Afficher le solde »** ; le choix est mémorisé sur l'appareil.
- Client : deux boutons seulement — **« Envoyer de l'argent »** (orange, en pilule) et **« Recharger »** (contour).
- Marchand : ligne « Aujourd'hui : X · N paiements » et actions d'encaissement (QR / téléphone).
- 3 onglets : **Accueil**, **Activité** (**Paiements** pour un marchand), **Profil**.
- Les entrées retirées de l'accueil sont dans **Profil** : Payer avec un QR code, Demandes à payer, Mon QR code, Mes bénéficiaires, Taux de change ; marchand : Paiements encaissés, Réglages du commerce ; non-marchand : Devenir marchand.

### Police et tailles
- Police **Inter** partout (400 à 800), tailles alignées sur la capture « Envoyer de l'argent » : bouton 18/600 sur 58 px de haut en pilule, corps 16, légendes 14.
- Fichiers ajoutés : `assets/fonts/Inter_*.ttf` + `LICENSE_INTER`. Les anciens fichiers Manrope/Fraunces restent mais ne sont plus chargés.

### Couleurs configurables par l'admin (elles fonctionnent maintenant)
- **Couleur principale** → boutons principaux et marque.
- **Couleur d'accent** → liens, interrupteurs, éléments d'accent.
- Si l'admin n'a pas modifié les verts par défaut de la plateforme (`#059669` / `#10B981`), l'application utilise l'**orange par défaut `#D9650E`**.
- Le texte posé sur un bouton est choisi automatiquement (noir ou blanc) selon le contraste.

### Écrans d'authentification
- Passés en clair (fond blanc, textes gris/noir) ; le lien d'inscription et les mentions légales en bas de la connexion restent visibles.

### Plus aucune croix « × »
- Fermeture d'une fenêtre ou d'un écran : **flèche vers le bas**.
- Effacer une recherche ou une saisie : **cercle avec un trait** (moins).
- Erreur / refus : **point d'exclamation dans un cercle**.
- Annuler une édition ou une sélection : **flèche retour**.
- Mis en place une fois dans `components/ui/iconNodes.ts` (toutes les icônes « close » de l'application suivent), plus des ajustements ciblés sur les champs de recherche et boutons d'édition.

## Fichiers principaux
- Thème : `components/ui/theme.ts`, `fonts.ts`, `Primitives.tsx`, `Icon.tsx` / `iconNodes.ts`
- Accueils : `components/home/HomeParts.tsx`, `components/dashboards/ClientDashboard.tsx`, `MerchantDashboard.tsx`, `app/(tabs)/home.tsx`, `app/merchant/index.tsx`
- Navigation : `app/(tabs)/_layout.tsx`, `app/(tabs)/transactions/index.tsx`, `app/(tabs)/profile/index.tsx`
- Auth : `components/auth/authTheme.ts`, `AuthShell.tsx`, `app/(auth)/login-v2.tsx`
- Portefeuille : `components/wallet/walletTheme.ts`

## Vérifications
- `tsc --noEmit` mobile : aucune erreur.
- Aucun nouveau paquet à installer ; les polices sont des fichiers dans `assets/fonts`.
- Après application du zip : relancer Expo avec cache vidé (`npx expo start -c`) pour que les nouvelles polices soient prises en compte.

## Hors périmètre
- Les 6 points de mise en production restent à ta charge, comme convenu.
- Aucun commit ni push n'a été fait.
