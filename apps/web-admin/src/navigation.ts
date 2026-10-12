// src/navigation.ts
// =========================================================
// MENU PAR RÔLE — source unique de vérité
//
// Les entrées viennent des écrans mobile à porter (app/(tabs)/admin/*,
// app/agent/*, dashboards). `ready: false` = affichée grisée avec la
// mention « Bientôt » ; chaque phase de portage passe son lot à `true`
// et enregistre la page dans src/modules.tsx.
// =========================================================

import { WEB_ROLES, type WebRole } from '@direct-transfair/shared';
import type { IconName } from './components/Icon';

export interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  path: string;
  roles: readonly WebRole[];
  ready: boolean;
}

const ALL = WEB_ROLES;
const SUPER: readonly WebRole[] = ['SUPER_ADMIN'];
const COMPANY: readonly WebRole[] = ['COMPANY_ADMIN'];
const AGENT: readonly WebRole[] = ['AGENT'];
const ADMINS: readonly WebRole[] = ['SUPER_ADMIN', 'COMPANY_ADMIN'];

export const NAV: readonly NavItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: 'dashboard', path: '/', roles: ALL, ready: true },

  // Super admin
  { id: 'companies', label: 'Sociétés', icon: 'building', path: '/companies', roles: SUPER, ready: true },
  { id: 'supervision', label: 'Supervision', icon: 'eye', path: '/supervision', roles: SUPER, ready: true },

  // Admin société
  { id: 'agencies', label: 'Agences', icon: 'building', path: '/agencies', roles: COMPANY, ready: false },
  { id: 'agents', label: 'Agents', icon: 'users', path: '/agents', roles: COMPANY, ready: false },
  { id: 'wallet-clients', label: 'Clients wallet', icon: 'wallet', path: '/wallet-clients', roles: COMPANY, ready: false },

  // Agent
  { id: 'deposit', label: 'Dépôt', icon: 'deposit', path: '/deposit', roles: AGENT, ready: false },
  { id: 'withdraw', label: 'Retrait', icon: 'withdraw', path: '/withdraw', roles: AGENT, ready: false },
  { id: 'send-cash', label: 'Envoi cash', icon: 'send', path: '/send-cash', roles: AGENT, ready: false },
  { id: 'remit', label: "Remise à l'administrateur", icon: 'vault', path: '/remit', roles: AGENT, ready: false },

  // Communs à plusieurs rôles
  { id: 'users', label: 'Utilisateurs', icon: 'users', path: '/users', roles: ADMINS, ready: true },
  { id: 'transactions', label: 'Transactions', icon: 'list', path: '/transactions', roles: ALL, ready: true },
  { id: 'treasury', label: 'Trésorerie', icon: 'vault', path: '/treasury', roles: ADMINS, ready: true },
  { id: 'commissions', label: 'Commissions', icon: 'percent', path: '/commissions', roles: ['COMPANY_ADMIN', 'AGENT'], ready: false },
  { id: 'rates', label: 'Taux de change', icon: 'swap', path: '/rates', roles: ADMINS, ready: true },
  { id: 'fees', label: 'Frais', icon: 'percent', path: '/fees', roles: ADMINS, ready: true },
  { id: 'agency-withdrawals', label: "Retraits d'agence", icon: 'withdraw', path: '/agency-withdrawals', roles: COMPANY, ready: false },
  { id: 'notifications', label: 'Notifications', icon: 'bell', path: '/notifications', roles: ALL, ready: true },
  { id: 'settings', label: 'Réglages', icon: 'cog', path: '/settings', roles: ADMINS, ready: false },

  { id: 'account', label: 'Mon compte', icon: 'user', path: '/account', roles: ALL, ready: true },
];

export function navFor(role: WebRole): NavItem[] {
  return NAV.filter((item) => item.roles.includes(role));
}

export const ROLE_LABEL: Record<WebRole, string> = {
  SUPER_ADMIN: 'Super administrateur',
  COMPANY_ADMIN: 'Administrateur de société',
  AGENT: 'Agent',
};
