# Lot 11 — Compte marchand : encaissement par QR code et par téléphone Orange Money

Aucun commit ni push n'a été fait : appliquez les fichiers du zip puis commitez vous-même.

## 1. À appliquer
1. Copier les fichiers du zip.
2. `cd apps/backend && npx prisma migrate deploy && npx prisma generate` (migration `20261111090000_merchant_accounts`, idempotente).
3. Variables facultatives du `.env` du backend :
   - `ALLOW_SANDBOX_PAYOUTS=true` : autorise le mode « bac à sable » des retraits (payés automatiquement, sans argent réel) **en production**. Sans cette variable, le mode SANDBOX est ignoré en production et les retraits restent manuels.
   - `MERCHANT_EXPIRY_CRON=false` : désactive la tâche (chaque minute) qui expire les demandes de paiement en retard.
4. Application mobile : `expo-camera` et `react-native-qrcode-svg` étaient déjà installés ; aucune dépendance nouvelle.
5. Dans l'administration web (Paramètres › société), la carte **Comptes marchands** doit être vérifiée une fois : les comptes marchands sont activés par défaut avec 1 % de frais.

## 2. Parcours côté application mobile
**Inscription** — écran « Créer votre compte » : deux cartes animées *Je suis client / Je suis marchand*. Le marchand a une étape de plus (« Étape 4 sur 5 : Votre commerce ») : nom, catégorie, adresse facultative, numéro Orange Money de retrait (case « même numéro que mon téléphone » ou autre numéro), puis code secret à 6 chiffres. Un client existant peut devenir marchand depuis *Profil › Devenir marchand* (code secret demandé).

**Encaisser** (Espace marchand › *Encaisser par QR* ou *Par téléphone*) :
- **QR code** : le marchand saisit le montant et appuie sur « Envoyer ». Un QR code à usage unique s'affiche avec un compte à rebours. Le client ouvre *Payer* (accueil) → la caméra s'active → scan → il vérifie commerce et montant → code secret → payé. Le solde du client est débité et celui du marchand crédité en une seule opération.
- **Téléphone Orange Money** : le marchand saisit le numéro du client (celui de son compte) ; la demande arrive dans *Profil › Demandes à payer* et par notification ; le client la valide avec son code secret ou la refuse.
- **Marchand → marchand** : identique (QR ou téléphone). Un marchand peut payer comme n'importe quel client (raccourcis « Payer par QR code » et « Demandes à payer » dans son espace).
- Les deux parties reçoivent une notification (push + liste) et un e-mail : demande reçue, paiement réussi, refusé, expiré, annulé, échec (solde insuffisant). Toucher la notification ouvre l'écran concerné.
- L'écran du marchand se met à jour tout seul (toutes les 2 s) : « En attente » → « Paiement reçu ».

**Retraits** — Espace marchand › *Retirer mes gains* : Orange Money (numéro donné à l'inscription) ou virement bancaire (IBAN enregistré dans les réglages). Code secret obligatoire. Le montant est débité tout de suite ; refusé par l'administrateur = remboursement intégral.
**Changer la destination** — *Réglages du commerce* : nouveau numéro Orange ou IBAN **uniquement avec le code secret** ; ensuite les retraits sont suspendus `payoutCooldownHours` heures (24 par défaut, pas de délai à la création du compte).

## 3. Côté administration web
- *Paramètres société › Comptes marchands* : activation, frais de paiement (%), validité du QR (min), validité d'une demande par téléphone (min), frais de retrait (%), moyens de retrait (Orange Money, virement), mode de retrait (MANUEL / SANDBOX), délai après changement de destination, montants min/max par devise.
- *Marchands* : liste, fiche (ventes, retraits), suspension / réactivation (motif).
- *Retraits marchands* : file des retraits à traiter — **Marquer comme versé** (référence du virement ou du transfert Orange Money) ou **Refuser** (motif, remboursement automatique). L'administrateur voit la vraie destination ; le marchand ne voit qu'une version masquée.

## 4. Règles et sécurité
- Même devise obligatoire entre le client et le marchand (pas de conversion) ; le remboursement d'un paiement marchand se fait hors plateforme.
- Frais : prélevés sur le marchand (net = montant − frais) et crédités au portefeuille de la société ; le client ne paie jamais plus que le montant affiché et ne voit pas les frais du marchand.
- Le QR est à usage unique, expire (5 min par défaut) et n'est accepté que s'il vient de l'application (`directtransfair://merchant-pay/…`) ; tout autre QR est refusé. Une demande déjà payée, annulée ou expirée ne peut plus être réglée (409 / 410).
- Code secret vérifié à chaque paiement et à chaque retrait (5 erreurs = blocage 30 min, compteur commun avec la connexion). Identité (KYC) exigée pour payer et pour retirer.
- Limites anti-abus : 20 demandes en attente par marchand, 10 par client, 5 retraits en attente ; limites de fréquence sur chaque route. Une même demande par téléphone répétée dans les 60 s renvoie la demande existante.
- Le nom du client n'est montré au marchand qu'abrégé (« Mamadou B. »).
- Historique : « Paiement reçu », « Paiement marchand » et « Retrait marchand » apparaissent dans les opérations.

## 5. Vérifications effectuées
Backend `tsc` + `jest` : 78 suites, 872 tests verts (dont paiements concurrents, solde insuffisant, expiration, double paiement, retraits, inscription marchand). Shared `typecheck`, web-admin `tsc` + `vite build`, mobile `tsc` : sans erreur.

## 6. À savoir / limites
- Les retraits sont **manuels** en production : aucun appel à l'API Orange Money n'est fait ; l'administrateur verse l'argent puis le marque comme versé.
- Les catégories de commerce proposées à l'inscription sont fixes (8 catégories) ; elles viennent du serveur une fois le compte créé.
- Le lot 12 (refonte du portefeuille client et marchand, fond blanc, couleurs de l'administrateur) vient ensuite.
