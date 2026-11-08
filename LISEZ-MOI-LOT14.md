# Lot 14 — plafonds/AML marchand, tickets par compte, compteur, QR sur reçu

Copier les fichiers de `apps/` par-dessus ceux du projet (mêmes chemins).

## Contenu
1. **Reçu PDF avec QR de vérification** : le QR ouvre `/api/verify/receipt/<code>` (page publique, données réelles du serveur) ;
   code signé (HMAC) → un PDF modifié ne correspond plus. Nouvel écran « Vérifier un reçu » (profil) : scan ou saisie du code.
2. **Paiements chez un commerçant dans les plafonds KYC** (cumulés avec les envois, remboursés exclus, contrôle sous verrou du portefeuille)
   + **score AML** non bloquant (alerte AmlFlag). La page « Mes plafonds » les inclut automatiquement.
3. **Tickets d'assistance par compte** (client / marchand) : colonne `space`, filtre `GET /support/tickets?space=`,
   quota de 5 demandes par compte, litige sur une opération du commerce rangé côté marchand.
4. **Compteur de notifications non lues** : calculé dans l'appli par compte si le serveur est ancien.

## Déploiement
- Nouvelle migration : `20261115090000_support_ticket_space` → `npx prisma migrate deploy` (tester d'abord sur une copie de la base), puis `npx prisma generate`.
- Variable recommandée dans `.env` : `RECEIPT_SIGNING_SECRET=<longue valeur aléatoire>` (à défaut `JWT_SECRET`).
  ⚠ La changer invalide les QR des reçus déjà imprimés.
- Redéployer le backend, puis reconstruire l'application mobile.
- Hors périmètre (à ta demande) : recharges par simulation.
