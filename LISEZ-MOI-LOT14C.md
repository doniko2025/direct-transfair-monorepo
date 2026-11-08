# Lot 14c — filtres en liste, logo, messages d'erreur

À appliquer APRÈS le lot 14 et le zip « audit-corrections » (mêmes chemins).

1. **Filtres en liste** : nouveau composant `components/ui/OptionPicker.tsx` (champ + feuille basse). Utilisé pour le statut des
   « Paiements encaissés » et pour la catégorie du commerce (réglages et activation) à la place des pastilles sur plusieurs lignes.
2. **Logo — « request entity too large »** : cause = limite de corps de 100 Ko du serveur, jamais relevée pour `PUT /api/merchants/me/logo`
   (`backend/src/main.ts`, limite 3 Mo sur cette seule route). Le service refuse toujours une image > 1 Mo avec un message clair.
   → Redéployer le backend.
3. **« Cannot GET /api/merchants/… »** (clôture, équipe, QR de caisse, logo) : ces écrans appellent des routes du lot 13 que le serveur
   en ligne n'avait pas encore. Elles existent dans le code livré : il suffit de déployer le backend. En attendant (ou avec un serveur
   ancien), l'appli affiche « Fonction pas encore disponible » au lieu du texte brut ; 413 → « Fichier trop lourd ».
