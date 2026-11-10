# Langues FR / EN / PT — application mobile (Lot 1 : socle)

Périmètre : application mobile **client wallet et marchand**. Les écrans agent / caissier agence / admin et le web-admin restent en français, inchangés.

## Ce que contient ce lot
- **Sélecteur de langue** : pastille drapeau en haut à droite de la page de connexion (style Occaz) + rubrique « Langue » dans Profil et dans Réglages marchand.
- **Langue mémorisée** sur le téléphone (AsyncStorage) puis **synchronisée avec le compte** (`User.preferredLanguage`) : on retrouve sa langue sur un autre téléphone. Au premier lancement : langue du téléphone si EN/PT, sinon français.
- **Écrans traduits** : connexion, OTP, code PIN, mot de passe, modales de connexion, messages d'erreur d'authentification, boutons communs, alertes.
- **Serveur** : l'app envoie l'en-tête `x-app-lang` ; les messages d'erreur sont traduits par un filtre global. Les **notifications** (lues et push), **e-mails**, **SMS** sont traduits dans la langue du compte. Sans l'en-tête (web-admin, anciens clients) : français, comme avant.
- Notifications déjà en base : traduites à la lecture, donc elles changent de langue quand l'utilisateur change de langue.

## Déploiement
1. **Backend d'abord** (ou en même temps) : il autorise désormais l'en-tête CORS `x-app-lang`.
2. **Aucune migration** : le champ `preferredLanguage` existe déjà.
3. Mobile : aucune nouvelle dépendance.

## Vérifications faites
- Mobile : `npx tsc --noEmit -p .` OK (une langue manquante dans un message = erreur de compilation).
- Backend : suites i18n 17/17 ; suite complète 93/97 — les 4 échecs (portal-domains, platform-sso, payments.passe3, update-client.dto) existaient avant et sont sans lien.

## Outil de suivi
`node scripts/i18n-scan.js` (dans apps/backend) liste les textes français serveur encore non traduits (`--all`, `--json`, `--strict` pour la CI). Restent surtout des messages admin/agent, hors périmètre.

## Limites connues (lots suivants)
- Les autres écrans mobiles (accueil, envoi, transactions, bénéficiaires, profil/KYC, marchand, reçus) sont encore en français : ils arrivent lot après lot avec les mêmes mécanismes.
- Les montants dans les textes serveur gardent le format français (« 15 000 XOF »).
- Une phrase serveur inconnue reste en français (jamais d'erreur) ; `I18N_LOG_MISSING=1` les journalise.

## Pour ajouter une phrase
- Mobile : `i18n/messages/*.ts` → `clé: { fr, en, pt }`, puis l'utiliser avec `useT()` (composants) ou `tr()` (hors React).
- Serveur : `src/i18n/phrases/*.ts` → `[fr, en, pt]`, `{1}` `{2}` pour les parties variables.
