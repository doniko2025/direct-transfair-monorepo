#!/usr/bin/env bash
# Phase 5 — supprime les fichiers du mobile réservés au web (à lancer à la racine du dépôt)
set -e
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/_layout.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/agencies/\[id\].tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/agencies/agents.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/agencies/create.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/agencies/details.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/agencies/edit.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/agencies/index.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/agency-withdrawal.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/clients/details.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/clients/edit.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/commissions/config.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/fees.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/index.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/notifications.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/rates.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/settings.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/super-dashboard.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/supervision.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/transactions.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/treasury.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/users.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/wallet-client-detail.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/admin/wallet-clients.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/agencies/index.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/profile/personal-info-admin.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/profile/personal-info-agent.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/profile/personal-info-super-admin.tsx
rm -f -- apps/direct-transfair-mobile/app/\(tabs\)/withdraw.tsx
rm -f -- apps/direct-transfair-mobile/app/agent/commissions.tsx
rm -f -- apps/direct-transfair-mobile/app/agent/deposit.tsx
rm -f -- apps/direct-transfair-mobile/app/agent/receipt.tsx
rm -f -- apps/direct-transfair-mobile/app/agent/remit-to-admin.tsx
rm -f -- apps/direct-transfair-mobile/app/agent/send-cash.tsx
rm -f -- apps/direct-transfair-mobile/app/agent/transactions.tsx
rm -f -- apps/direct-transfair-mobile/app/agent/withdraw.tsx
rm -f -- apps/direct-transfair-mobile/components/CommissionFilter.tsx
rm -f -- apps/direct-transfair-mobile/components/agencies/RefillAgencyModal.tsx
rm -f -- apps/direct-transfair-mobile/components/dashboards/AgentDashboard.tsx
rm -f -- apps/direct-transfair-mobile/components/dashboards/CompanyDashboard.tsx
rm -f -- apps/direct-transfair-mobile/components/dashboards/CreateCompanyModal.tsx
rm -f -- apps/direct-transfair-mobile/components/dashboards/SuperAdmin.utils.ts
rm -f -- apps/direct-transfair-mobile/components/dashboards/SuperAdminDashboard.tsx
rm -f -- apps/direct-transfair-mobile/components/dashboards/SuperAdminOverview.tsx
rm -f -- apps/direct-transfair-mobile/hooks/useAdminRoute.ts
# dossiers devenus vides
find apps/direct-transfair-mobile/app apps/direct-transfair-mobile/components -type d -empty -delete
echo "Terminé : 44 fichiers supprimés."
