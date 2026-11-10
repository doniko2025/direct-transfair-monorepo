# Page de connexion « mer » (inspirée d'Occaz)

Fichiers complets, chemins relatifs à la racine du dépôt. Aucune nouvelle dépendance (react-native-svg et expo-linear-gradient sont déjà installés). Rien n'a été commité.

* `apps/direct-transfair-mobile/components/auth/SeaBackdrop.tsx` (NOUVEAU) : eau claire et transparente (dégradé bleu très doux, rayons de lumière, bulles), 10 petits poissons **bleus et verts uniquement**, peu contrastés avec l'eau, sable pâle et algues en bas. Les poissons et bulles flottent doucement (animation native) ; « Réduire les animations » du système = fond fixe.
* `components/auth/AuthShell.tsx` : nouvelle prop `sea` (désactivée par défaut → les autres écrans d'authentification sont inchangés). Emblème de la marque dans une bulle, puis une carte blanche centrée **plus étroite (≈ 76 % de la largeur, 286 à 360 px)** qui contient tout : pastille d'état du serveur, marque, titre, formulaire, séparateur, « Pas encore de compte ? Créer un compte » et Assistance · Conditions · Confidentialité. Ordinateur (web ≥ 900 px) inchangé.
* `components/auth/PhoneField.tsx` et `PinInput.tsx` : prop optionnelle `dense` (champ et cases du code plus bas, textes réduits). Sans elle : rendu identique à avant.
* `app/(auth)/login-v2.tsx` : l'écran principal passe `sea` et `dense` ; textes d'inscription et liens légaux légèrement réduits. Aucune logique de connexion modifiée.

Vérifié : `tsc --noEmit` du mobile sans erreur. Les autres écrans (code reçu, inscription, mot de passe oublié…) gardent l'ancien cadre ; la variante `sea` peut y être ajoutée en une ligne si vous le souhaitez.
