# Langues — Lot 7 : paiement par QR, notifications, taux, parrainage, assistance (FR / EN / PT)

## Ce qui est traduit
- **Payer par QR** : caméra (`pay/scan`), confirmation avec saisie du montant (`pay/confirm`), demande reçue (`pay/request`), liste des demandes (`pay/requests`), **vérification de reçu** (`pay/verify`, résultat « authentique / non reconnu »).
- **Scanner un QR de personne** (`scan`), **Mon QR code** (`(tabs)/qr`, message de partage inclus), **Parrainage** (`referral`, message d'invitation WhatsApp/SMS/e-mail inclus).
- **Notifications** (`(tabs)/notifications`) : « il y a x min », sélection/suppression, pluriels, dates localisées.
- **Taux du jour** (`(tabs)/rates`) : noms de devises, convertisseur, formats de nombres selon la langue.
- **Assistance & cookies** (`(auth)/assistance`) : FAQ complète (11 questions), contact, cookies.
- **Messages système** : biométrie (invite Face ID/Touch ID), compte réservé au portail web, repli « erreur réseau » (`AuthProvider`, `api`, `v2-auth`).
- **Capitales** affichées dans `Corridor` (EN/PT).

## Points d'attention
- Les textes de **titre/message des notifications** viennent du serveur (déjà traduits au lot 4) ; ici seul l'écran est traduit.
- Dans le parrainage, le « bonus » défini par la société reste tel que saisi dans la configuration du tenant (non traduit).
- **Hors périmètre volontairement** : écran de retrait agent (`(tabs)/withdraw`), modale de recharge d'agence, écrans admin, 3 composants inutilisés (`TransactionItem`, `CommissionFilter`, `FloatingSendButton`).
- **CGU et politique de confidentialité** (`terms`, `privacy-policy`) : reportées au lot 8 — texte juridique, une relecture par un juriste est recommandée pour EN/PT.
- Aucune modification backend.

## Fichiers (16 + notice) — à appliquer après le lot 6 (merchant.ts est cumulatif)
`i18n/messages/merchant.ts`, `app/pay/{verify,scan,confirm,request,requests}.tsx`, `app/scan.tsx`, `app/referral.tsx`, `app/(tabs)/{qr,notifications,rates}.tsx`, `app/(auth)/assistance.tsx`, `providers/AuthProvider.tsx`, `services/{api,v2-auth}.ts`, `components/ui/Corridor.tsx`.

## Vérifications
- `npx tsc --noEmit -p .` (mobile) : 0 erreur.
- Catalogue : 1899 clés, aucun doublon, mêmes `{variables}` et pluriels en FR/EN/PT.
- Tests backend i18n/reçus : 36 / 36.

## Installation
Décompressez à la racine du monorepo (chemins relatifs).

## Lot suivant (8)
CGU et politique de confidentialité, puis passage final (clés orphelines, test de bout en bout du sélecteur de langue).
