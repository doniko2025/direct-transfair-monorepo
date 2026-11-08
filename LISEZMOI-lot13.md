# Lot 13 — Fonctions marchand (6 points)

1. Remboursement d'un paiement par le marchand (intégral, 30 jours, code secret ; la commission reste acquise à la plateforme).
2. QR de caisse permanent (le client saisit le montant) + affiche PDF / impression + renouvellement avec code secret.
3. Logo du commerce (écran de paiement du client, reçus, affiche du QR).
4. Reçu PDF, clôture de journée (code secret, une fois par jour et par devise), exports PDF et CSV.
5. Caissiers par commerce (droits : rembourser, plafond par paiement) + espace « Caisse » pour le caissier.
6. Alertes : solde bas, retrait refusé (déjà existant), échecs de paiement répétés.

## À faire côté serveur
1. Copier les fichiers (les chemins respectent le monorepo).
2. `npx prisma generate` puis `npx prisma migrate deploy` — migration idempotente `20261114090000_merchant_extras`.
   Testez-la d'abord sur une COPIE de la base.
3. Redéployer le backend.

## Application mobile
Aucune dépendance nouvelle (expo-print, expo-sharing, react-native-qrcode-svg et expo-image-picker sont déjà installés). Nouveau build / mise à jour OTA.

## Nouveaux écrans
`/merchant/qr`, `/merchant/closing`, `/merchant/staff`, `/cashier` — menus : Profil › Mon commerce (compte marchand) et Profil › Caisse (compte client caissier).
