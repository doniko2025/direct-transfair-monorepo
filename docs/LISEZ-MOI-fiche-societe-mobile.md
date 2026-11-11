# Portail web — fiches sur mobile (société, agence, utilisateur, client)
Extraire à la racine du monorepo, puis relancer / reconstruire le web-admin (`apps/web-admin`).

- `src/styles/company-mobile.css` (nouveau, importé dans `index.css`) — uniquement sous 640 px :
  - en-têtes de cartes : icône | titre | bouton « Modifier / Émettre un contrat » sur une ligne, description dessous sur toute la largeur (plus de texte écrasé mot par mot) ;
  - Équipe / Contrats : avatar | nom + rôle sur la 1re ligne, e-mail dessous, plus aucun « … » ; « Administrateur de société » passe sur 2 lignes ;
  - Portefeuilles : une ligne par devise (devise + « Par défaut » à gauche, montant à droite) ;
  - listes clé/valeur : libellé et valeur sur la même ligne ; champs « Non renseigné » masqués et cités sur UNE ligne en bas.
- `src/pages/companies/EditableSection.tsx` — marque les champs vides et ajoute la ligne « Non renseigné : … » (visible seulement sur mobile).
Grand écran : aucun changement.
