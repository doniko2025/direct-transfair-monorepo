// packages/shared/src/webhooks.ts
// =========================================================
// WEBHOOKS SORTANTS (lot 17) — contrat de apps/backend/src/webhooks/  (administrateur de société)
//   GET  /webhooks-admin                    points de réception, statistiques 24 h, catalogue d'événements
//   POST /webhooks-admin                    créer (le secret n'est renvoyé qu'ici)       PATCH /webhooks-admin/:id   modifier
//   POST /webhooks-admin/:id/rotate-secret  nouveau secret (renvoyé une fois)            POST /webhooks-admin/:id/test   ping immédiat
//   POST /webhooks-admin/:id/replay-failed  remettre en file les échecs                  DELETE /webhooks-admin/:id
//   GET  /webhooks-admin/deliveries         journal                                      POST /webhooks-admin/deliveries/:id/replay
//
// Côté destinataire : chaque appel est un POST JSON avec les en-têtes
//   X-DirectTransfair-Event · X-DirectTransfair-Delivery · X-DirectTransfair-Signature: t=<horodatage>,v1=<hmac>
// où hmac = HMAC-SHA256(secret, "<horodatage>.<corps brut>") en hexadécimal. Rejetez toute requête dont l'horodatage a plus de 5 minutes.
// =========================================================

import type { HttpClient } from './http';

export type WebhookDeliveryStatus = 'PENDING' | 'RETRYING' | 'SUCCESS' | 'FAILED';

export interface WebhookEventInfo {
  name: string;
  label: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  description: string | null;
  /** Vide = tous les événements. */
  events: string[];
  isActive: boolean;
  maxRetries: number;
  retryDelayMs: number;
  secretHint: string;
  consecutiveFailures: number;
  disabledAt: string | null;
  disabledReason: string | null;
  createdAt: string;
  stats: { success: number; failed: number; pending: number };
}

export interface WebhookList {
  items: WebhookEndpoint[];
  events: WebhookEventInfo[];
  disableAfter: number;
  maxEndpoints: number;
}

export interface WebhookInput {
  url: string;
  events?: string[];
  description?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  statusCode: number | null;
  response: string | null;
  durationMs: number | null;
  nextRetryAt: string | null;
  lastAttemptAt: string | null;
  createdAt: string;
  replayOf: string | null;
  payload: unknown;
}

export interface WebhookAttemptResult {
  ok: boolean;
  statusCode: number | null;
  durationMs: number;
  response: string;
  deliveryId: string;
}

export function createWebhooksApi(http: HttpClient) {
  const id = encodeURIComponent;
  return {
    list: () => http.get<WebhookList>('/webhooks-admin'),
    create: (input: WebhookInput) => http.post<WebhookEndpoint & { secret: string }>('/webhooks-admin', input),
    update: (webhookId: string, input: Partial<WebhookInput> & { isActive?: boolean }) => http.patch<WebhookEndpoint>(`/webhooks-admin/${id(webhookId)}`, input),
    rotateSecret: (webhookId: string) => http.post<WebhookEndpoint & { secret: string }>(`/webhooks-admin/${id(webhookId)}/rotate-secret`, {}),
    test: (webhookId: string) => http.post<WebhookAttemptResult>(`/webhooks-admin/${id(webhookId)}/test`, {}),
    replayFailed: (webhookId: string) => http.post<{ queued: number }>(`/webhooks-admin/${id(webhookId)}/replay-failed`, {}),
    remove: (webhookId: string) => http.delete<{ ok: true }>(`/webhooks-admin/${id(webhookId)}`),
    deliveries: (p: { endpointId?: string; status?: string; take?: number } = {}) => {
      const s = [p.endpointId ? `endpointId=${id(p.endpointId)}` : '', p.status ? `status=${id(p.status)}` : '', p.take ? `take=${p.take}` : ''].filter(Boolean).join('&');
      return http.get<{ items: WebhookDelivery[] }>(`/webhooks-admin/deliveries${s ? `?${s}` : ''}`);
    },
    replay: (deliveryId: string) => http.post<WebhookAttemptResult>(`/webhooks-admin/deliveries/${id(deliveryId)}/replay`, {}),
  };
}
