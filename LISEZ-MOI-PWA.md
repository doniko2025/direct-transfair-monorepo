# PWA web-admin — ouverture plein écran (sans barre du lien)

## Cause
Le portail d'une société remplaçait le lien du manifeste en JavaScript après le chargement, et la page ne proposait pas d'icône 192 px.
Chrome n'a alors pas fabriqué une vraie application : il a créé un simple raccourci, qui s'ouvre avec le titre et le lien du site.

## Correction
- `index.html` : le manifeste (`/api/manifest` à la racine, fichier statique sous un chemin) est fixé au build par `vite.config.ts` — plus de remplacement dans `branding.ts`.
- Manifeste : `display: standalone` seul (plus de repli `minimal-ui`), icônes 192 + 512 + maskable (`public/brand/icon-192.png`, `icon-512-maskable.png`), taille réelle déclarée pour un logo PNG importé, `/api/manifest` renvoie toujours un manifeste valide.
- `sw.js` : vrai gestionnaire de navigation + page « Pas de connexion ». `vercel.json` : `sw.js` jamais mis en cache.
- Menu du compte : sur téléphone, sans proposition automatique, rappel « Installer l'application » (et non « Ajouter à l'écran d'accueil »).

## À faire après déploiement
1. Supprimer l'ancienne icône de l'écran d'accueil (elle garde son ancien mode).
2. Ouvrir le portail dans Chrome → menu ⋮ → **Installer l'application**.
3. Test : DevTools → Application → Manifest (« Installability » sans erreur) ou Lighthouse « PWA ».
