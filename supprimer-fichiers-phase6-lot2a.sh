#!/bin/sh
# À lancer à la racine du dépôt. Supprime le DTO de POST /withdrawals (route retirée).
rm -f apps/backend/src/withdrawals/dto/create-withdrawal.dto.ts
echo "create-withdrawal.dto.ts supprimé."
