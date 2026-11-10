# Langues FR / EN / PT — Lot 2 : inscription, accès, onglets, accueil

À appliquer par-dessus le lot 1 (mêmes dossiers, aucun conflit). Aucune migration, aucune nouvelle dépendance, backend inchangé.

## Traduits dans ce lot
- **Avant la connexion** : écran d'accueil de l'app, choix du type de compte (client / marchand), inscription complète (5 étapes, dont « Votre commerce » avec RCCM, adresse, Orange Money), vérification de l'email, mot de passe oublié, code secret obligatoire, connexion par téléphone, page introuvable, lien société. La pastille de langue (drapeau) est affichée en haut à droite de ces écrans.
- **Barre d'onglets**, **accueil client** et **accueil marchand** (solde, boutons, activité récente, alertes d'identité), bascule Compte client / Compte marchand.
- **Composants partagés** : états vides / erreurs / « le serveur démarre », champs (téléphone, montant, code), sélecteur de pays, photo du RCCM, statuts d'opération (Payé, Reçu, Remboursé…), titres d'opération, dates relatives (Aujourd'hui / Hier), montants et dates au format de la langue choisie.
- Messages d'erreur d'inscription : l'app repère le sujet de l'erreur serveur (RCCM, adresse, code postal, téléphone…) aussi en anglais et en portugais. Sinon l'erreur serait affichée en bas au lieu du champ concerné.

## Nouveautés techniques
- `i18n/messages/account.ts` et `home.ts` (ajoutés dans `i18n/catalog.ts`).
- `i18n/runtime.ts` : `fmtTime`, et `lazyLabels` pour les tables de libellés (ex. `PAYMENT_STATUS_LABEL`) qui changent de langue sans modifier les écrans qui les lisent.
- `scripts/i18n-scan.js` (mobile) : `node scripts/i18n-scan.js --count` donne le nombre de textes français encore « en dur » par fichier ; sans option, la liste détaillée ; on peut cibler des fichiers.

## Limites connues
- Les noms de pays et de villes restent en français (la valeur envoyée au serveur est le nom français).
- Envoi d'argent, retrait, recharge, transactions, bénéficiaires, profil / KYC, marchand (caisse, retraits, réglages), reçus, CGU et politique de confidentialité : encore en français, lots suivants.
- La catégorie du commerce est affichée dans la langue choisie, mais le serveur la garde en français.

## Vérifications
`npx tsc --noEmit -p .` (mobile) : OK.
