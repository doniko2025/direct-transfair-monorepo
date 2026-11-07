// src/navigation.ts
// Lot C : + « Domaines » (super admin) → /portal-domains.
// =========================================================
// MENU PAR RÔLE — source unique de vérité
//
// Les entrées viennent des écrans mobile à porter (app/(tabs)/admin/*,
// app/agent/*, dashboards). `ready: false` = affichée grisée avec la
// mention « Bientôt » ; chaque phase de portage passe son lot à `true`
// et enregistre la page dans src/modules.tsx.
// =========================================================

import { WEB_ROLES, can, type AuthUser, type SupportPermission, type WebRole } from '@direct-transfair/shared';
import type { IconName } from './components/Icon';

export interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  path: string;
  roles: readonly WebRole[];
  ready: boolean;
  /** Lot 9 — pour le service client : l'entrée n'apparaît que si l'une de ces délégations est active (les administrateurs les ont toutes). */
  permission?: readonly SupportPermission[];
}

const ALL = WEB_ROLES;
/** Rôles du personnel opérationnel (tout sauf le service client, qui a son propre espace). */
const OPS: readonly WebRole[] = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'AGENT'];
const SUPPORT: readonly WebRole[] = ['SUPPORT'];
const COMPANY_SUPPORT: readonly WebRole[] = ['COMPANY_ADMIN', 'SUPPORT'];
const SUPER: readonly WebRole[] = ['SUPER_ADMIN'];
const COMPANY: readonly WebRole[] = ['COMPANY_ADMIN'];
const AGENT: readonly WebRole[] = ['AGENT'];
const ADMINS: readonly WebRole[] = ['SUPER_ADMIN', 'COMPANY_ADMIN'];

export const NAV: readonly NavItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: 'dashboard', path: '/', roles: ALL, ready: true },

  // Super admin
  { id: 'companies', label: 'Sociétés', icon: 'building', path: '/companies', roles: SUPER, ready: true },
  { id: 'contracts', label: 'Contrats', icon: 'file', path: '/contracts', roles: SUPER, ready: true },
  { id: 'portal-domains', label: 'Domaines', icon: 'globe', path: '/portal-domains', roles: SUPER, ready: true },
  { id: 'supervision', label: 'Supervision', icon: 'eye', path: '/supervision', roles: SUPER, ready: true },

  // Admin société
  { id: 'agencies', label: 'Agences', icon: 'building', path: '/agencies', roles: COMPANY, ready: true },
  { id: 'agents', label: 'Agents', icon: 'users', path: '/agents', roles: COMPANY, ready: true },
  { id: 'wallet-clients', label: 'Clients wallet', icon: 'wallet', path: '/wallet-clients', roles: COMPANY, ready: true },
  { id: 'merchants', label: 'Marchands', icon: 'wallet', path: '/merchants', roles: COMPANY, ready: true },
  { id: 'merchant-payouts', label: 'Retraits marchands', icon: 'withdraw', path: '/merchants/payouts', roles: COMPANY, ready: true },
  { id: 'support-staff', label: 'Service client', icon: 'users', path: '/support-staff', roles: COMPANY, ready: true },
  { id: 'kyc', label: 'Vérifications KYC', icon: 'shield', path: '/kyc', roles: [...ADMINS, 'SUPPORT'], ready: true, permission: ['KYC_REVIEW'] },
  { id: 'kyc-passage', label: 'Clients de passage', icon: 'file', path: '/kyc/passage', roles: SUPPORT, ready: true, permission: ['KYC_COUNTER'] },

  // Service client (lot 9) — chaque entrée dépend d'une délégation que l'administrateur active ou coupe
  { id: 'support-clients', label: 'Clients', icon: 'users', path: '/support/clients', roles: SUPPORT, ready: true, permission: ['CLIENTS_VIEW'] },
  { id: 'support-tickets', label: 'Demandes & litiges', icon: 'list', path: '/support/tickets', roles: COMPANY_SUPPORT, ready: true, permission: ['TICKETS_HANDLE'] },
  { id: 'support-refunds', label: 'Remboursements', icon: 'swap', path: '/support/refunds', roles: COMPANY_SUPPORT, ready: true, permission: ['REFUNDS_DECIDE', 'DISPUTES_RESOLVE'] },
  { id: 'support-transactions', label: 'Opérations', icon: 'send', path: '/support/transactions', roles: SUPPORT, ready: true, permission: ['TRANSACTIONS_VIEW'] },

  // Agent
  { id: 'deposit', label: 'Dépôt', icon: 'deposit', path: '/deposit', roles: AGENT, ready: true },
  { id: 'withdraw', label: 'Retrait', icon: 'withdraw', path: '/withdraw', roles: AGENT, ready: true },
  { id: 'send-cash', label: 'Envoi cash', icon: 'send', path: '/send-cash', roles: AGENT, ready: true },
  { id: 'remit', label: "Remise à l'administrateur", icon: 'vault', path: '/remit', roles: AGENT, ready: true },

  // Communs à plusieurs rôles
  { id: 'users', label: 'Utilisateurs', icon: 'users', path: '/users', roles: ADMINS, ready: true },
  { id: 'transactions', label: 'Transactions', icon: 'list', path: '/transactions', roles: OPS, ready: true },
  { id: 'treasury', label: 'Trésorerie', icon: 'vault', path: '/treasury', roles: ADMINS, ready: true },
  { id: 'commissions', label: 'Commissions', icon: 'percent', path: '/commissions', roles: ['COMPANY_ADMIN', 'AGENT'], ready: true },
  { id: 'rates', label: 'Taux de change', icon: 'swap', path: '/rates', roles: ADMINS, ready: true },
  { id: 'fees', label: 'Frais', icon: 'percent', path: '/fees', roles: ADMINS, ready: true },
  { id: 'agency-withdrawals', label: "Retraits d'agence", icon: 'withdraw', path: '/agency-withdrawals', roles: COMPANY, ready: true },
  { id: 'notifications', label: 'Notifications', icon: 'bell', path: '/notifications', roles: ALL, ready: true },
  { id: 'settings', label: 'Réglages', icon: 'cog', path: '/settings', roles: ADMINS, ready: true },

  { id: 'account', label: 'Mon compte', icon: 'user', path: '/account', roles: ALL, ready: true },
];

/**
 * Entrées du menu d'un utilisateur : filtrées par rôle, puis — pour le service client — par délégation active.
 * Le serveur refait le même contrôle à chaque requête : masquer l'entrée n'est qu'un confort.
 */
export function navFor(role: WebRole, user?: Pick<AuthUser, 'role' | 'supportPermissions'> | null): NavItem[] {
  return NAV.filter((item) => {
    if (!item.roles.includes(role)) return false;
    if (role === 'SUPPORT' && item.permission) return can(user ?? { role, supportPermissions: [] }, ...item.permission);
    return true;
  });
}

export const ROLE_LABEL: Record<WebRole, string> = {
  SUPER_ADMIN: 'Super administrateur',
  COMPANY_ADMIN: 'Administrateur de société',
  AGENT: 'Agent',
  SUPPORT: 'Service client',
};
