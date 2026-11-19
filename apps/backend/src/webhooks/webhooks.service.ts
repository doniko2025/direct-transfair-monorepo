// apps/backend/src/webhooks/webhooks.service.ts
// =========================================================
// WEBHOOKS — API administrateur de société (lot 17)
//   points de réception (créer, modifier, régénérer le secret, supprimer, tester) · journal des envois · rejeu (un envoi ou tous les échecs)
// Le secret n'est montré qu'à la création et à la régénération. Cloisonné par société ; chaque changement est tracé au journal d'audit.
// =========================================================

import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, WebhookStatus } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import { PING_EVENT, WEBHOOK_EVENTS, WEBHOOK_EVENT_NAMES } from './webhook-events';
import { generateWebhookSecret, maskSecret, validateWebhookUrl } from './webhook-security';
import { attemptDelivery, checkResolvedHost, disableAfter } from './webhooks.delivery';
import type { CreateWebhookDto, UpdateWebhookDto } from './dto/webhooks.dto';

const MAX_ENDPOINTS = 10;
const allowHttp = (): boolean => String(process.env.WEBHOOK_ALLOW_HTTP ?? '').toLowerCase() === 'true';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  private companyOf(user: AuthUserPayload): number {
    if (!user.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    return user.clientId;
  }

  private async audit(user: AuthUserPayload, clientId: number, entityId: string, details: Record<string, unknown>) {
    try {
      await this.prisma.auditLog.create({ data: { userId: user.id, clientId, action: 'WEBHOOK_CHANGE', entity: 'WebhookEndpoint', entityId, details: details as Prisma.InputJsonValue, successful: true } });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (webhook ${entityId}) : ${(err as Error).message}`);
    }
  }

  private checkEvents(events?: string[]): string[] {
    const list = Array.from(new Set(events ?? []));
    const bad = list.filter((e) => e !== '*' && !WEBHOOK_EVENT_NAMES.includes(e));
    if (bad.length) throw new BadRequestException(`Événement inconnu : ${bad.join(', ')}.`);
    return list.includes('*') ? [] : list;
  }

  private checkUrl(url: string): string {
    const err = validateWebhookUrl(url, { allowHttp: allowHttp() });
    if (err) throw new BadRequestException(err);
    return new URL(url.trim()).toString();
  }

  private shape(ep: Prisma.WebhookEndpointGetPayload<object>, stats?: { success: number; failed: number; pending: number }) {
    return {
      id: ep.id, url: ep.url, description: ep.description, events: ep.events, isActive: ep.isActive,
      maxRetries: ep.maxRetries, retryDelayMs: ep.retryDelayMs, secretHint: maskSecret(ep.secret),
      consecutiveFailures: ep.consecutiveFailures, disabledAt: ep.disabledAt, disabledReason: ep.disabledReason,
      createdAt: ep.createdAt,
      stats: stats ?? { success: 0, failed: 0, pending: 0 },
    };
  }

  catalog() {
    return { events: WEBHOOK_EVENTS, disableAfter: disableAfter(), maxEndpoints: MAX_ENDPOINTS };
  }

  async list(user: AuthUserPayload) {
    const clientId = this.companyOf(user);
    const endpoints = await this.prisma.webhookEndpoint.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } });
    const since = new Date(Date.now() - 24 * 3_600_000);
    const rows = endpoints.length
      ? await this.prisma.webhookDelivery.groupBy({ by: ['endpointId', 'status'], where: { endpointId: { in: endpoints.map((e) => e.id) }, createdAt: { gte: since } }, _count: { _all: true } })
      : [];
    const stat = (id: string) => {
      const n = (s: WebhookStatus[]) => rows.filter((r) => r.endpointId === id && s.includes(r.status)).reduce((a, r) => a + r._count._all, 0);
      return { success: n([WebhookStatus.SUCCESS]), failed: n([WebhookStatus.FAILED]), pending: n([WebhookStatus.PENDING, WebhookStatus.RETRYING]) };
    };
    return { items: endpoints.map((e) => this.shape(e, stat(e.id))), ...this.catalog() };
  }

  private async ownEndpoint(clientId: number, id: string) {
    const ep = await this.prisma.webhookEndpoint.findFirst({ where: { id, clientId } });
    if (!ep) throw new NotFoundException('Point de réception introuvable.');
    return ep;
  }

  async create(user: AuthUserPayload, dto: CreateWebhookDto) {
    const clientId = this.companyOf(user);
    const url = this.checkUrl(dto.url);
    const events = this.checkEvents(dto.events);
    if ((await this.prisma.webhookEndpoint.count({ where: { clientId } })) >= MAX_ENDPOINTS) {
      throw new ConflictException(`Limite atteinte : ${MAX_ENDPOINTS} points de réception au plus.`);
    }
    const secret = generateWebhookSecret();
    const ep = await this.prisma.webhookEndpoint.create({
      data: {
        clientId, url, secret, events, description: dto.description?.trim() || null,
        maxRetries: dto.maxRetries ?? 3, retryDelayMs: dto.retryDelayMs ?? 5000,
        scanCursor: new Date(), // seuls les changements À VENIR sont envoyés (pas tout l'historique)
      },
    });
    await this.audit(user, clientId, ep.id, { op: 'CREATE', host: new URL(url).host, events });
    // Le secret est renvoyé UNE SEULE FOIS.
    return { ...this.shape(ep), secret };
  }

  async update(user: AuthUserPayload, id: string, dto: UpdateWebhookDto) {
    const clientId = this.companyOf(user);
    const ep = await this.ownEndpoint(clientId, id);
    const data: Prisma.WebhookEndpointUpdateInput = {};
    if (dto.url !== undefined) data.url = this.checkUrl(dto.url);
    if (dto.events !== undefined) data.events = this.checkEvents(dto.events);
    if (dto.description !== undefined) data.description = dto.description.trim() || null;
    if (dto.maxRetries !== undefined) data.maxRetries = dto.maxRetries;
    if (dto.retryDelayMs !== undefined) data.retryDelayMs = dto.retryDelayMs;
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
      if (dto.isActive && !ep.isActive) {
        data.consecutiveFailures = 0;
        data.disabledAt = null;
        data.disabledReason = null;
        // Après une désactivation AUTOMATIQUE, les changements survenus entre-temps sont repris (le curseur est conservé) ;
        // après une désactivation voulue, on repart de maintenant : pas de rafale d'anciens événements.
        if (!ep.disabledAt) data.scanCursor = new Date();
      }
    }
    const updated = await this.prisma.webhookEndpoint.update({ where: { id }, data });
    await this.audit(user, clientId, id, { op: 'UPDATE', fields: Object.keys(dto) });
    return this.shape(updated);
  }

  async rotateSecret(user: AuthUserPayload, id: string) {
    const clientId = this.companyOf(user);
    await this.ownEndpoint(clientId, id);
    const secret = generateWebhookSecret();
    const ep = await this.prisma.webhookEndpoint.update({ where: { id }, data: { secret } });
    await this.audit(user, clientId, id, { op: 'ROTATE_SECRET' });
    return { ...this.shape(ep), secret };
  }

  async remove(user: AuthUserPayload, id: string) {
    const clientId = this.companyOf(user);
    const ep = await this.ownEndpoint(clientId, id);
    await this.prisma.webhookEndpoint.delete({ where: { id } });
    await this.audit(user, clientId, id, { op: 'DELETE', host: new URL(ep.url).host });
    return { ok: true };
  }

  /** Envoie un événement « ping » tout de suite et renvoie le résultat (même si le point de réception est désactivé). */
  async test(user: AuthUserPayload, id: string) {
    const clientId = this.companyOf(user);
    const ep = await this.ownEndpoint(clientId, id);
    const blocked = await checkResolvedHost(ep.url);
    if (blocked) throw new BadRequestException(blocked);
    const d = await this.prisma.webhookDelivery.create({
      data: { endpointId: ep.id, event: PING_EVENT, status: WebhookStatus.PENDING, payload: { event: PING_EVENT, createdAt: new Date().toISOString(), data: { message: 'Test de votre point de réception Direct Transf’air.' } } },
    });
    const out = await attemptDelivery(this.prisma, d.id, { manual: true });
    // Un test n'est pas rejoué : s'il échoue, il reste simplement dans le journal.
    if (out.status === WebhookStatus.RETRYING) await this.prisma.webhookDelivery.update({ where: { id: d.id }, data: { status: WebhookStatus.FAILED, nextRetryAt: null } }).catch(() => undefined);
    return { ok: !!out.result?.ok, statusCode: out.result?.statusCode ?? null, durationMs: out.result?.durationMs ?? 0, response: out.result?.response ?? '', deliveryId: d.id };
  }

  async deliveries(user: AuthUserPayload, q: { endpointId?: string; status?: string; take?: number }) {
    const clientId = this.companyOf(user);
    const where: Prisma.WebhookDeliveryWhereInput = { endpoint: { clientId } };
    if (q.endpointId) where.endpointId = q.endpointId;
    if (q.status && (Object.values(WebhookStatus) as string[]).includes(q.status)) where.status = q.status as WebhookStatus;
    const items = await this.prisma.webhookDelivery.findMany({
      where, orderBy: { createdAt: 'desc' }, take: Math.min(Math.max(q.take ?? 50, 1), 200),
      select: { id: true, endpointId: true, event: true, status: true, attempts: true, statusCode: true, response: true, durationMs: true, nextRetryAt: true, lastAttemptAt: true, createdAt: true, replayOf: true, payload: true },
    });
    return { items };
  }

  /** Rejoue un envoi (réussi ou non) : un NOUVEL envoi est créé et tenté tout de suite ; l'original reste dans le journal. */
  async replay(user: AuthUserPayload, deliveryId: string) {
    const clientId = this.companyOf(user);
    const d = await this.prisma.webhookDelivery.findFirst({ where: { id: deliveryId, endpoint: { clientId } }, include: { endpoint: true } });
    if (!d) throw new NotFoundException('Envoi introuvable.');
    const fresh = await this.prisma.webhookDelivery.create({
      data: { endpointId: d.endpointId, event: d.event, payload: d.payload as Prisma.InputJsonValue, status: WebhookStatus.PENDING, replayOf: d.id },
    });
    const out = await attemptDelivery(this.prisma, fresh.id, { manual: true });
    await this.audit(user, clientId, d.endpointId, { op: 'REPLAY', deliveryId: d.id, newDeliveryId: fresh.id, ok: !!out.result?.ok });
    return { ok: !!out.result?.ok, statusCode: out.result?.statusCode ?? null, durationMs: out.result?.durationMs ?? 0, response: out.result?.response ?? '', deliveryId: fresh.id };
  }

  /** Remet en file tous les envois en échec d'un point de réception (jusqu'à 100) : le moteur les envoie à la prochaine minute. */
  async replayFailed(user: AuthUserPayload, endpointId: string) {
    const clientId = this.companyOf(user);
    await this.ownEndpoint(clientId, endpointId);
    const failed = await this.prisma.webhookDelivery.findMany({
      where: { endpointId, status: WebhookStatus.FAILED, event: { not: PING_EVENT } }, orderBy: { createdAt: 'asc' }, take: 100,
      select: { id: true, event: true, payload: true },
    });
    // Un échec déjà remis en file (replayOf) n'est pas remis une seconde fois.
    const already = failed.length
      ? new Set((await this.prisma.webhookDelivery.findMany({ where: { endpointId, replayOf: { in: failed.map((f) => f.id) } }, select: { replayOf: true } })).map((r) => r.replayOf))
      : new Set<string | null>();
    const todo = failed.filter((f) => !already.has(f.id));
    if (!todo.length) return { queued: 0 };
    await this.prisma.webhookDelivery.createMany({
      data: todo.map((f) => ({ endpointId, event: f.event, payload: f.payload as Prisma.InputJsonValue, status: WebhookStatus.PENDING, replayOf: f.id })),
    });
    await this.audit(user, clientId, endpointId, { op: 'REPLAY_FAILED', count: todo.length });
    return { queued: todo.length };
  }
}
