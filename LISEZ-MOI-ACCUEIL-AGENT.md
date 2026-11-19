# Accueil agent — allègement, menu, barre du haut

- **Accueil** (`AgentDashboard.tsx`) : plus de « Statistiques », plus de bouton Remise (3 grands boutons : Dépôt, Retrait, Envoi cash), plus de bloc Notifications (la cloche du haut reste).
- **Menu agent** : « Remise à l'administrateur » (déjà présente) + nouvelle entrée « Statistiques du jour » → page `/stats` (`pages/desk/StatsPage.tsx`, 4 compteurs en 2×2 sur téléphone).
- **Barre du haut** : vert sauge opaque `#D3E4D6`, filet `#B4CFB9` et légère ombre (variables `--topbar-bg` / `--topbar-line` dans `tokens.css`, appliquées dans `topbar.css` et `shell.css`).
- Ce zip contient aussi le correctif PWA (voir `LISEZ-MOI-PWA.md`) : il remplace le zip précédent.
