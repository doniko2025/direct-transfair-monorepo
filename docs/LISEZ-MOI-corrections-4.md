# Lot 4 — SMS de connexion, variables d'environnement, intégration continue

À appliquer après les lots 1, 2 et 3. Aucune migration. Aucun commit ni push.

## 1. SMS de connexion (auth v2) — corrigé
- **Problème** : l'application utilise `/auth/v2/request-otp-phone` et `/auth/v2/send-verification`. Dans cette version,
  l'envoi par SMS n'était qu'une ligne de journal : **aucun SMS ne partait**, et le code était écrit **en clair dans
  les logs du serveur**.
- **Correction** : `V2AuthService` utilise maintenant `SmsService` (Twilio), comme l'ancien service. Sans Twilio
  configuré, le mode « stub » n'envoie rien et n'écrit jamais le texte du SMS en production. Un échec d'envoi
  est consigné sans le code et ne bloque pas la demande.
- **À faire de votre côté** : renseigner `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` et `TWILIO_PHONE_NUMBER`.
  Sans eux, les connexions par téléphone ne marchent toujours pas (aucun SMS).
- **Décision qui vous revient** : l'envoi automatique d'un SMS de vérification à l'inscription / à la connexion
  (`dispatchVerificationOtps`) était commenté « à décommenter pour la prod ». Je l'ai laissé commenté : chaque
  SMS est facturé par Twilio. L'utilisateur peut déclencher la vérification lui-même (`send-verification`).

## 2. `apps/backend/.env.example`
Il n'existait pas : 70 variables étaient lues par le code sans être documentées. Le fichier les liste toutes,
groupées (base, serveur, sécurité, CORS, marque, courriel, SMS, push, contrats, domaines, règles métier, paiements
simulés, seed) avec la valeur par défaut et l'indication obligatoire / recommandé / optionnel.
Variables à regarder en priorité en production : `JWT_SECRET`, `CORS_ORIGINS`, `CORS_ALLOWED_SUFFIXES` (vide),
`AUTH_COOKIE_SAMESITE`, `TWILIO_*`, `MAIL_FALLBACK_*`, `BLOCK_SIMULATED_RECHARGES`, `ALLOW_SELF_FUNDING=false`, `TZ`.
Le fichier est autorisé par le `.gitignore` (`!.env.example`).

## 3. Intégration continue — `.github/workflows/ci.yml`
À chaque push sur `main` et chaque pull request :
1. compilation TypeScript : backend, package partagé, portail web, application mobile ;
2. tests du backend (`test:ci`) ;
3. build du portail web ;
4. dans un second travail : **toutes les migrations sur une base PostgreSQL 16 vide** (`prisma migrate deploy`).
Je l'ai vérifié localement : les 33 migrations s'appliquent sans erreur sur une base vide, et chaque commande du
workflow passe ici. Aucun secret requis.
- Tant que les lots 1 à 3 ne sont pas appliqués, la CI peut être rouge sur votre dépôt (erreurs de types déjà
  présentes que ces lots corrigent).
- La dérive « schema.prisma ↔ migrations » n'est volontairement pas contrôlée : les index uniques partiels de
  `commission_configs` n'existent que dans la migration.
- Le workflow `keep-alive.yml` existant n'est pas modifié.

## Vérifications
`tsc` sans erreur (backend, partagé, web-admin, mobile) · Jest : 54 suites, 533 tests verts.

## Non traité
- Environ 67 requêtes `findMany` sans `take` : y mettre une limite change ce que reçoivent les écrans (listes tronquées
  sans pagination côté application). À faire écran par écran, en commençant par les transactions et les clients.
- Les codes OTP sont stockés en clair en base (`otp_logs.code`, `users.otpCode`) : à hacher dans un lot dédié
  (vérification par comparaison de hachés, durée de vie courte déjà en place).
