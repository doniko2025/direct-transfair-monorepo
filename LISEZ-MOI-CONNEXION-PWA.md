# Connexion : nouveau design + installation sous /transfert

## Installation du compte admin société (dkmoney.store/transfert)
Sous un préfixe, le manifeste écrit pour la racine (« ./ », « /brand/… ») ne convenait pas. `vite.config.ts` génère maintenant `pwa.webmanifest` au build
avec des adresses absolues dans `/transfert/` (start_url, scope, id, icônes 192/512/maskable), nom « Sociétés de transfert » (VITE_CONSOLE_PORTAL_NAME),
et `index.html` pointe dessus. **Il faut redéployer le projet qui sert /transfert** (celui construit avec VITE_BASE_PATH=transfert).
Ensuite : supprimer l'ancienne icône, ouvrir https://dkmoney.store/transfert/login dans Chrome → menu ⋮ → « Installer l'application ».
La page de connexion propose aussi un bouton « Installer l'application » (ou la marche à suivre) avant même de se connecter.
Si l'installation reste impossible : DevTools (chrome://inspect ou ordinateur) → Application → Manifest → « Installability » donne la raison exacte ;
vérifier aussi que la réécriture de la console laisse passer `/transfert/pwa.webmanifest` et `/transfert/sw.js` vers le web-admin.

## Page de connexion v4
Panneau marque à points avec atouts détaillés, carte formulaire plus nette (champs et bouton de 54 px, bouton en dégradé), carte d'installation.
Fichiers : `LoginPage.tsx`, `login.css`.
