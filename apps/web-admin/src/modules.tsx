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
import CompaniesPage from './pages/companies/CompaniesPage';
import CompanyCreatePage from './pages/companies/CompanyCreatePage';
import CompanyDetailPage from './pages/companies/CompanyDetailPage';
import DashboardPage from './pages/DashboardPage';
import RateHistoryPage from './pages/rates/RateHistoryPage';
import RatesPage from './pages/rates/RatesPage';
import SupervisionPage from './pages/supervision/SupervisionPage';
import TransactionDetailPage from './pages/transactions/TransactionDetailPage';
import TransactionsPage from './pages/transactions/TransactionsPage';
import TreasuryPage from './pages/treasury/TreasuryPage';
import WalletLedgerPage from './pages/treasury/WalletLedgerPage';
import UserCreatePage from './pages/users/UserCreatePage';
import UserDetailPage from './pages/users/UserDetailPage';
import UsersPage from './pages/users/UsersPage';

const SUPER: readonly WebRole[] = ['SUPER_ADMIN'];
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
];
