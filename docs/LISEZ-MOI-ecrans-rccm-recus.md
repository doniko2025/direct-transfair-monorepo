# Écrans : devise/drapeau, document RCCM, nouveaux reçus avec QR payable

Fichiers complets, chemins relatifs à la racine du dépôt. Rien n'a été commité.
**Ce lot contient des versions complètes de `schema.prisma`, `transactions.service.ts` et `withdrawals.service.ts` qui incluent aussi les corrections du lot précédent « flux d'argent » : en cas de doute, écrasez avec ce lot.**

## À faire après copie des fichiers

1. Base de données : `cd apps/backend && npx prisma migrate deploy && npx prisma generate`
   (nouvelle migration `20261119090000_merchant_rccm_document` ; la migration `20261118090000_transaction_commission_split` du lot précédent doit aussi être appliquée si ce n'est pas fait).
2. Redémarrer le backend. Aucune nouvelle dépendance npm (mobile : `expo-camera`, `react-native-qrcode-svg`, `expo-print`, `expo-sharing` étaient déjà présents).
3. Variable `RECEIPT_SIGNING_SECRET` (à défaut `JWT_SECRET`) : elle signe les QR des reçus. **La changer invalide tous les QR déjà imprimés** (ils s'afficheront « non reconnu » et ne pourront plus servir à payer). Définissez-la une fois pour toutes en production.
4. Application mobile : nouveau build (nouveaux écrans, deep-link `directtransfair://agent/withdraw?code=…`).

## 1. Capture 1 — pastille devise + drapeau devant les montants (`app/(tabs)/send.tsx`)

* Comme sur l'accueil : le montant s'écrit en premier, le drapeau et le code devise suivent à côté.
* GNF illisible : le code devise était rendu en gris clair/couleur d'accent claire ; il est maintenant en gris foncé `#444444`, 20 px, gras, et la pastille a un libellé d'accessibilité « Devise GNF ».

## 2. Capture 3 — document du RCCM (inscription marchand, activation, réglages)

* En plus du numéro, le marchand joint la **photo du document** (appareil photo ou galerie) : `components/merchant/RccmDocumentPicker.tsx`, utilisé dans `(auth)/register.tsx`, `merchant/activate.tsx` et `merchant/settings.tsx` (section « Pièce justificative », remplacement possible).
* Backend : table `merchant_rccm_documents` (octets en base, empreinte SHA-256, type réel vérifié JPEG/PNG/WebP/PDF, 8 Ko à 6 Mo), `PUT/GET /api/merchants/me/rccm-document` (le marchand), `GET /api/admin/merchants/:userId/rccm-document` (admin de la société du marchand uniquement, super-admin partout). Réponses privées `no-store`. Chaque dépôt est journalisé (empreinte seulement).
* Admin web : fiche marchand → ligne « Document RCCM » avec visionneuse intégrée (zoom, téléchargement) ou pastille « Aucun document joint » ; la liste indique « 📎 document joint » / « document manquant ».
* Limite de corps portée à 9 Mo pour cette seule route (`main.ts`).
* Limite connue : dans l'appli, le document est une **photo** (pas de PDF, car `expo-document-picker` n'est pas installé). Le backend et l'admin web acceptent déjà les PDF.

## 3. Capture 4 — nouveaux reçus (style Sendwave) + QR vérifiable et payable

**Reçu** (`app/receipt/[id].tsx`, `components/receipt/TransferReceiptCard.tsx`, `services/transferReceipt.ts`) :
logo + nom + coordonnées + agrément/capital de la société, type d'opération, montant en grand avec statut (PAYÉ / À RETIRER / ANNULÉ / EXPIRÉ…), référence, dates (émis / payé / à retirer avant), mode de réception, expéditeur et bénéficiaire (téléphone, ville, pays), détail financier (montant, frais, total, taux, montant reçu), agences d'envoi et de paiement + agent payeur, **code de retrait** (visible uniquement par l'expéditeur, tant que l'envoi n'est pas payé), cadres de signature après paiement, QR code, mentions légales. PDF et impression utilisent la même mise en page ; **sans QR, aucun PDF n'est produit**.

Le reçu est construit **par le serveur** (`GET /api/transactions/:id/receipt`) à partir de l'opération enregistrée, avec les mêmes droits de lecture que le détail d'une opération : plus aucun montant ne transite par un paramètre d'écran. Ni commission, ni score de risque, ni solde n'y figurent. Si la société exige le contrôle du téléphone du bénéficiaire, l'agent ne voit pas son numéro sur le reçu.

**QR code** = adresse `…/api/verify/transfer/TF<référence>.<signature>` (signature HMAC du numéro d'opération, de la référence, du montant, de la devise et de la date) :
* Appareil photo de n'importe quel téléphone → page publique « reçu authentique » (statut, société, montant, noms réduits « Moustapha D. », jamais de téléphone) ; un montant retouché ou un QR inventé donne « Reçu non reconnu ». Si l'envoi est encore payable, un bouton ouvre l'application agent.
* Application agent → **Retrait espèces › Scanner le reçu** : le QR est lu, vérifié (signature) et le paiement se fait sans saisir le code. Une **scanette** (qui « tape » le contenu + Entrée dans le champ) fonctionne de la même façon, ainsi que la saisie du code à 9 chiffres comme avant.
* Le serveur re-contrôle la signature à la vérification **et** au paiement. Un reçu truqué est refusé et compte comme essai raté dans la protection anti-devinette de l'agent. Toutes les règles restent identiques au paiement par code : séparation des tâches, pays de paiement, téléphone du bénéficiaire, caisse, commissions, code expiré, un seul paiement.
* Après un paiement, l'agent est conduit au reçu complet (avec son nom et l'agence payeuse).

Fichiers backend : `transactions/transfer-receipt.ts`, `transfer-receipt-seal.ts`, `transfer-check-page.ts`, `transaction-receipts.service.ts`, `transaction-receipts.controller.ts` (+ specs), `transactions.service.ts` (`receiptSourceFor`), `transactions.module.ts`, `withdrawals/withdrawals.service.ts` (`resolveScannedCode`), `withdrawals/dto/agent-code.dto.ts` (longueur max du code portée à 300 pour accepter un QR).

Anciens écrans `client-receipt.tsx` et `agent/receipt.tsx` : conservés tels quels, utilisés seulement si l'identifiant de l'opération manque.

## Vérifications effectuées
Jest : transactions + retraits + marchands = 24 suites / 403 tests verts (dont 9 nouveaux tests de scan/sceau, 17 de reçu). `tsc --noEmit` mobile et web-admin sans erreur. Le backend n'a pas pu être compilé par `tsc` ici (client Prisma non généré) : lancez `npm run build` après `prisma generate`.

## Idées pour la suite
* Rendre le document RCCM **obligatoire** à l'activation, et ajouter dans l'admin un filtre « document manquant ».
* Ajouter `expo-document-picker` pour accepter les PDF dans l'application.
* Ajouter l'envoi du reçu par WhatsApp/SMS au bénéficiaire avec le lien de vérification.
* Journal d'audit « reçu scanné » (date, agent) pour suivre les tentatives de reçus falsifiés.
