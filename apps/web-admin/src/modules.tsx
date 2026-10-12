// src/modules.tsx
// =========================================================
// REGISTRE DES PAGES
//
// Une page n'existe dans l'application que si elle est enregistrée ici
// (avec les rôles autorisés). Pour livrer un module d'une phase suivante :
//   1. créer la page dans src/pages/…
//   2. l'ajouter à MODULE_ROUTES
//   3. passer `ready: true` dans src/navigation.ts
// =========================================================

import type { ReactElement } from 'react';
import { WEB_ROLES, type WebRole } from '@direct-transfair/shared';
import AccountPage from './pages/AccountPage';
import AgenciesPage from './pages/agencies/AgenciesPage';
import AgencyCreatePage from './pages/agencies/AgencyCreatePage';
import AgencyDetailPage from './pages/agencies/AgencyDetailPage';
import AgencyWithdrawalsPage from './pages/agency-withdrawals/AgencyWithdrawalsPage';
import AgentCreatePage from './pages/agents/AgentCreatePage';
import AgentsPage from './pages/agents/AgentsPage';
import CommissionsPage from './pages/commissions/CommissionsPage';
import CompaniesPage from './pages/companies/CompaniesPage';
import CompanyCreatePage from './pages/companies/CompanyCreatePage';
import CompanyDetailPage from './pages/companies/CompanyDetailPage';
import DashboardPage from './pages/DashboardPage';
import DepositPage from './pages/desk/DepositPage';
import RemitPage from './pages/desk/RemitPage';
import SendCashPage from './pages/desk/SendCashPage';
import WithdrawPage from './pages/desk/WithdrawPage';
import FeeSchedulePage from './pages/fees/FeeSchedulePage';
import FeesPage from './pages/fees/FeesPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import RateHistoryPage from './pages/rates/RateHistoryPage';
import RatesPage from './pages/rates/RatesPage';
import SettingsPage from './pages/settings/SettingsPage';
import SupervisionPage from './pages/supervision/SupervisionPage';
import TransactionDetailPage from './pages/transactions/TransactionDetailPage';
import TransactionsPage from './pages/transactions/TransactionsPage';
import TreasuryPage from './pages/treasury/TreasuryPage';
import WalletLedgerPage from './pages/treasury/WalletLedgerPage';
import UserCreatePage from './pages/users/UserCreatePage';
import UserDetailPage from './pages/users/UserDetailPage';
import UsersPage from './pages/users/UsersPage';
import WalletClientDetailPage from './pages/wallet-clients/WalletClientDetailPage';
import WalletClientsPage from './pages/wallet-clients/WalletClientsPage';

const SUPER: readonly WebRole[] = ['SUPER_ADMIN'];
const COMPANY: readonly WebRole[] = ['COMPANY_ADMIN'];
const AGENT: readonly WebRole[] = ['AGENT'];
const COMPANY_AGENT: readonly WebRole[] = ['COMPANY_ADMIN', 'AGENT'];
const ADMINS: readonly WebRole[] = ['SUPER_ADMIN', 'COMPANY_ADMIN'];

export interface ModuleRoute {
  path: string;
  roles: readonly WebRole[];
  element: ReactElement;
}

export const MODULE_ROUTES: readonly ModuleRoute[] = [
  { path: '/', roles: WEB_ROLES, element: <DashboardPage /> },
  { path: '/account', roles: WEB_ROLES, element: <AccountPage /> },

  // Phase 2a — Sociétés (super admin)
  { path: '/companies', roles: SUPER, element: <CompaniesPage /> },
  { path: '/companies/new', roles: SUPER, element: <CompanyCreatePage /> },
  { path: '/companies/:id', roles: SUPER, element: <CompanyDetailPage /> },

  // Phase 2b — Utilisateurs (super admin : tous ; admin de société : sa société, filtrée par le serveur)
  { path: '/users', roles: ADMINS, element: <UsersPage /> },
  { path: '/users/new', roles: SUPER, element: <UserCreatePage /> },
  { path: '/users/:id', roles: ADMINS, element: <UserDetailPage /> },

  // Phase 2c — Transactions (super admin : tout ; admin de société : sa société ; agent : ses opérations)
  { path: '/transactions', roles: WEB_ROLES, element: <TransactionsPage /> },
  { path: '/transactions/:id', roles: WEB_ROLES, element: <TransactionDetailPage /> },

  // Phase 2d — Trésorerie (super admin : ses soldes et les virements à valider ; admin de société : sa société)
  { path: '/treasury', roles: ADMINS, element: <TreasuryPage /> },
  { path: '/treasury/wallets/:id', roles: ADMINS, element: <WalletLedgerPage /> },

  // Phase 2e — Supervision (super admin ; la page s'adapte déjà à un admin de société, ouverte en phase 3)
  { path: '/supervision', roles: SUPER, element: <SupervisionPage /> },

  // Phase 2f — Taux de change (super admin : fixe les taux ; admin de société : lecture seule)
  { path: '/rates', roles: ADMINS, element: <RatesPage /> },
  { path: '/rates/:pair/history', roles: ADMINS, element: <RateHistoryPage /> },

  // Phase 2g — Frais d'envoi (admin de société : modifie le tarif de sa société ; super admin : consulte celui de chacune)
  { path: '/fees', roles: ADMINS, element: <FeesPage /> },
  { path: '/fees/schedule', roles: ADMINS, element: <FeeSchedulePage /> },

  // Phase 2h — Notifications (chaque rôle : ses propres notifications)
  { path: '/notifications', roles: WEB_ROLES, element: <NotificationsPage /> },

  // Phase 3a — Agences (admin de société)
  { path: '/agencies', roles: COMPANY, element: <AgenciesPage /> },
  { path: '/agencies/new', roles: COMPANY, element: <AgencyCreatePage /> },
  { path: '/agencies/:id', roles: COMPANY, element: <AgencyDetailPage /> },

  // Phase 3b — Agents (admin de société) : rattachés à une agence
  { path: '/agents', roles: COMPANY, element: <AgentsPage /> },
  { path: '/agents/new', roles: COMPANY, element: <AgentCreatePage /> },

  // Phase 3c/3d — Clients wallet et retraits d'agence (admin de société)
  { path: '/wallet-clients', roles: COMPANY, element: <WalletClientsPage /> },
  { path: '/wallet-clients/:id', roles: COMPANY, element: <WalletClientDetailPage /> },
  { path: '/agency-withdrawals', roles: COMPANY, element: <AgencyWithdrawalsPage /> },

  // Phase 3e — Commissions (admin de société : société et agences ; agent : les siennes) et Réglages (répartition des frais)
  { path: '/commissions', roles: COMPANY_AGENT, element: <CommissionsPage /> },
  { path: '/settings', roles: ADMINS, element: <SettingsPage /> },

  // Phase 4 — Guichet de l'agent : dépôt, retrait, envoi cash, remise à l'administrateur
  { path: '/deposit', roles: AGENT, element: <DepositPage /> },
  { path: '/withdraw', roles: AGENT, element: <WithdrawPage /> },
  { path: '/send-cash', roles: AGENT, element: <SendCashPage /> },
  { path: '/remit', roles: AGENT, element: <RemitPage /> },
];
