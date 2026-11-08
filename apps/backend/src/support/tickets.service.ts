// apps/backend/src/support/tickets.service.ts
// =========================================================
// DEMANDES D'ASSISTANCE ET LITIGES (lot 9)
//
// CÔTÉ CLIENT (rôle USER, application mobile) : ouvrir une demande (avec ou sans opération contestée), suivre ses demandes, répondre.
// CÔTÉ SERVICE CLIENT (délégation TICKETS_HANDLE) : file de demandes de la société, prise en charge, réponses (+ notes internes),
//   clôture. Régler un LITIGE (demande liée à une opération) exige en plus DISPUTES_RESOLVE et une décision motivée :
//   ACCEPTED (en faveur du client), REJECTED, INFO (simple réponse). Un litige accepté ne rembourse rien tout seul : le remboursement
//   passe par une demande à double validation (RefundsService).
//
// Règles : un client n'a jamais plus de MAX_OPEN_PER_USER demandes ouvertes ; il ne conteste que ses propres opérations ; il ne voit jamais
// les notes internes ; le support n'agit que sur les demandes de sa société.
// =========================================================

import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTicketDto, ResolveTicketDto, TicketReplyDto } from './dto/tickets.dto';
import { SupportNotifierService } from './support-notifier.service';
import { hasPermission, SUPPORT_NOT_DELEGATED } from './support-permissions';
import { TX_SELECT, transactionView } from './support-desk.service';

export const MAX_OPEN_PER_USER = 5;
const OPEN_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_USER'] as const;

/** Statut après une réponse du service client : on attend le client (une note interne ne change rien). */
export function statusAfterStaffReply(current: string, internal: boolean): string {
  if (internal) return current;
  if (current === 'CLOSED' || current === 'RESOLVED') return current;
  return 'WAITING_USER';
}

/** Statut après une réponse du client : la demande revient dans la file ; un ticket résolu est rouvert, un ticket clos non. */
export function statusAfterClientReply(current: string): string | null {
  if (current === 'CLOSED') return null;
  return current === 'IN_PROGRESS' ? current : 'OPEN';
}

export type TicketSpace = 'client' | 'merchant';
export const parseTicketSpace = (v: unknown): TicketSpace | undefined => (v === 'merchant' || v === 'client' ? v : undefined);

/** Une opération appartient au compte marchand de l'utilisateur (paiement encaissé, retrait, remboursement fait à un client). */
export function isMerchantSideTx(tx: { type?: unknown; senderId?: string | null; recipientId?: string | null }, userId: string): boolean {
  return (
    (tx.type === 'MERCHANT_PAYMENT' && tx.recipientId === userId) ||
    ((tx.type === 'MERCHANT_PAYOUT' || tx.type === 'MERCHANT_REFUND') && tx.senderId === userId)
  );
}

export const isDispute = (t: { transactionId?: string | null }): boolean => !!t.transactionId;

function ticketView(t: any, opts: { staff: boolean }) {
  return {
    id: t.id,
    subject: t.subject,
    message: t.message,
    category: t.category ?? null,
    space: t.space === 'merchant' ? 'merchant' : 'client',
    status: t.status,
    priority: t.priority,
    isDispute: isDispute(t),
    transactionId: t.transactionId ?? null,
    outcome: t.outcome ?? null,
    resolutionNote: t.resolutionNote ?? null,
    resolvedAt: t.resolvedAt ? new Date(t.resolvedAt).toISOString() : null,
    closedAt: t.closedAt ? new Date(t.closedAt).toISOString() : null,
    createdAt: new Date(t.createdAt).toISOString(),
    updatedAt: new Date(t.updatedAt).toISOString(),
    ...(opts.staff
      ? {
          assignedTo: t.assignedTo ?? null,
          user: t.user ? { id: t.user.id, name: `${t.user.firstName ?? ''} ${t.user.lastName ?? ''}`.trim() || t.user.email, email: t.user.email, phone: t.user.phone ?? null } : null,
          repliesCount: t._count?.replies ?? undefined,
        }
      : {}),
  };
}

