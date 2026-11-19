// apps/backend/src/webhooks/webhooks.delivery.ts
// =========================================================
// MOTEUR D'ENVOI DES WEBHOOKS (lot 17)
//   scan()    : relève les transactions modifiées depuis le curseur de chaque point de réception et enfile un envoi par changement d'état
//               (clé unique endpoint + transaction + statut → jamais de doublon, même si la relève est relancée) ;
//   flush()   : envoie les envois dus (PENDING / RETRYING), en réservant chaque envoi AVANT l'appel (deux instances ne l'envoient pas deux fois) ;
//   attempt() : un appel signé, délai maximal 8 s, AUCUNE redirection suivie, adresse re-vérifiée après résolution DNS (anti-SSRF).
// Reprise : délai croissant (base × 2^n, plafonné à 6 h) jusqu'à maxRetries ; au-delà, l'envoi est en échec et peut être REJOUÉ à la main.
// Un point de réception qui échoue 20 fois de suite est désactivé automatiquement (alerte + notification des administrateurs).
// =========================================================

import { Logger } from '@nestjs/common';
import { AlertSeverity, Prisma, Role, WebhookStatus } from '@prisma/client';
import { lookup } from 'node:dns/promises';

import { PrismaService } from '../prisma/prisma.service';
import { buildTransactionPayload, eventForStatus, eventKeyFor, isSubscribed } from './webhook-events';
import { backoffMs, isPrivateIp, signPayload, validateWebhookUrl } from './webhook-security';

const logger = new Logger('WebhooksDelivery');

export const REQUEST_TIMEOUT_MS = 8_000;
export const LEASE_MS = 2 * 60_000;
export const SCAN_BATCH = 300;
export const FLUSH_BATCH = 60;
export const MAX_RESPONSE_CHARS = 500;

export const disableAfter = (): number => {
  const n = Number(process.env.WEBHOOK_DISABLE_AFTER);
  return Number.isInteger(n) && n >= 3 ? n : 20;
};
const allowHttp = (): boolean => String(process.env.WEBHOOK_ALLOW_HTTP ?? '').toLowerCase() === 'true';

const isUnique = (e: unknown): boolean => (e as { code?: string })?.code === 'P2002';

type Endpoint = Prisma.WebhookEndpointGetPayload<object>;

// ── Relève ────────────────────────────────────────────────

/** Enfile les envois dus par les changements d'état de transactions. Renvoie le nombre d'envois créés. */
export async function scanTransactions(prisma: PrismaService): Promise<number> {
  const endpoints = await prisma.webhookEndpoint.findMany({ where: { isActive: true, disabledAt: null } });
  let created = 0;
  for (const ep of endpoints) {
    if (ep.events.length && !ep.events.some((e) => e === '*' || e.startsWith('transaction.'))) continue;
    try {
      const since = ep.scanCursor ?? ep.createdAt;
      const txs = await prisma.transaction.findMany({
        where: { clientId: ep.clientId, updatedAt: { gte: since }, deletedAt: null },
        orderBy: { updatedAt: 'asc' },
        take: SCAN_BATCH,
        select: { id: true, reference: true, type: true, status: true, amount: true, fees: true, total: true, currency: true, targetCurrency: true, receivedAmount: true, payoutMethod: true, createdAt: true, paidAt: true, cancelledAt: true, updatedAt: true },
      });
      let cursor = since;
      for (const tx of txs) {
        if (tx.updatedAt > cursor) cursor = tx.updatedAt;
        const event = eventForStatus(String(tx.status));
        if (!event || !isSubscribed(ep.events, event)) continue;
        try {
          await prisma.webhookDelivery.create({
            data: {
              endpointId: ep.id, event, status: WebhookStatus.PENDING, eventKey: eventKeyFor(tx.id, String(tx.status)),
              payload: buildTransactionPayload(event, tx) as unknown as Prisma.InputJsonValue,
            },
          });
          created++;
        } catch (e) {
          if (!isUnique(e)) throw e; // déjà enfilé : normal
        }
      }
      if (cursor > since) await prisma.webhookEndpoint.update({ where: { id: ep.id }, data: { scanCursor: cursor } });
    } catch (err) {
      logger.error(`Relève impossible (point de réception ${ep.id}) : ${(err as Error).message}`);
    }
  }
  return created;
}

