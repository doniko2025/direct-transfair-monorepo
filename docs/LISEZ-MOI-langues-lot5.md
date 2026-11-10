# Langues FR / EN / PT — Lot 5 : profil, vérification d'identité, sécurité, assistance

## Ce qui est traduit
- **Profil** (accueil) : identité, bascule client/marchand, menus client et marchand, biométrie, déconnexion, suppression du compte, photo de profil.
- **Vérification d'identité (KYC)** : dossier, envoi d'une pièce / selfie / justificatif, carte d'état, messages de validation, dates d'expiration.
- **Plafonds** (+ demande d'augmentation), **appareils connectés** (sessions, retrait d'un appareil, « il y a 5 min »…), **moyens de paiement** (cartes, Mobile Money),
  **mes informations** (pays / nationalité affichés dans la langue choisie), **code secret**, **préférences de notifications**, **assistance** (liste + conversation),
  **suppression du compte**, **menu du compte**, **agences**.
- Dates, nombres et montants suivent la langue choisie (plus de `fr-FR` en dur dans ces écrans).

## Mécanique
- Nouveau fichier de textes `i18n/messages/profile.ts` (enregistré dans `i18n/catalog.ts`).
- `services/kyc.ts` : les libellés (`KYC_DOC_LABEL`, `KYC_STATUS_LABEL`, `KYC_DOC_STATUS_LABEL`) deviennent « paresseux » : ils se lisent comme avant
  mais rendent la langue courante. `formatDay()` formate la date d'expiration dans la langue choisie.
- `services/sessionLabel.ts` : « Application mobile », « Chrome sur Windows »… traduits.
- Niveaux KYC des plafonds : traduits côté application à partir du niveau (`LEVEL_0…3`), le libellé français du serveur n'est plus affiché.

## À savoir
- Les valeurs enregistrées restent **en français** (pays, nationalité, ville) : seul l'affichage est traduit ; la recherche accepte les deux langues.
- La saisie des dates reste **JJ/MM/AAAA** dans les trois langues (le masque de saisie ne change pas).
- Pas de changement backend dans ce lot (aucun déploiement à faire en plus du lot 4).
- Hors lot : les écrans agent / admin (`personal-info-admin|agent|super-admin`) restent inchangés (hors périmètre).
- Règles du code secret (`pinRules.ts`) : non modifiées, le bloc doit rester identique à celui du backend.

## Fichiers
Mobile : `i18n/messages/profile.ts` (nouveau), `i18n/catalog.ts`, `services/kyc.ts`, `services/sessionLabel.ts`,
`components/wallet/KycStatusCard.tsx`, `components/profile/ProfilePhotoSheet.tsx`, `app/(tabs)/profile/*.tsx`
(index, account, kyc, kyc-submit, limits, devices, payment-methods, personal-info-wallet, security, notifications, support, support-ticket, delete-account, locations).

## Vérifications
`tsc` mobile : 0 erreur · clés du catalogue : variables `{…}` et pluriels identiques dans les 3 langues, aucun doublon · scanner : plus de texte français (hors noms de marques et exemples).

## Prochain lot (6)
Marchand (réglages, encaissement, paiements, retraits, équipe, clôture, QR), puis scan / paiement, onglets notifications / taux / QR, et pages légales.
