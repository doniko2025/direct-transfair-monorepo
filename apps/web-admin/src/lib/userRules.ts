// src/lib/userRules.ts
// Libellés et règles de gestion des comptes utilisateurs.

import type { AuthUser, ComplianceStatus, KycLevel } from '@direct-transfair/shared';
import type { StatusTone } from './companyRules';

export const ROLE_NAME: Record<string, string> = {
  SUPER_ADMIN: 'Super administrateur',
  COMPANY_ADMIN: 'Administrateur de société',
  AGENT: 'Agent',
  USER: 'Client wallet',
};

export function roleName(role: string): string {
  return ROLE_NAME[role] ?? role;
}

export function roleTone(role: string): 'brand' | 'neutral' {
  return role === 'SUPER_ADMIN' || role === 'COMPANY_ADMIN' ? 'brand' : 'neutral';
}

export function fullName(u: { firstName: string | null; lastName: string | null; email: string }): string {
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
}

export function initialsOf(u: { firstName: string | null; lastName: string | null; email: string }): string {
  const letters = `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.trim();
  return (letters || u.email[0] || '?').toUpperCase();
}

export type AccountState = 'active' | 'suspended' | 'inactive';

export function accountState(u: { isActive: boolean; isSuspended: boolean }): AccountState {
  if (u.isSuspended) return 'suspended';
  if (!u.isActive) return 'inactive';
  return 'active';
}

export const ACCOUNT_LABEL: Record<AccountState, string> = {
  active: 'Actif',
  suspended: 'Suspendu',
  inactive: 'Désactivé',
};

export const ACCOUNT_TONE: Record<AccountState, StatusTone> = {
  active: 'ok',
  suspended: 'warn',
  inactive: 'neutral',
};

export const KYC_LABEL: Record<KycLevel, string> = {
  LEVEL_0: 'Niveau 0 · aucune vérification',
  LEVEL_1: 'Niveau 1 · pièce d’identité',
  LEVEL_2: 'Niveau 2 · + justificatif de domicile',
  LEVEL_3: 'Niveau 3 · vérification complète',
};

export const COMPLIANCE_LABEL: Record<ComplianceStatus, string> = {
  CLEAR: 'Aucun problème',
  REVIEW: 'En révision',
  BLOCKED: 'Bloqué',
};

export const COMPLIANCE_TONE: Record<ComplianceStatus, StatusTone> = {
  CLEAR: 'ok',
  REVIEW: 'warn',
  BLOCKED: 'warn',
};

/**
 * Qui peut suspendre, réactiver, modifier ou supprimer quel compte.
 *   - jamais son propre compte ;
 *   - le super admin gère tout le monde ;
 *   - l'admin de société ne gère que les agents et clients (le serveur, lui, le laisserait
 *     aussi agir sur les autres administrateurs de sa société : on restreint côté web).
 * Ceci ne remplace pas le contrôle serveur.
 */
export function canManage(actor: Pick<AuthUser, 'id' | 'role'>, target: { id: string; role: string }): boolean {
  if (String(actor.id) === target.id) return false;
  if (actor.role === 'SUPER_ADMIN') return true;
  if (actor.role === 'COMPANY_ADMIN') return target.role === 'AGENT' || target.role === 'USER';
  return false;
}

export function formatDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
