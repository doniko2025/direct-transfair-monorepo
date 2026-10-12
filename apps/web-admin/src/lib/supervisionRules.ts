// src/lib/supervisionRules.ts
// Libellés, tons et formats de l'écran Supervision.

import type {
  AlertSeverity,
  AlertType,
  AttentionKind,
  AuditActor,
  AuditAction,
  HealthStatus,
} from '@direct-transfair/shared';
import type { IconName } from '../components/Icon';

export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger';

export function plural(n: number, one: string, many: string): string {
  return n > 1 ? many : one;
}

// ─── Points d'attention ──────────────────────────────────

export interface AttentionView {
  title: string;
  text: (n: number) => string;
  icon: IconName;
  /** Page où traiter le sujet ; `anchor` = section de la page Supervision. */
  to?: string;
  anchor?: string;
  cta: string;
}

export const ATTENTION: Record<AttentionKind, AttentionView> = {
  CRITICAL_ALERTS: {
    title: 'Alertes importantes',
    text: (n) => `${n} ${plural(n, 'alerte de gravité haute ou critique attend', 'alertes de gravité haute ou critique attendent')} un traitement.`,
    icon: 'alert',
    anchor: 'alerts',
    cta: 'Voir les alertes',
  },
  STUCK_TRANSACTIONS: {
    title: 'Transactions bloquées',
    text: (n) => `${n} ${plural(n, 'transaction est en cours', 'transactions sont en cours')} depuis plus de 24 heures.`,
    icon: 'list',
    to: '/transactions',
    cta: 'Ouvrir les transactions',
  },
  ON_HOLD_TRANSACTIONS: {
    title: 'Transactions retenues',
    text: (n) => `${n} ${plural(n, 'transaction est retenue', 'transactions sont retenues')} pour vérification et ${plural(n, 'attend', 'attendent')} une décision.`,
    icon: 'shield',
    to: '/transactions',
    cta: 'Ouvrir les transactions',
  },
  LOCKED_ACCOUNTS: {
    title: 'Comptes verrouillés',
    text: (n) => `${n} ${plural(n, 'compte est bloqué', 'comptes sont bloqués')} après des échecs de connexion.`,
    icon: 'user',
    to: '/users',
    cta: 'Ouvrir les utilisateurs',
  },
  SUSPENDED_COMPANIES: {
    title: 'Sociétés suspendues',
    text: (n) => `${n} ${plural(n, 'société est suspendue', 'sociétés sont suspendues')} : ${plural(n, 'elle', 'elles')} ne peut plus opérer.`,
    icon: 'building',
    to: '/companies',
    cta: 'Ouvrir les sociétés',
  },
  EXPIRED_COMPANIES: {
    title: 'Abonnements expirés',
    text: (n) => `${n} ${plural(n, 'société a un abonnement expiré', 'sociétés ont un abonnement expiré')}.`,
    icon: 'building',
    to: '/companies',
    cta: 'Ouvrir les sociétés',
  },
  EXPIRING_SUBSCRIPTIONS: {
    title: 'Abonnements bientôt échus',
    text: (n) => `${n} ${plural(n, 'société voit', 'sociétés voient')} son abonnement se terminer dans les 14 prochains jours.`,
    icon: 'building',
    to: '/companies',
    cta: 'Ouvrir les sociétés',
  },
};

// ─── Santé ───────────────────────────────────────────────

export const HEALTH_TONE: Record<HealthStatus, Tone> = { ok: 'ok', warn: 'warn', error: 'danger' };

