# Lot 13 — Connexion par téléphone + code à 6 chiffres, et code de test 000000

Aucun commit ni push n'a été fait : appliquez les fichiers du zip puis commitez vous-même.

## 1. À appliquer
1. Copier les fichiers du zip (backend et mobile). Aucune migration Prisma, aucun nouveau paquet.
2. **Pour utiliser le code de test 000000**, ajouter dans l'environnement du serveur (Railway, Render, `.env` local…) :
   ```
   TEST_PIN_ENABLED=true
   ```
   puis redémarrer le backend. Sans cette variable, **000000 est refusé** (comportement normal).
3. Relancer l'application mobile (`npx expo start -c`).

## 2. Écran de connexion mobile (client du portefeuille et marchand)
- **Par défaut : numéro de téléphone + code secret à 6 chiffres.** Indicatif pays (drapeau) + numéro, puis les 6 cases masquées ; la connexion part toute seule au 6e chiffre.
- Le **dernier numéro et le dernier indicatif** utilisés sont mémorisés sur l'appareil (le code, jamais).
- **Options**, en deux boutons sous « Se connecter » :
  - **Email et mot de passe** (bascule ; « Téléphone et code secret » pour revenir). Le champ accepte aussi le code à 6 chiffres.
  - **Empreinte digitale** (Face ID / Touch ID sur iPhone) : visible dès qu'elle est activée sur l'appareil.
- **Proposition automatique** : après une première connexion réussie, l'application propose **une seule fois** d'activer l'empreinte (« Plus tard » / « Activer »). Le réglage reste modifiable dans Profil.
- Conservés à l'identique : « Code par email », « Code oublié ? », portails société, vérification du contact, lien « Créer un compte », mentions légales.

## 3. Backend
- `POST /auth/v2/login-password` accepte maintenant **`phone` OU `email`** (au moins un des deux). Le web-admin continue d'envoyer `email` : rien ne change pour lui. Si les deux sont envoyés, l'email l'emporte.
- Le numéro est normalisé comme partout (`+33 6 12 34 56 78` = `+33612345678`).
- Mêmes protections qu'avant : 5 mauvais codes = compte verrouillé 30 minutes, comptes suspendus/supprimés refusés, comptes web (administrateurs, agents) refusés sur l'application mobile.

## 4. Code de test 000000 — à lire avant de l'activer
- **Désactivé par défaut.** Il s'active uniquement avec `TEST_PIN_ENABLED=true`. Pour le retirer : supprimer la variable et redémarrer.
- Il vaut pour **tous les comptes clients du portefeuille et marchands** (rôle USER), en connexion **et** pour valider un paiement ou un retrait (confirmation du code secret).
- Il **ne fonctionne jamais** pour les administrateurs, administrateurs de société, agents et service client.
- Le vrai code de chaque client continue de fonctionner à côté.
- L'inscription et le changement de code refusent toujours 000000 : il ne peut pas devenir un vrai code.
- Un avertissement est écrit dans les journaux du serveur au démarrage et à **chaque utilisation**.
- ⚠️ Tant que la variable est active, **quiconque connaît le numéro d'un client peut entrer dans son compte avec 000000**. Ne l'activez que sur un serveur de test, sans argent réel, et retirez-la avant la mise en production (ajouter cette ligne à la liste de vos points de mise en production).
- Limites du test : les vérifications par SMS/email restent actives (nouveau compte non vérifié, code reçu) ; un compte qui doit encore choisir son code (ancien mot de passe) est invité à le faire, comme avant.

## 5. Fichiers
Backend : `common/test-pin.ts` (+ spec), `auth/v2-auth.service.ts`, `auth/dto/v2-auth.dto.ts`, `auth/auth.service.ts`, `merchants/pin-verifier.service.ts`, `auth/v2-auth.phone-login.spec.ts`, `.env.example`.
Mobile : `app/(auth)/login-v2.tsx`, `services/v2-auth.ts`, `components/auth/authErrors.ts`.

## 6. Vérifications
Backend : typecheck OK, 882 tests (80 suites) dont les 10 nouveaux. Mobile et web-admin : typecheck sans erreur.
