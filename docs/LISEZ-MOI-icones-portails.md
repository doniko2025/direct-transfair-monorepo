# Icône et nom d'installation des portails web (par société)

## Le problème
Quand on installe un portail sur l'écran d'accueil du téléphone, le navigateur lit l'icône et le nom dans un **fichier** (`manifest.webmanifest`) avant que l'application se charge. Ce fichier était le même pour toutes les sociétés : toutes montraient le « t’ » de la plateforme, même si leur logo apparaissait bien dans l'application ouverte.

## Ce qui change
- **Grand Chef (portail plateforme)** : garde son logo « t’ » et le nom « Gestion ».
- **Chaque société** : son logo et son nom (ex. « Flash Transfer »), sur l'écran d'accueil, l'onglet du navigateur (favicon) et l'icône Apple. Sans logo : le « t’ ».
- Fonctionnement : deux petites fonctions serveur (`apps/web-admin/api/manifest.js` et `api/icon.js`) fabriquent le manifeste selon l'adresse visitée (ex. `flash.dkmoney.store`) en demandant la marque à `/api/branding/by-host`. Aucune requête n'est faite vers une adresse de logo choisie par une société (pas de risque de détournement du serveur) : un logo en adresse https est donné tel quel au navigateur, un logo importé est décodé et servi par `/api/icon`.
- Si le serveur est injoignable, l'adresse inconnue ou le visiteur sur le portail plateforme : manifeste de la plateforme (« t’ »), comme avant.
- Fichiers : `api/_branding.js`, `api/manifest.js`, `api/icon.js`, `src/lib/branding.ts`.

## À savoir
- **Déploiement Vercel** : le dossier `apps/web-admin/api/` est déployé comme fonctions. La variable `VITE_API_URL` (déjà utilisée pour le build) est relue par les fonctions ; `VITE_PLATFORM_CODE` aussi si vous l'avez définie.
- **Réinstaller le portail** : une icône déjà installée ne change pas toute seule. Supprimer l'icône puis « Ajouter à l'écran d'accueil » de nouveau (Android/Chrome met parfois quelques heures à mettre à jour).
- **Logo transparent** : sur iPhone, un fond transparent apparaît noir. Idéal : un logo carré à fond plein, au moins 192 × 192 (l'import actuel le réduit à 256 × 256 au plus).
- **Logo SVG importé** : non utilisé comme icône d'installation (l'import le convertit déjà en image).
- **Derrière la console (chemin `/transfert`)** : rien ne change, le fichier statique reste utilisé.
- Non vérifié : le déploiement Vercel et l'installation sur un vrai téléphone. Seules les fonctions ont été testées (jeu d'essais Node : hôtes, logos importés/https/invalides, société inconnue, serveur en panne).

## Application mobile
L'icône du projet (`assets/images/icon.png` et `adaptive-icon.png`) est **déjà le « t’ »** de Direct Transf'air. L'icône verte « ⇄ » vue sur votre téléphone est une **ancienne installation** : désinstallez-la et installez la dernière version. Une icône par société sur mobile nécessite une application publiée par société : reporté, comme convenu.
