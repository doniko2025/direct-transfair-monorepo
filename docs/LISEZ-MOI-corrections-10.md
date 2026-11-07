# Lot 10 — Code secret à 6 chiffres bien protégé (portefeuille mobile)

Aucun commit ni push n'a été fait : appliquez les fichiers du zip puis commitez vous-même.

## 1. À appliquer
1. Copier les fichiers du zip.
2. `cd apps/backend && npx prisma migrate deploy && npx prisma generate` (migration `20261110090000_wallet_pin_code`).
3. Rien à ajouter dans `.env`.

## 2. Ce qui change pour le client du portefeuille (rôle USER)
- **Inscription** : étape « Votre code secret » — 6 cases masquées + confirmation, au lieu du mot de passe de 10 à 35 caractères.
- **Connexion** : e-mail + code à 6 chiffres (cases masquées, connexion automatique au 6e chiffre). Lien « J'ai encore un mot de passe » pour les comptes qui n'ont pas encore migré.
- **Code oublié** (SMS / e-mail), **Profil › Code secret** et **changement obligatoire** : mêmes cases masquées et mêmes règles.
- **Migration des clients existants** : la migration SQL met `mustChangePassword = true` pour tous les clients USER qui n'ont pas encore de code (`pinSetAt` vide). À leur prochaine connexion avec l'ancien mot de passe, le serveur ferme toute l'API (403 `PASSWORD_CHANGE_REQUIRED`, mécanisme existant) et l'application affiche « Choisissez votre code secret ». Aucun client n'est perdu : ils saisissent l'ancien mot de passe, puis choisissent leur code.
- Les comptes **web** (administrateurs, agents, service client) gardent leur mot de passe libre : rien ne change pour eux.

## 3. Règle de robustesse (`apps/backend/src/common/pin-policy.ts`)
Un code est refusé s'il est :
| Motif | Exemples |
|---|---|
| pas exactement 6 chiffres | `12345`, `12a456` |
| chiffres identiques ou 1–2 chiffres différents seulement | `000000`, `112211` |
| suite complète (aussi en boucle) | `123456`, `654321`, `890123` |
| 4 chiffres qui se suivent | `1234 90`, `90 5678` |
| 4 chiffres identiques à la suite | `555582` |
| motif répété | `121212`, `123123` |
| chiffres doublés / miroir | `112233`, `123321` |
| code courant / pavé numérique | `147258`, `159753`, `696969`… (≈ 70 codes) |
| date plausible (1930 → aujourd'hui) en JJMMAA, MMJJAA, AAMMJJ, MMAAAA, AAAAMM | `120590`, `199005` |
| **la date de naissance du client**, sous toutes ses permutations | `240387` pour le 24/03/1987 |
| un morceau de son numéro de téléphone | 6 chiffres consécutifs du numéro |
Environ **90 %** des 1 000 000 de codes restent permis (un test garantit au moins 70 %), soit plus de 900 000 choix.
- **Le serveur a toujours le dernier mot** : inscription, changement et réinitialisation répondent 400 `PIN_WEAK` avec le motif en français. À la réinitialisation, le contrôle se fait **avant** de consommer le code SMS (un code refusé ne gaspille pas l'OTP).
- **Côté mobile**, la même règle (fichier `components/auth/pinRules.ts`) prévient avant l'envoi et dit pourquoi : « Évitez votre date de naissance », etc. Les deux fichiers sont identiques entre les marqueurs `BEGIN/END PIN POLICY` ; **un test du backend échoue si l'un diverge** — ne modifiez jamais un seul des deux.
- Un nouveau code ne peut pas être identique à l'ancien ; un e-mail « Code secret modifié » est envoyé.
- Après réinitialisation, toutes les sessions ouvertes sont fermées (comportement existant).

## 4. Points de sécurité à connaître
- Six chiffres = 1 million de possibilités. La protection vient surtout du **verrouillage : 5 essais ratés = compte bloqué 30 minutes**, et tant que le compteur n'est pas remis à zéro par une connexion réussie, chaque nouvel échec reverrouille aussitôt (un essai toutes les 30 minutes pour un attaquant). S'y ajoutent l'OTP sur nouvel appareil et la règle ci-dessus.
- Ce même verrouillage peut être déclenché volontairement par un tiers qui connaît l'e-mail d'un client (déni de service sur le compte) : comportement déjà présent avant ce lot.
- Le code est stocké **haché (bcrypt)**, jamais en clair, jamais journalisé.
- Nouveau champ `User.pinSetAt` (date du choix du code).

## 5. Fichiers
Backend : `schema.prisma`, migration, `common/pin-policy.ts` (+ spec), `auth/auth.service.ts` (inscription, changement, réinitialisation), `auth/auth.pin.spec.ts`.
Mobile : `components/auth/pinRules.ts`, `PinInput.tsx`, `PinGuide.tsx`, écrans `register`, `login-v2`, `forgot-password`, `change-password-required`, `profile/security`.

## 6. Vérifications
Backend 785 tests (72 suites), typecheck mobile / web / shared OK.

## 7. Pour le lot 11 (marchand)
Ce même code servira de **code secret de validation** : le client le saisira pour accepter un paiement demandé par un marchand.
