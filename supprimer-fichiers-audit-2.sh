#!/usr/bin/env bash
# Lot « audit » n°2 — supprime le contrôleur POST /rates (doublon jamais appelé de /rates-admin).
# À lancer depuis la racine du dépôt (Git Bash). Ni commit ni push.
set -euo pipefail
f="apps/backend/src/rates/rates.controller.ts"
if [ -f "$f" ]; then rm "$f" && echo "supprimé : $f"; else echo "déjà absent : $f"; fi
echo "Terminé. Relis « git status » puis valide toi-même."
