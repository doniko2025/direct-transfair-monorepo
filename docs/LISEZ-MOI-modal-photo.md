# Modal centré + photo de profil sur l'accueil

Extraire le zip à la racine du monorepo (écrase les fichiers existants).

- `components/ui/Layout.tsx` : `Sheet` (langue, thème, etc.) devient une fenêtre CENTRÉE sur le web (largeur max 480, coins arrondis). Sur téléphone, feuille du bas inchangée.
- `components/auth/CountryPickerSheet.tsx` : même principe pour le choix du pays sur le web.
- `components/home/HomeParts.tsx` : photo de profil (initiales à défaut) en haut à gauche de l'accueil client ET marchand ; toucher la photo ouvre le Profil.
- `i18n/messages/home.ts` : clé `home.myProfile` (FR/EN/PT).
