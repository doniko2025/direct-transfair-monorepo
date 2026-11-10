# Langues — Lot 6 : espace marchand (FR / EN / PT)

## Ce qui est traduit
- **Accueil marchand** (`merchant/index`), **activation** (`activate`), **encaissement** (`collect`), **liste** (`payments`) et **détail** d'un encaissement (`payment`, remboursement inclus).
- **Paiement côté client** (`PayCheckout` : à payer, payé, refusé, expiré, annulé).
- **QR de caisse** (`qr`), **retraits** (`payouts`), **réglages du commerce** (`settings` : fiche, RCCM, logo, alertes, destination des retraits, outils), **équipe de caisse** (`staff`), **clôture & exports** (`closing`).
- Composants : `BusinessInfoFields` (pays localisés), `ShopLogoSheet`, `ReceiptQr`.
- **PDF générés sur l'appareil** (`services/merchantDocs.ts`) : reçu marchand/client, relevé de journée, rapport de période, affiche du QR de caisse. Ils suivent la langue active au moment de la génération (attribut `lang` du HTML, dates localisées).

## Points d'attention
- Les valeurs envoyées au serveur restent **en français** (catégories, noms de pays) ; seul l'affichage est traduit (`categoryLabel`, `localizeCountry`).
- Les étiquettes du **fichier CSV** viennent du serveur : elles restent en français (voir lot suivant si vous voulez les traduire côté backend).
- Aucune modification backend dans ce lot.

## Fichiers (17)
`i18n/messages/merchant.ts` (nouveau), `i18n/catalog.ts`, `services/merchantDocs.ts`, `components/merchant/{BusinessInfoFields,PayCheckout,ReceiptQr,ShopLogoSheet}.tsx`, `app/merchant/{activate,closing,collect,index,payment,payments,payouts,qr,settings,staff}.tsx`.

## Vérifications
- `npx tsc --noEmit -p .` (mobile) : 0 erreur.
- Catalogue : 1685 clés, aucun doublon, mêmes `{variables}` et mêmes pluriels en FR/EN/PT.
- Tests backend i18n/reçus : 36 / 36.
- Scanner : seuls restent des noms propres/valeurs serveur (« Guinée », « Orange Money », catégories) et du balisage HTML.

## Installation
Décompressez à la racine du monorepo (les chemins sont relatifs à la racine).

## Lot suivant (7)
Scan/paiement (`scan/pay/*`), caisse (`cashier`), notifications, taux, assistance, parrainage, CGU / confidentialité.
