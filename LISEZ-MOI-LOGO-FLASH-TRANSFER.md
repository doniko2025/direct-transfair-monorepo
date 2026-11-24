# Nouveau logo Flash Transfer

**Concept** : un éclair doré (rapidité) encerclé d'une orbite blanche terminée par une flèche (transfert d'argent d'un pays à l'autre), sur un vert profond qui reprend ta marque. L'orbite passe derrière l'éclair en haut et devant en bas : c'est ce qui donne la profondeur. Lisible jusqu'à 29 px.

## Contenu
**`logo/`** (à utiliser partout ailleurs que dans l'app)
- `flash-transfer-icon.svg` + `-1024.png` / `-512.png` : l'emblème arrondi. **C'est celui à téléverser comme logo de la société** dans le web-admin (Paramètres, identité visuelle) : il remplace le logo bleu actuel.
- `flash-transfer-horizontal-fond-clair` / `-fond-sombre` (SVG + PNG) : emblème + nom, pour en-têtes, factures, e-mails, réseaux sociaux.
- `flash-transfer-mark-blanc` / `-vert` (SVG + PNG) : emblème seul, une couleur, sans fond (tampons, filigranes, impression monochrome).
- `apercu.png` : planche de contrôle.
Les textes des SVG sont convertis en tracés (police Inter) : aucun risque de police manquante.

**`apps/direct-transfair-mobile/`** (à copier tel quel dans le projet)
- `assets/images/icon.png` (1024, pleine page, sans transparence : iOS arrondit lui-même)
- `assets/images/adaptive-icon.png` + `adaptive-background.png` (Android : avant-plan dans la zone sûre + fond dégradé)
- `assets/images/monochrome-icon.png` (icône thématique Android 13+)
- `assets/images/splash.png` (écran de démarrage, fond transparent)
- `assets/images/favicon.png`
- `app.json` : fichier complet ; seul changement = `adaptiveIcon` (ajout de `backgroundImage`, `monochromeImage`, `backgroundColor` #0F4430). Le reste est inchangé.

## Mise en place
1. Copie les fichiers dans le projet, puis relance un build natif (`eas build`) : les icônes ne changent pas avec un simple rechargement. Le `splash.png` s'affiche sur le fond `#06120C` défini dans `app.json`.
2. Téléverse `flash-transfer-icon-1024.png` comme logo de société dans le web-admin pour le voir sur l'accueil et dans l'app.

## À savoir
- Le vert du logo est celui de la marque ; l'or de l'éclair est volontairement hors charte UI (couleur d'accentuation du logo uniquement).
- Je n'ai pas pu tester sur un téléphone : vérifie le rendu de l'icône Android (formes rondes, carrées, « gouttes ») après le build.
- Le web-admin garde son propre favicon (`public/favicon.svg`, marque plateforme Direct Transf'air) : non modifié.
