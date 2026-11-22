# Accueil v6.6 — sans défilement + déconnexion → page d'accueil

## Fichiers (chemins identiques au dépôt — à remplacer)
- `apps/direct-transfair-mobile/app/index.tsx`
- `apps/direct-transfair-mobile/i18n/messages/home.ts`
- `apps/direct-transfair-mobile/providers/AuthProvider.tsx` (v7.5)
- `apps/direct-transfair-mobile/app/(tabs)/profile/index.tsx` (v8.3)
- `apps/direct-transfair-mobile/app/(tabs)/profile/account.tsx` (v6.1)
- `apps/direct-transfair-mobile/app/(tabs)/profile/delete-account.tsx` (commentaire seulement)
(ce zip remplace les précédents « accueil » : n'appliquez que celui-ci)

## 1. Page d'accueil sans défilement
- Carte du simulateur plus compacte (marges, lignes de 48, montants 28).
- La page mesure la hauteur réelle de l'écran : si le contenu dépasse, le bandeau « 3 étapes » disparaît d'abord, puis les tailles se resserrent (3 niveaux).
- Le défilement n'est actif que clavier ouvert (pour garder le champ visible).
- Ombre de la carte plus marquée, y compris sur Android (élévation + liseré teinté couleur société).

## 2. Déconnexion → page d'accueil (client ET marchand)
- Cause : « Profil » et « Mon compte » forçaient `router.replace("/(auth)/login")` après `logout()`. Ces lignes sont supprimées.
- `logout()` (AuthProvider) vide la pile de navigation puis va sur `/` : valable pour la déconnexion volontaire, l'inactivité, la session expirée, la suppression de compte et « autre compte ».
- Le garde de navigation renvoie déjà vers `/` tout visiteur non connecté.

## Vérifications
- `tsc --noEmit` : 0 erreur. Rendu web testé (392×872, 390×780, 360×640, 375×667) avec taux et frais simulés : aucun débordement.
- Non testé ici : appareil réel, couleurs réelles de la société.
