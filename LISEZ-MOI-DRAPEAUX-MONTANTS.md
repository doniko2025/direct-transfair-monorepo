# Drapeau du pays à côté de la devise — champs de montant

## Fichiers (chemins identiques au dépôt)
- `apps/direct-transfair-mobile/components/ui/CurrencyFlag.tsx` (NOUVEAU : `CurrencyFlag`, `flagForCurrency`, `CurrencyTag`)
- `apps/direct-transfair-mobile/components/ui/Field.tsx` (v2.4 : `AmountInput` affiche le drapeau)
- `apps/direct-transfair-mobile/components/home/HomeParts.tsx` (le drapeau est déplacé dans le nouveau fichier et ré-exporté : aucun import existant ne casse)
- `apps/direct-transfair-mobile/app/wallet-transfer.tsx` (drapeau + devise sur « Vous envoyez » et sur le montant reçu)

## Écrans concernés
- Via `AmountInput` (un seul changement) : Recharge, Recharge carte (topup), Factures (payer + planifier), Paiement par QR (confirmation), Marchand (encaisser, virements), Demande d'argent.
- Déjà avec drapeau (inchangés) : Accueil/Envoyer de l'argent, page d'accueil, Envoyer, Convertisseur de taux.
- Non modifiés : plafonds par caissier (marchand › équipe), qui sont des champs texte avec la devise dans le libellé.

Les drapeaux suivent la devise (EUR → 🇫🇷, GNF → 🇬🇳, XOF → 🇸🇳…). Couleurs : thème de la société, rien en dur.
`tsc --noEmit` : 0 erreur ; rendu web vérifié.
