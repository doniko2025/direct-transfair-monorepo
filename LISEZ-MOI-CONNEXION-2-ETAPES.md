# Connexion mobile en 2 étapes (logo en haut) — notice

Aucun commit / push fait. Copier les fichiers du zip à la racine du dépôt (mêmes chemins), puis relancer l'app.
**Aucun build natif ni migration** : changement 100 % interface (reload / redéploiement web suffisent).

## Ce qui change
**Étape 1 — numéro** : logo de la société en haut, titre « Se connecter », carte blanche avec le numéro + bouton « Continuer »,
puis « OU CONTINUEZ AVEC » : *Email et mot de passe*, *Code reçu par email* ; « Créer un compte » et liens légaux en bas.

**Étape 2 — code secret** : même logo, rappel du numéro avec « Modifier », 6 cases du code (clavier ouvert automatiquement),
« Code oublié ? », « Connexion » + empreinte (si activée), lien « Se connecter autrement ».

- Barre de progression (2 traits) sous l'en-tête.
- Numéro mémorisé sur l'appareil → l'écran s'ouvre directement sur l'étape 2 (« Modifier » pour changer de numéro).
- Flèche retour et bouton retour Android : étape 2 → étape 1 (le numéro reste saisi).
- « Continuer » ne contacte PAS le serveur : on ne révèle pas si un numéro a un compte. Le serveur répond à la connexion (6e chiffre).
- Connexion automatique au 6e chiffre, empreinte, portails société, vérification de contact : inchangés.
- Clavier ouvert : le logo se réduit et le sous-titre disparaît, le bouton « Connexion » reste visible.
- Contenu réparti sur toute la hauteur : plus de grand vide sous les boutons (testé en 390 × 844).
- « Email et mot de passe » reste une seule étape (carte email + mot de passe), avec « Téléphone et code secret » en alternative.
- Les écrans « Connexion par code » (email) reprennent le même cadre (logo + carte).
- Pastille « Le serveur démarre… » : désormais centrée SOUS l'en-tête (avant, elle poussait le bouton d'aide hors de l'écran).
- Couleurs 100 % dynamiques (couleur principale / accent choisies par l'admin de la société), thème clair et sombre suivis.
- Textes FR / EN / PT (nouvelles clés `login.welcome`, `login.continue`, `login.orContinueWith`, `login.pin.subtitle`, `login.edit`,
  `login.otherWay`, `login.step`, `login.opt.*`).

## Fichiers (chemins depuis la racine du dépôt)
- apps/direct-transfair-mobile/app/(auth)/login-v2.tsx            (écran de connexion v6.0)
- apps/direct-transfair-mobile/components/auth/SimpleAuthShell.tsx (cadre v2.0 : logo, progression, répartition)
- apps/direct-transfair-mobile/components/auth/AuthCards.tsx       (NOUVEAU : carte, lignes d'options, rappel du numéro)
- apps/direct-transfair-mobile/components/auth/PhoneField.tsx      (v2.2 : champ qui débordait de la carte sur le web)
- apps/direct-transfair-mobile/components/flow/Reveal.tsx          (v1.1 : glissement horizontal optionnel)
- apps/direct-transfair-mobile/i18n/messages/auth.ts               (nouveaux textes)

## Vérifications faites
- `tsc --noEmit` : 0 erreur. Export web OK.
- Rendu réel en 390 × 844 (étape 1, étape 2 avec numéro mémorisé, email + mot de passe, connexion par code) et parcours
  numéro → Continuer → Modifier → retour : sans erreur.
- NON testé ici : le clavier numérique natif (Android / iOS) et l'empreinte — à vérifier sur ton téléphone.

## À savoir
- `SimpleAuthShell` n'était utilisé que par login-v2 (vérifié) : aucun autre écran touché.
- Pas encore repris : l'écran « Code oublié » (forgot-password) garde son ancien cadre — à aligner dans un prochain lot si tu veux.
