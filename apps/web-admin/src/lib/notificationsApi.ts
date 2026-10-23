// apps/web-admin/src/lib/notificationsApi.ts
// v1.0 — Suppression de notifications du back-office.
//
// Route du backend : POST /notifications/delete { ids: string[] } → { deleted }  (JwtAuthGuard).
// Elle ne supprime que les notifications de l'utilisateur connecté, 200 identifiants au plus par appel.
// Fichier isolé (comme accountApi.ts) : le package partagé n'est pas touché.

import { ApiError } from '@direct-transfair/shared';
import { http } from './api';
import { describeError } from './errors';

export interface DeleteNotificationsResult {
  deleted: number;
}

export function deleteNotifications(ids: readonly string[]): Promise<DeleteNotificationsResult> {
  return http.post<DeleteNotificationsResult>('/notifications/delete', { ids: [...ids] });
}

export function describeDeleteError(err: unknown): string {
  if (err instanceof ApiError && err.status === 404) {
    return "La suppression n'est pas encore disponible sur le serveur. Réessayez un peu plus tard.";
  }
  return describeError(err).message;
}