function replyView(r: any, authors: Map<string, { name: string; role: string }>, viewerId: string) {
  const a = authors.get(r.authorId);
  return {
    id: r.id,
    message: r.message,
    internal: Boolean(r.isInternal),
    createdAt: new Date(r.createdAt).toISOString(),
    fromMe: r.authorId === viewerId,
    author: a ? { name: a.name, isStaff: a.role !== 'USER' } : { name: 'Service client', isStaff: true },
  };
}

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: SupportNotifierService,
  ) {}

  private async audit(user: AuthUserPayload, clientId: number | null, action: 'SUPPORT_TICKET_CREATE' | 'SUPPORT_TICKET_REPLY' | 'SUPPORT_TICKET_RESOLVE', entityId: string, details: Record<string, unknown>) {
    try {
      await this.prisma.auditLog.create({ data: { userId: user.id, clientId, action, entity: 'SupportTicket', entityId, details: details as Prisma.InputJsonValue, successful: true } });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (${action}, ${entityId}) : ${(err as Error).message}`);
    }
  }

  private async authorsOf(ids: string[]): Promise<Map<string, { name: string; role: string }>> {
    const uniq = Array.from(new Set(ids));
    if (!uniq.length) return new Map();
    const rows = await this.prisma.user.findMany({ where: { id: { in: uniq } }, select: { id: true, firstName: true, lastName: true, email: true, role: true } });
    return new Map(rows.map((u) => [u.id, { name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email, role: String(u.role) }]));
  }

  // ═══════════════════════════════════════════════════════
  //  CLIENT
  // ═══════════════════════════════════════════════════════
  async create(user: AuthUserPayload, dto: CreateTicketDto) {
    if (!user.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    let space: TicketSpace = dto.space === 'merchant' ? 'merchant' : 'client';
    // Chaque compte a son propre quota : un commerçant ne perd pas ses demandes « client » en ouvrant une demande « marchand ».
    const open = await this.prisma.supportTicket.count({ where: { userId: user.id, space, status: { in: [...OPEN_STATUSES] } } });
    if (open >= MAX_OPEN_PER_USER) {
      throw new ConflictException(`Vous avez déjà ${MAX_OPEN_PER_USER} demandes en cours. Attendez une réponse avant d'en ouvrir une nouvelle.`);
    }

    let transactionId: string | null = null;
    if (dto.transactionId) {
      const tx = await this.prisma.transaction.findFirst({
        where: { id: dto.transactionId, clientId: user.clientId, OR: [{ senderId: user.id }, { recipientId: user.id }] },
        select: { id: true, type: true, senderId: true, recipientId: true },
      });
      if (!tx) throw new NotFoundException('Opération introuvable.');
      // Une opération du commerce se conteste toujours depuis le compte marchand, quel que soit l'écran d'où part la demande.
      if (isMerchantSideTx(tx, user.id)) space = 'merchant';
      const dup = await this.prisma.supportTicket.count({ where: { userId: user.id, transactionId: tx.id, status: { in: [...OPEN_STATUSES] } } });
      if (dup) throw new ConflictException('Un litige est déjà en cours sur cette opération.');
      transactionId = tx.id;
    }

    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId: user.id,
        clientId: user.clientId,
        subject: dto.subject.trim(),
        message: dto.message.trim(),
        space,
        category: transactionId ? 'transaction' : dto.category ?? 'other',
        priority: transactionId ? 'HIGH' : 'MEDIUM',
        transactionId,
      },
    });
    await this.audit(user, user.clientId, 'SUPPORT_TICKET_CREATE', ticket.id, { dispute: !!transactionId, transactionId });
    // Prévient le service client qui peut traiter (notification + push, sans e-mail).
    await this.notifier.notifyDeciders(
      user.clientId,
      {
        kind: 'STAFF_REFUND_PENDING',
        title: transactionId ? 'Nouveau litige' : 'Nouvelle demande client',
        body: ticket.subject,
        actionUrl: `/support/tickets/${ticket.id}`,
        actionLabel: 'Demandes',
      },
      'TICKETS_HANDLE',
    );
    return ticketView(ticket, { staff: false });
  }

  /** `space` : « client » ou « merchant » ; sans valeur (anciennes versions de l'application) : toutes les demandes, comme avant. */
  async listMine(user: AuthUserPayload, space?: TicketSpace) {
    const rows = await this.prisma.supportTicket.findMany({ where: { userId: user.id, ...(space ? { space } : {}) }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 100 });
    return { items: rows.map((t) => ticketView(t, { staff: false })) };
  }

  async getMine(user: AuthUserPayload, id: string) {
    const t = await this.prisma.supportTicket.findFirst({ where: { id, userId: user.id } });
    if (!t) throw new NotFoundException('Demande introuvable.');
    const replies = await this.prisma.supportTicketReply.findMany({ where: { ticketId: id, isInternal: false }, orderBy: { createdAt: 'asc' }, take: 200 });
    const authors = await this.authorsOf(replies.map((r) => r.authorId));
    return { ticket: ticketView(t, { staff: false }), replies: replies.map((r) => replyView(r, authors, user.id)) };
  }

  async replyMine(user: AuthUserPayload, id: string, dto: TicketReplyDto) {
    const t = await this.prisma.supportTicket.findFirst({ where: { id, userId: user.id } });
    if (!t) throw new NotFoundException('Demande introuvable.');
    const next = statusAfterClientReply(t.status);
    if (next === null) throw new ConflictException('Cette demande est clôturée. Ouvrez-en une nouvelle si besoin.');
    await this.prisma.$transaction([
      this.prisma.supportTicketReply.create({ data: { ticketId: id, authorId: user.id, message: dto.message.trim(), isInternal: false } }),
      this.prisma.supportTicket.update({ where: { id }, data: { status: next as never, resolvedAt: next === 'OPEN' ? null : t.resolvedAt } }),
    ]);
    if (t.clientId) {
      await this.notifier.notifyDeciders(t.clientId, { kind: 'TICKET_REPLY', title: 'Réponse du client', body: t.subject, actionUrl: `/support/tickets/${id}`, actionLabel: 'Demandes' }, 'TICKETS_HANDLE');
    }
    return this.getMine(user, id);
  }

  // ═══════════════════════════════════════════════════════
  //  SERVICE CLIENT
  // ═══════════════════════════════════════════════════════
  private scope(user: AuthUserPayload, requested?: number): Prisma.SupportTicketWhereInput {
    if (user.role === 'SUPER_ADMIN') return requested ? { clientId: requested } : {};
    if (!user.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    return { clientId: user.clientId };
  }

  async list(user: AuthUserPayload, q: { status?: string; kind?: string; search?: string; mine?: boolean; page?: number; limit?: number; clientId?: number }) {
    const page = Math.max(1, Math.floor(q.page ?? 1));
    const limit = Math.min(50, Math.max(1, Math.floor(q.limit ?? 20)));
    const search = q.search?.trim();
    const STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED'];
    const where: Prisma.SupportTicketWhereInput = {
      ...this.scope(user, q.clientId),
      ...(q.status === 'ACTIVE' ? { status: { in: [...OPEN_STATUSES] } } : q.status && STATUSES.includes(q.status) ? { status: q.status as never } : {}),
      ...(q.kind === 'DISPUTE' ? { transactionId: { not: null } } : q.kind === 'REQUEST' ? { transactionId: null } : {}),
      ...(q.mine ? { assignedTo: user.id } : {}),
      ...(search
        ? { OR: [{ subject: { contains: search, mode: 'insensitive' } }, { user: { email: { contains: search, mode: 'insensitive' } } }, { user: { lastName: { contains: search, mode: 'insensitive' } } }] }
        : {}),
    };
    const [total, rows, counts] = await Promise.all([
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.findMany({
        where,
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } }, _count: { select: { replies: true } } },
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.supportTicket.groupBy({ by: ['status'], where: this.scope(user, q.clientId), _count: { _all: true } }),
    ]);
    const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
    return { page, limit, total, byStatus, items: rows.map((t) => ticketView(t, { staff: true })) };
  }

  private async loadScoped(user: AuthUserPayload, id: string) {
    const t = await this.prisma.supportTicket.findFirst({
      where: { id, ...this.scope(user) },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
    });
    if (!t) throw new NotFoundException('Demande introuvable.');
    return t;
  }

  async detail(user: AuthUserPayload, id: string) {
    const t = await this.loadScoped(user, id);
    const replies = await this.prisma.supportTicketReply.findMany({ where: { ticketId: id }, orderBy: { createdAt: 'asc' }, take: 300 });
    const authors = await this.authorsOf(replies.map((r) => r.authorId));
    const tx =
      t.transactionId && hasPermission(user, 'TRANSACTIONS_VIEW')
        ? await this.prisma.transaction.findFirst({ where: { id: t.transactionId, clientId: t.clientId ?? undefined }, select: TX_SELECT })
        : null;
    const refunds = t.transactionId ? await this.prisma.refundRequest.findMany({ where: { ticketId: id }, orderBy: { createdAt: 'desc' }, take: 5 }) : [];
    return {
      ticket: ticketView(t, { staff: true }),
      replies: replies.map((r) => replyView(r, authors, user.id)),
      transaction: tx ? transactionView(tx) : null,
      refundRequests: refunds.map((r) => ({ id: r.id, status: r.status, amount: Number(r.amount), currency: r.currency, createdAt: r.createdAt.toISOString() })),
    };
  }

  async takeOver(user: AuthUserPayload, id: string) {
    const t = await this.loadScoped(user, id);
    if (t.status === 'CLOSED' || t.status === 'RESOLVED') throw new ConflictException('Cette demande est déjà traitée.');
    await this.prisma.supportTicket.update({ where: { id }, data: { assignedTo: user.id, status: 'IN_PROGRESS' } });
    return this.detail(user, id);
  }

  async reply(user: AuthUserPayload, id: string, dto: TicketReplyDto) {
    const t = await this.loadScoped(user, id);
    if (t.status === 'CLOSED') throw new ConflictException('Cette demande est clôturée.');
    const internal = dto.internal === true;
    const next = statusAfterStaffReply(t.status, internal);
    await this.prisma.$transaction([
      this.prisma.supportTicketReply.create({ data: { ticketId: id, authorId: user.id, message: dto.message.trim(), isInternal: internal } }),
      this.prisma.supportTicket.update({ where: { id }, data: { status: next as never, assignedTo: t.assignedTo ?? user.id } }),
    ]);
    await this.audit(user, t.clientId, 'SUPPORT_TICKET_REPLY', id, { internal });
    if (!internal && t.user) {
      await this.notifier.notifyUser(t.user, {
        kind: 'TICKET_REPLY',
        title: 'Réponse à votre demande',
        body: `${t.subject} — le service client vous a répondu.`,
        actionUrl: `/support/${id}`,
        actionLabel: 'Aide',
      });
    }
    return this.detail(user, id);
  }

  /** Règle un litige (ou clôt une demande avec une décision). Un litige exige DISPUTES_RESOLVE. */
  async resolve(user: AuthUserPayload, id: string, dto: ResolveTicketDto) {
    const t = await this.loadScoped(user, id);
    if (t.status === 'CLOSED' || t.status === 'RESOLVED') throw new ConflictException('Cette demande est déjà traitée.');
    if (isDispute(t) && !hasPermission(user, 'DISPUTES_RESOLVE')) throw new ForbiddenException(SUPPORT_NOT_DELEGATED);
    if (!isDispute(t) && dto.outcome !== 'INFO') throw new BadRequestException("Une demande sans opération se clôture avec la décision « INFO ».");

    await this.prisma.$transaction([
      this.prisma.supportTicketReply.create({ data: { ticketId: id, authorId: user.id, message: dto.note.trim(), isInternal: false } }),
      this.prisma.supportTicket.update({
        where: { id },
        data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedById: user.id, outcome: dto.outcome, resolutionNote: dto.note.trim(), assignedTo: t.assignedTo ?? user.id },
      }),
    ]);
    await this.audit(user, t.clientId, 'SUPPORT_TICKET_RESOLVE', id, { outcome: dto.outcome, dispute: isDispute(t), transactionId: t.transactionId });
    if (t.user) {
      const text = dto.outcome === 'ACCEPTED' ? 'Votre litige a été accepté.' : dto.outcome === 'REJECTED' ? "Votre litige n'a pas pu être accepté." : 'Votre demande a été traitée.';
      await this.notifier.notifyUser(t.user, {
        kind: 'TICKET_RESOLVED',
        type: dto.outcome === 'ACCEPTED' ? 'SUCCESS' : 'INFO',
        title: isDispute(t) ? 'Décision sur votre litige' : 'Demande traitée',
        body: `${text}\n${dto.note.trim()}`,
        actionUrl: `/support/${id}`,
        actionLabel: 'Aide',
      });
    }
    return this.detail(user, id);
  }

  async close(user: AuthUserPayload, id: string) {
    const t = await this.loadScoped(user, id);
    if (t.status === 'CLOSED') return this.detail(user, id);
    if (isDispute(t) && t.status !== 'RESOLVED') throw new ConflictException('Un litige se règle (décision motivée) avant d\'être clos.');
    await this.prisma.supportTicket.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date() } });
    await this.audit(user, t.clientId, 'SUPPORT_TICKET_RESOLVE', id, { closed: true });
    return this.detail(user, id);
  }
}
