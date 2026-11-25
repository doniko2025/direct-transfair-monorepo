# Accueil v6.9 — les « 3 étapes » ne disparaissent plus (fin du grand vide)

## Fichier (chemin identique au dépôt — à remplacer)
- `apps/direct-transfair-mobile/app/index.tsx`

## Cause
L'écran se resserre par niveaux (0 = tout · 1 = tailles resserrées AVEC le bandeau · 2 = bandeau masqué).
Après le passage au niveau 1, le code relisait la hauteur mesurée au niveau 0 (pas encore re-mesurée) : « ça dépasse encore » → niveau 2 → bandeau masqué,
alors que le niveau 1 tenait largement. D'où le logo plus petit ET le grand vide au milieu.

## Correction
- On ne change de niveau qu'après ~150 ms de mesure stable, en relisant la mesure la plus récente.
- L'arrivée des pastilles de frais ne remet plus l'écran au niveau 0 (plus de clignotement grand → petit).
- Le niveau n'est réinitialisé que si la taille de l'écran, le clavier ou la société changent.
- Taux, frais, navigation, couleurs : inchangés. Aucun autre fichier concerné (home.ts, Reveal, Layout vérifiés).

## Vérifications
- Syntaxe TypeScript : 0 erreur. Non testé ici : appareil réel.