export function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 60) return 'moins d’une minute';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${String(minutes % 60).padStart(2, '0')}`;
  const days = Math.floor(hours / 24);
  return `${days} j ${hours % 24} h`;
}

// ─── Alertes ─────────────────────────────────────────────

export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  LOW: 'Faible',
  MEDIUM: 'Moyenne',
  HIGH: 'Haute',
  CRITICAL: 'Critique',
};

export const SEVERITY_TONE: Record<AlertSeverity, Tone> = {
  LOW: 'neutral',
  MEDIUM: 'warn',
  HIGH: 'danger',
  CRITICAL: 'danger',
};

export const SEVERITY_OPTIONS = (Object.keys(SEVERITY_LABEL) as AlertSeverity[]).map((value) => ({
  value,
  label: SEVERITY_LABEL[value],
}));

export const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  SUSPICIOUS_TRANSACTION: 'Transaction suspecte',
  LARGE_WITHDRAWAL: 'Retrait important',
  MULTIPLE_FAILED_LOGIN: 'Échecs de connexion répétés',
  LOW_AGENCY_BALANCE: 'Caisse d’agence presque vide',
  SUBSCRIPTION_EXPIRY: 'Abonnement bientôt échu',
  KYC_EXPIRED: 'Vérification d’identité expirée',
  AML_FLAG: 'Signalement anti-blanchiment',
  RATE_ALERT_TRIGGERED: 'Alerte de taux déclenchée',
  SCHEDULED_TRANSFER_FAILED: 'Virement programmé en échec',
  DEVICE_NEW_LOGIN: 'Connexion depuis un nouvel appareil',
};

export type AlertTab = 'open' | 'resolved' | 'all';

export const ALERT_TABS: readonly { id: AlertTab; label: string }[] = [
  { id: 'open', label: 'À traiter' },
  { id: 'resolved', label: 'Traitées' },
  { id: 'all', label: 'Toutes' },
];

// ─── Journal d'audit ─────────────────────────────────────

interface AuditView {
  label: string;
  icon: IconName;
  tone: Tone;
}

const A = (label: string, icon: IconName, tone: Tone = 'neutral'): AuditView => ({ label, icon, tone });

export const AUDIT: Record<string, AuditView> = {
  LOGIN: A('Connexion', 'user', 'brand'),
  LOGIN_PHONE: A('Connexion par téléphone', 'user', 'brand'),
  LOGOUT: A('Déconnexion', 'logout'),
  PASSWORD_CHANGE: A('Mot de passe modifié', 'shield', 'warn'),
  OTP_REQUEST: A('Code de vérification demandé', 'shield'),
  OTP_VERIFY: A('Code de vérification validé', 'check', 'ok'),
  OTP_FAILED: A('Code de vérification refusé', 'alert', 'warn'),
  ACCOUNT_LOCKED: A('Compte verrouillé', 'alert', 'danger'),
  ACCOUNT_UNLOCKED: A('Compte déverrouillé', 'check', 'ok'),
  MFA_ENABLED: A('Double authentification activée', 'shield', 'ok'),
  MFA_DISABLED: A('Double authentification désactivée', 'shield', 'warn'),
  TRANSACTION_CREATE: A('Transaction créée', 'send'),
  TRANSACTION_UPDATE: A('Transaction modifiée', 'edit', 'warn'),
  TRANSACTION_CANCEL: A('Transaction annulée', 'close', 'warn'),
  TRANSACTION_REFUND: A('Transaction remboursée', 'swap', 'warn'),
  WITHDRAWAL_PROCESS: A('Retrait traité', 'withdraw'),
  USER_CREATE: A('Utilisateur créé', 'plus', 'ok'),
  USER_UPDATE: A('Utilisateur modifié', 'edit'),
  USER_DELETE: A('Utilisateur supprimé', 'trash', 'danger'),
  USER_ROLE_CHANGE: A('Rôle modifié', 'users', 'warn'),
  USER_SUSPEND: A('Utilisateur suspendu', 'alert', 'danger'),
  USER_REACTIVATE: A('Utilisateur réactivé', 'check', 'ok'),
  AGENCY_CREATE: A('Agence créée', 'building', 'ok'),
  AGENCY_UPDATE: A('Agence modifiée', 'building'),
  AGENCY_DELETE: A('Agence supprimée', 'trash', 'danger'),
  CLIENT_CREATE: A('Société créée', 'building', 'ok'),
  CLIENT_UPDATE: A('Société modifiée', 'building'),
  CLIENT_SUSPEND: A('Société suspendue', 'alert', 'danger'),
  COMMISSION_CONFIG_UPDATE: A('Frais modifiés', 'percent', 'warn'),
  EXCHANGE_RATE_UPDATE: A('Taux de change modifié', 'swap', 'warn'),
  BALANCE_ADJUSTMENT: A('Solde ajusté', 'vault', 'warn'),
  SUSPICIOUS_ACTIVITY: A('Activité suspecte', 'alert', 'danger'),
  API_KEY_GENERATE: A('Clé d’API créée', 'shield', 'warn'),
  API_KEY_REVOKE: A('Clé d’API révoquée', 'shield', 'warn'),
  KYC_SUBMIT: A('Pièces d’identité envoyées', 'list'),
  KYC_APPROVE: A('Identité vérifiée', 'check', 'ok'),
  KYC_REJECT: A('Identité refusée', 'close', 'danger'),
  DEVICE_REGISTER: A('Appareil enregistré', 'shield'),
  DEVICE_REVOKE: A('Appareil retiré', 'shield', 'warn'),
  SCHEDULED_TRANSFER_CREATE: A('Virement programmé créé', 'send'),
  SCHEDULED_TRANSFER_CANCEL: A('Virement programmé annulé', 'close', 'warn'),
  SUPPORT_TICKET_CREATE: A('Demande d’assistance ouverte', 'info'),
  COMPLIANCE_CASE_CREATE: A('Dossier de conformité ouvert', 'shield', 'warn'),
  COMPLIANCE_CASE_RESOLVE: A('Dossier de conformité clos', 'check', 'ok'),
};

/** Les actions que le serveur ajouterait un jour s'affichent en toutes lettres plutôt qu'en code brut. */
export function auditView(action: AuditAction): AuditView {
  const known = AUDIT[action];
  if (known) return known;
  const text = action.toLowerCase().replace(/_/g, ' ');
  return { label: text.charAt(0).toUpperCase() + text.slice(1), icon: 'info', tone: 'neutral' };
}

export const AUDIT_OPTIONS = Object.entries(AUDIT)
  .map(([value, v]) => ({ value, label: v.label }))
  .sort((a, b) => a.label.localeCompare(b.label, 'fr'));

export function actorName(user: AuditActor | null): string {
  if (!user) return 'Système';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email;
}

export const ROLE_SHORT: Record<string, string> = {
  SUPER_ADMIN: 'Super admin',
  COMPANY_ADMIN: 'Admin société',
  AGENT: 'Agent',
  USER: 'Client',
};

// ─── Dates ───────────────────────────────────────────────

export function fullDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** « il y a 5 min » pendant la première journée, puis la date. */
export function when(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return 'À l’instant';
  if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3_600_000)} h`;
  return d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