// ── Envoi ─────────────────────────────────────────────────

export interface AttemptResult {
  ok: boolean;
  statusCode: number | null;
  durationMs: number;
  response: string;
}

/** Vérifie, APRÈS résolution DNS, qu'aucune adresse n'est privée. Renvoie un message d'erreur ou null. */
export async function checkResolvedHost(url: string): Promise<string | null> {
  const syntax = validateWebhookUrl(url, { allowHttp: allowHttp() });
  if (syntax) return syntax;
  const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
  try {
    const addrs = await lookup(host, { all: true });
    if (!addrs.length) return 'Nom de domaine introuvable.';
    if (addrs.some((a) => isPrivateIp(a.address))) return 'Le nom de domaine pointe vers une adresse interne : envoi refusé.';
    return null;
  } catch {
    return 'Nom de domaine introuvable.';
  }
}

export async function sendOnce(ep: Pick<Endpoint, 'url' | 'secret'>, deliveryId: string, event: string, payload: unknown): Promise<AttemptResult> {
  const started = Date.now();
  const blocked = await checkResolvedHost(ep.url);
  if (blocked) return { ok: false, statusCode: null, durationMs: Date.now() - started, response: blocked };

  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(ep.url, {
      method: 'POST',
      redirect: 'manual', // une redirection pourrait mener vers une adresse interne : jamais suivie
      signal: ctl.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DirectTransfair-Webhooks/1.0',
        'X-DirectTransfair-Event': event,
        'X-DirectTransfair-Delivery': deliveryId,
        'X-DirectTransfair-Signature': signPayload(ep.secret, ts, body),
      },
      body,
    });
    let text = '';
    try { text = (await res.text()).slice(0, MAX_RESPONSE_CHARS); } catch { /* corps illisible : sans importance */ }
    return { ok: res.status >= 200 && res.status < 300, statusCode: res.status, durationMs: Date.now() - started, response: text };
  } catch (err) {
    const aborted = (err as Error)?.name === 'AbortError';
    return { ok: false, statusCode: null, durationMs: Date.now() - started, response: aborted ? `Délai dépassé (${REQUEST_TIMEOUT_MS / 1000} s)` : `Connexion impossible : ${(err as Error)?.message ?? 'erreur'}`.slice(0, MAX_RESPONSE_CHARS) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tente un envoi et enregistre le résultat. L'envoi est RÉSERVÉ avant l'appel (bail de 2 minutes) : si l'appel plante ou si
 * l'instance s'arrête, l'envoi redevient dû au bout du bail au lieu d'être perdu ou envoyé deux fois.
 */
export async function attemptDelivery(prisma: PrismaService, deliveryId: string, opts: { manual?: boolean } = {}): Promise<{ ran: boolean; result?: AttemptResult; status?: WebhookStatus }> {
  const d = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId }, include: { endpoint: true } });
  if (!d) return { ran: false };
  if (d.status === WebhookStatus.SUCCESS) return { ran: false };
  if (!opts.manual && !d.endpoint.isActive) return { ran: false };

  const now = new Date();
  const claimed = await prisma.webhookDelivery.updateMany({
    where: { id: d.id, status: d.status, attempts: d.attempts, OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] },
    data: { lastAttemptAt: now, nextRetryAt: new Date(now.getTime() + LEASE_MS) },
  });
  if (claimed.count !== 1) return { ran: false };

  const result = await sendOnce(d.endpoint, d.id, d.event, d.payload);
  const attempts = d.attempts + 1;
  const maxAttempts = d.endpoint.maxRetries + 1;

  if (result.ok) {
    await prisma.webhookDelivery.update({
      where: { id: d.id },
      data: { status: WebhookStatus.SUCCESS, attempts, statusCode: result.statusCode, response: result.response, durationMs: result.durationMs, nextRetryAt: null, lastAttemptAt: new Date() },
    });
    if (d.endpoint.consecutiveFailures > 0) await prisma.webhookEndpoint.update({ where: { id: d.endpointId }, data: { consecutiveFailures: 0 } }).catch(() => undefined);
    return { ran: true, result, status: WebhookStatus.SUCCESS };
  }

  const exhausted = attempts >= maxAttempts;
  const status = exhausted ? WebhookStatus.FAILED : WebhookStatus.RETRYING;
  await prisma.webhookDelivery.update({
    where: { id: d.id },
    data: {
      status, attempts, statusCode: result.statusCode, response: result.response, durationMs: result.durationMs, lastAttemptAt: new Date(),
      nextRetryAt: exhausted ? null : new Date(Date.now() + backoffMs(attempts, d.endpoint.retryDelayMs)),
    },
  });

  const failures = d.endpoint.consecutiveFailures + 1;
  await prisma.webhookEndpoint.update({ where: { id: d.endpointId }, data: { consecutiveFailures: failures } }).catch(() => undefined);
  if (failures >= disableAfter() && d.endpoint.isActive) await disableEndpoint(prisma, d.endpoint, `${failures} échecs consécutifs`);
  return { ran: true, result, status };
}

