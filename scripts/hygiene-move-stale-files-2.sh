#!/usr/bin/env bash
# scripts/hygiene-move-stale-files-2.sh
# Complément du premier script : range à l'écart (sans rien supprimer) les derniers fichiers égarés à la racine de
# l'app mobile — api.ts, colors.ts et les dossiers ios/ plugin/ rsc/ vendor/ node/ types/ (copies partielles du paquet
# expo-router, jamais utilisées par l'application).
#
# Usage depuis la racine du repo (Git Bash) :
#   bash scripts/hygiene-move-stale-files-2.sh           -> simulation : liste seulement
#   bash scripts/hygiene-move-stale-files-2.sh --apply   -> déplace dans _to_delete/ et ajoute « _to_delete/ » au .gitignore
#
# Garde-fou : un élément n'est déplacé que si AUCUN fichier de l'application, ni app.json / eas.json / package.json /
# tsconfig.json, ne le référence. Sinon il est gardé et signalé « GARDÉ ».
# Ne touche PAS à data/ (utilisé par les écrans d'envoi et de dépôt). Ne fait ni commit ni push.
set -u
cd "$(dirname "$0")/.."
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
DEST="_to_delete"
MOBILE="apps/direct-transfair-mobile"
SRC_DIRS="app components providers services hooks lib utils theme data assets"
CFG_FILES="app.json eas.json package.json tsconfig.json"

# Fichiers de code de l'application (hors node_modules), à scruter.
search_code() { # $1 = motif ERE
  local d found=1
  for d in $SRC_DIRS; do
    [ -d "$MOBILE/$d" ] || continue
    if grep -rEq --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.json' -- "$1" "$MOBILE/$d" 2>/dev/null; then found=0; fi
  done
  return $found
}
search_cfg() { # $1 = motif ERE
  local f
  for f in $CFG_FILES; do
    [ -f "$MOBILE/$f" ] && grep -Eq -- "$1" "$MOBILE/$f" && return 0
  done
  return 1
}

move() {
  local path="$1" why="$2"
  [ -e "$path" ] || return 0
  echo "  - $path   ($why)"
  if [ "$APPLY" = 1 ]; then
    mkdir -p "$DEST/$(dirname "$path")"
    mv -- "$path" "$DEST/$path"
  fi
}

echo "== Fichiers égarés à la racine de l'app mobile =="

# api.ts : couche de compatibilité vers services/api (« ../api », jamais « ./api » qui, dans services/, vise services/api.ts)
if [ -f "$MOBILE/api.ts" ]; then
  if search_code "(\\.\\./)+api['\"]"; then echo "  - $MOBILE/api.ts   GARDÉ (importé quelque part : « ../api »)"
  else move "$MOBILE/api.ts" "couche de compatibilité inutilisée → services/api.ts"; fi
fi

if [ -f "$MOBILE/colors.ts" ]; then
  if search_code "(\\.\\./)+colors['\"]"; then echo "  - $MOBILE/colors.ts   GARDÉ (importé quelque part : « ../colors »)"
  else move "$MOBILE/colors.ts" "ancienne palette inutilisée (les composants lisent theme/colors)"; fi
fi

for d in ios plugin rsc vendor node types; do
  [ -d "$MOBILE/$d" ] || continue
  # Référence à la racine de l'app : « ../ios/… » depuis un sous-dossier du code (un « ./types » écrit dans services/
  # vise services/types.ts, pas la racine), ou « ./plugin » / « plugin/ » dans une config située à la racine.
  if search_code "(\\.\\./)+$d(/|['\"])" || search_cfg "\\./$d(/|['\"])|\"$d/"; then
    echo "  - $MOBILE/$d/   GARDÉ (référencé par le code ou une config)"
  else
    case "$d" in
      ios) move "$MOBILE/$d" "module natif ExpoHead d'expo-router, copié par erreur ; un dossier ios/ fait croire à EAS à un projet natif" ;;
      *)   move "$MOBILE/$d" "copie partielle d'expo-router, inutilisée" ;;
    esac
  fi
done

if [ -d "$MOBILE/data" ]; then
  echo "  (data/ conservé : utilisé par les écrans d'envoi, de dépôt et d'envoi cash)"
fi

if [ "$APPLY" = 1 ]; then
  if [ -f .gitignore ] && ! grep -qxF "$DEST/" .gitignore; then
    printf '\n# Fichiers rangés à l écart par scripts/hygiene-move-stale-files*.sh (à supprimer à la main)\n%s/\n' "$DEST" >> .gitignore
    echo "  .gitignore : « $DEST/ » ajouté"
  fi
  echo "Terminé. Lance ensuite : pnpm --filter direct-transfair-mobile exec tsc --noEmit  puis un export web."
else
  echo "Simulation terminée : relance avec --apply pour déplacer."
fi
