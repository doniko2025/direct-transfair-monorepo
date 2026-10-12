// packages/shared/src/notifications.ts
// =========================================================
// NOTIFICATIONS — la boîte de réception de l'utilisateur connecté (les siennes uniquement, tous rôles).
//
// Contrat : apps/backend/src/notifications/.
//   GET   /notifications?limit&unreadOnly   les plus récentes d'abord (50 par défaut, 100 au plus)
//   GET   /notifications/unread-count       { count }
//   PATCH /notifications/:id/read           { count } (0 = déjà lue ou introuvable)
//   PATCH /notifications/read-all           { count }
//
// Les notifications expirées ne sont pas renvoyées.
// =========================================================

import type { HttpClient } from './http';

export type NotificationKind =
  | 'INFO'
  | 'SUCCESS'
  | 'WARNING'
  | 'ERROR'
  | 'TRANSACTION'
  | 'SECURITY'
  | 'MARKETING'
  | 'SYSTEM';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationKind | string;
  priority: NotificationPriority | string;
  isRead: boolean;
  readAt: string | null;
  /** Libre : { transactionId?, action? … } selon l'émetteur. */
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export function createNotificationsApi(http: HttpClient) {
  return {
    list: (opts: { limit?: number; unreadOnly?: boolean } = {}) => {
      const q = new URLSearchParams();
      if (opts.limit) q.set('limit', String(opts.limit));
      if (opts.unreadOnly) q.set('unreadOnly', 'true');
      const qs = q.toString();
      return http.get<AppNotification[]>(`/notifications${qs ? `?${qs}` : ''}`);
    },

    unreadCount: () => http.get<{ count: number }>('/notifications/unread-count'),

    markRead: (id: string) => http.patch<{ count: number }>(`/notifications/${encodeURIComponent(id)}/read`),

    markAllRead: () => http.patch<{ count: number }>('/notifications/read-all'),
  };
}