async function disableEndpoint(prisma: PrismaService, ep: Endpoint, reason: string): Promise<void> {
  try {
    const off = await prisma.webhookEndpoint.updateMany({ where: { id: ep.id, isActive: true }, data: { isActive: false, disabledAt: new Date(), disabledReason: reason } });
    if (off.count !== 1) return;
    const title = 'Webhook désactivé';
    const message = `Le point de réception ${new URL(ep.url).host} a été désactivé après ${reason}. Corrigez-le puis réactivez-le : les envois en attente seront repris.`;
    await prisma.alert.create({ data: { clientId: ep.clientId, type: 'WEBHOOK_FAILING', severity: AlertSeverity.HIGH, title, message, metadata: { endpointId: ep.id } as Prisma.InputJsonValue } });
    const admins = await prisma.user.findMany({ where: { clientId: ep.clientId, role: Role.COMPANY_ADMIN, isActive: true, deletedAt: null }, select: { id: true } });
    await Promise.all(admins.map((a) => prisma.notification.create({ data: { userId: a.id, title: `⚠️ ${title}`, message, type: 'WARNING', metadata: { kind: 'WEBHOOK_FAILING', endpointId: ep.id } as Prisma.InputJsonValue } }).catch(() => undefined)));
    logger.warn(`Webhook ${ep.id} désactivé : ${reason}`);
  } catch (err) {
    logger.error(`Désactivation du webhook ${ep.id} incomplète : ${(err as Error).message}`);
  }
}

/** Envoie les envois dus. Renvoie le nombre d'appels effectués. */
export async function flushDue(prisma: PrismaService): Promise<number> {
  const now = new Date();
  const due = await prisma.webhookDelivery.findMany({
    where: {
      status: { in: [WebhookStatus.PENDING, WebhookStatus.RETRYING] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      endpoint: { isActive: true, disabledAt: null },
    },
    orderBy: { createdAt: 'asc' },
    take: FLUSH_BATCH,
    select: { id: true },
  });
  let ran = 0;
  // Un point de réception lent ne doit pas retarder les autres : appels en parallèle par lots de 8.
  for (let i = 0; i < due.length; i += 8) {
    const out = await Promise.all(due.slice(i, i + 8).map((d) => attemptDelivery(prisma, d.id).catch((err) => { logger.error(`Envoi ${d.id} : ${(err as Error).message}`); return { ran: false }; })));
    ran += out.filter((o) => o.ran).length;
  }
  return ran;
}
