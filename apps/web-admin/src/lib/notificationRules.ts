// src/lib/notificationRules.ts
// Libellés, tons et lien de transaction des notifications.

import type { AppNotification } from '@direct-transfair/shared';
import type { IconName } from '../components/Icon';
import type { Tone } from './supervisionRules';

export interface NotificationView {
  label: string;
  tone: Tone;
  icon: IconName;
}

export const NOTIFICATION_VIEW: Record<string, NotificationView> = {
  INFO: { label: 'Information', tone: 'neutral', icon: 'info' },
  SUCCESS: { label: 'Succès', tone: 'ok', icon: 'check' },
  WARNING: { label: 'Attention', tone: 'warn', icon: 'alert' },
  ERROR: { label: 'Erreur', tone: 'danger', icon: 'alert' },
  TRANSACTION: { label: 'Transaction', tone: 'brand', icon: 'swap' },
  SECURITY: { label: 'Sécurité', tone: 'danger', icon: 'shield' },
  MARKETING: { label: 'Promotion', tone: 'neutral', icon: 'percent' },
  SYSTEM: { label: 'Système', tone: 'neutral', icon: 'cog' },
};

/** Un type inconnu (ajouté plus tard côté serveur) s'affiche tel quel, sans planter. */
export function viewOf(type: string): NotificationView {
  return NOTIFICATION_VIEW[type] ?? { label: type, tone: 'neutral', icon: 'info' };
}

export const TYPE_OPTIONS = Object.entries(NOTIFICATION_VIEW).map(([value, v]) => ({ value, label: v.label }));

export function isUrgent(n: Pick<AppNotification, 'priority'>): boolean {
  return n.priority === 'HIGH' || n.priority === 'URGENT';
}

const ID = /^[A-Za-z0-9_-]{8,40}$/;

/** Identifiant de transaction porté par la notification, seulement s'il a la forme d'un identifiant. */
export function transactionIdOf(n: Pick<AppNotification, 'metadata'>): string | null {
  const id = n.metadata?.['transactionId'];
  return typeof id === 'string' && ID.test(id) ? id : null;
}
