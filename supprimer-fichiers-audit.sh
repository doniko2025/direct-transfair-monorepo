#!/usr/bin/env bash
# supprimer-fichiers-audit.sh — à lancer UNE FOIS à la racine du dépôt (Git Bash), APRÈS avoir copié le contenu du zip.
# Ne fait ni commit ni push : il ne supprime / renomme que des fichiers de l'arbre de travail.
# Idempotent : on peut le relancer sans risque.
#
# Contenu :
#   0. migrations renommées : retire les anciens dossiers datés dans le futur (seulement si le nouveau dossier est bien présent) ;
#   1. configuration EAS obsolète de la racine (projet com.dftransfer…, remplacé par apps/direct-transfair-mobile) ;
#   2. code mort de l'application mobile (écrans admin / agent réservés au portail web + composants inutilisés) :
#      vérifié par analyse des imports : AUCUN fichier conservé ne les importe ;
#   3. fichiers du paquet expo-router copiés par erreur à la racine du mobile ; ancien babel.js (remplacé par babel.config.js) ;
#   4. client Prisma « plateforme » versionné par erreur (20 Mo, binaire Windows) : il est régénéré par « prisma generate » ;
#   5. configuration d'hébergeurs abandonnés (Railway / backend sur Vercel) ;
#   6. anciens scripts de nettoyage devenus inutiles.
set -e
cd "$(dirname "$0")"

echo "== 0. Migrations renommées =="
M=apps/backend/prisma/migrations
rename_check() { # ancien nouveau
  if [ -d "$M/$2" ] && [ -d "$M/$1" ]; then rm -rf -- "$M/$1"; echo "   ancien dossier retiré : $1"; fi
  if [ -d "$M/$1" ] && [ ! -d "$M/$2" ]; then echo "   ⚠️  $2 absent : copiez d'abord le zip (le dossier $1 est conservé)"; fi
}
rename_check 20261116090000_merchant_rccm                  20261115100000_merchant_rccm
rename_check 20261117090000_merchant_address_details       20261115110000_merchant_address_details
rename_check 20261118090000_transaction_commission_split   20261115120000_transaction_commission_split
rename_check 20261119090000_merchant_rccm_document         20261115130000_merchant_rccm_document
rename_check 20261120090000_exchange_rates_per_company     20261115140000_exchange_rates_per_company
rename_check 20261121090000_company_rccm_and_documents     20261115150000_company_rccm_and_documents

echo "== 1. Configuration EAS obsolète de la racine =="
rm -f -- app.json eas.json

echo "== 2-3. Code mort et fichiers égarés de l'application mobile =="
cd apps/direct-transfair-mobile
rm -f -- "_error.js"
rm -f -- "app.plugin.js"
rm -f -- "app/(tabs)/admin/_layout.tsx"
rm -f -- "app/(tabs)/admin/agencies/[id].tsx"
rm -f -- "app/(tabs)/admin/agencies/agents.tsx"
rm -f -- "app/(tabs)/admin/agencies/create.tsx"
rm -f -- "app/(tabs)/admin/agencies/details.tsx"
rm -f -- "app/(tabs)/admin/agencies/edit.tsx"
rm -f -- "app/(tabs)/admin/agencies/index.tsx"
rm -f -- "app/(tabs)/admin/agency-withdrawal.tsx"
rm -f -- "app/(tabs)/admin/clients/details.tsx"
rm -f -- "app/(tabs)/admin/clients/edit.tsx"
rm -f -- "app/(tabs)/admin/commissions/config.tsx"
rm -f -- "app/(tabs)/admin/fees.tsx"
rm -f -- "app/(tabs)/admin/index.tsx"
rm -f -- "app/(tabs)/admin/notifications.tsx"
rm -f -- "app/(tabs)/admin/rates.tsx"
rm -f -- "app/(tabs)/admin/settings.tsx"
rm -f -- "app/(tabs)/admin/super-dashboard.tsx"
rm -f -- "app/(tabs)/admin/supervision.tsx"
rm -f -- "app/(tabs)/admin/transactions.tsx"
rm -f -- "app/(tabs)/admin/treasury.tsx"
rm -f -- "app/(tabs)/admin/users.tsx"
rm -f -- "app/(tabs)/admin/wallet-client-detail.tsx"
rm -f -- "app/(tabs)/admin/wallet-clients.tsx"
rm -f -- "app/(tabs)/agencies/index.tsx"
rm -f -- "app/(tabs)/profile/personal-info-admin.tsx"
rm -f -- "app/(tabs)/profile/personal-info-agent.tsx"
rm -f -- "app/(tabs)/profile/personal-info-super-admin.tsx"
rm -f -- "app/(tabs)/withdraw.tsx"
rm -f -- "app/agent/commissions.tsx"
rm -f -- "app/agent/deposit.tsx"
rm -f -- "app/agent/receipt.tsx"
rm -f -- "app/agent/remit-to-admin.tsx"
rm -f -- "app/agent/send-cash.tsx"
rm -f -- "app/agent/transactions.tsx"
rm -f -- "app/agent/withdraw.tsx"
rm -f -- "components/CommissionFilter.tsx"
rm -f -- "components/DTButton.tsx"
rm -f -- "components/DTTextInput.tsx"
rm -f -- "components/TransactionItem.tsx"
rm -f -- "components/agencies/RefillAgencyModal.tsx"
rm -f -- "components/dashboards/AgentDashboard.tsx"
rm -f -- "components/dashboards/CompanyDashboard.tsx"
rm -f -- "components/dashboards/CreateCompanyModal.tsx"
rm -f -- "components/dashboards/DashboardShared.tsx"
rm -f -- "components/dashboards/SuperAdmin.utils.ts"
rm -f -- "components/dashboards/SuperAdminDashboard.tsx"
rm -f -- "components/dashboards/SuperAdminOverview.tsx"
rm -f -- "components/layout/Card.tsx"
rm -f -- "components/layout/Container.tsx"
rm -f -- "components/layout/TopBar.tsx"
rm -f -- "components/layout/useBreakpoint.ts"
rm -f -- "components/wallet/BalanceCard.tsx"
rm -f -- "components/wallet/ScreenHeader.tsx"
rm -f -- "components/wallet/Skeleton.tsx"
rm -f -- "components/wallet/StateViews.tsx"
rm -f -- "components/wallet/WalletParts.tsx"
rm -f -- "doctor.js"
rm -f -- "expo-module.config.json"
rm -f -- "hooks/useAdminRoute.ts"
rm -f -- "html.d.ts"
rm -f -- "html.js"
rm -f -- "index.js"
rm -f -- "server.d.ts"
rm -f -- "server.js"
rm -f -- "theme/colors.ts"
rm -f -- "theme/lightTheme.ts"
rm -f -- babel.js
# dossiers devenus vides
find app components theme hooks -type d -empty -delete 2>/dev/null || true
cd ../..

echo "== 4. Client Prisma plateforme versionné par erreur =="
rm -rf -- apps/backend/src/generated

echo "== 5. Hébergeurs abandonnés =="
rm -f -- nixpacks.toml apps/backend/vercel.json

echo "== 6. Anciens scripts de nettoyage =="
rm -f -- scripts/cleanup-mobile-dead-code.sh scripts/hygiene-move-stale-files.sh scripts/hygiene-move-stale-files-2.sh \
         supprimer-fichiers-phase5.sh supprimer-fichiers-phase6-lot2a.sh

echo "Terminé. Vérifiez ensuite :"
echo "  pnpm install && pnpm --filter direct-transfair-mobile exec tsc --noEmit -p tsconfig.json"
