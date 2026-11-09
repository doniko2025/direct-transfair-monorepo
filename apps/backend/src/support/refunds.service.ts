// apps/backend/src/support/refunds.service.ts
// =========================================================
// REMBOURSEMENTS EN ATTENTE (lot 9) — demande → décision par une AUTRE personne → exécution atomique.
//
//   • Demande : un envoi (TRANSFER / SCHEDULED) encore non payé de la société, un motif, au plus une demande en attente par envoi.
//   • Décision (délégation REFUNDS_DECIDE) : un compte du service client ne décide JAMAIS sa propre demande (séparation des tâches).
//     L'administrateur de société peut décider toute demande : il détient déjà ce pouvoir (annulation avec remboursement), l'interdire
//     bloquerait les petites équipes sans protéger l'argent.
//   • Exécution : TransactionsService.refundOnSupportDecision (annulation + crédit du wallet débité dans la même transaction SQL).
//     Si l'envoi a été payé / clos entre-temps : la demande passe en FAILED (« à traiter hors plateforme ») — aucun argent ne bouge.
//   • La décision est « réservée » par un updateMany conditionné à PENDING : deux décideurs simultanés ne remboursent jamais deux fois.
// =========================================================

import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import type { CreateRefundRequestDto, DecideRefundDto } from './dto/refunds.dto';
import { SupportNotifierService } from './support-notifier.service';

export const REFUNDABLE = ['TRANSFER', 'SCHEDULED'];
export const REFUNDABLE_STATUSES = ['PENDING', 'VALIDATED', 'PROCESSING'];

/** Règle des quatre yeux : le service client ne décide pas sa propre demande ; l'administrateur de société le peut. */
export function canDecideOwn(role: string | undefined | null): boolean {
  return role === 'COMPANY_ADMIN' || role === 'SUPER_ADMIN';
}

function view(r: any, extra: Record<string, unknown> = {}) {
  return {
    id: r.id,
    transactionId: r.transactionId,
    ticketId: r.ticketId ?? null,
    amount: Number(r.amount),
    currency: r.currency,
    reason: r.reason,
    status: r.status,
    requestedById: r.requestedById,
    decidedById: r.decidedById ?? null,
    decisionNote: r.decisionNote ?? null,
    decidedAt: r.decidedAt ? new Date(r.decidedAt).toISOString() : null,
    createdAt: new Date(r.createdAt).toISOString(),
    ...extra,
  };
}

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionsService,
    private readonly notifier: SupportNotifierService,
  ) {}

  private companyOf(user: AuthUserPayload): number {
    if (!user.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    return user.clientId;
  }

  private async audit(user: AuthUserPayload, clientId: number, action: 'REFUND_REQUEST' | 'REFUND_DECIDE', entityId: string, details: Record<string, unknown>) {
    try {
      await this.prisma.auditLog.create({ data: { userId: user.id, clientId, action, entity: 'RefundRequest', entityId, details: details as Prisma.InputJsonValue, successful: true } });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (${action}, ${entityId}) : ${(err as Error).message}`);
    }
  }

  async create(user: AuthUserPayload, dto: CreateRefundRequestDto) {
    const clientId = this.companyOf(user);
    const tx = await this.prisma.transaction.findFirst({
      where: { id: dto.transactionId, clientId },
      select: { id: true, reference: true, type: true, status: true, total: true, currency: true, amount: true, fees: true, payoutMethod: true, recipientId: true, paidAt: true, createdAt: true },
    });
    if (!tx) throw new NotFoundException('Opération introuvable.');
    if (!REFUNDABLE.includes(tx.type)) throw new ConflictException('Ce type d\'opération ne se rembourse pas depuis la plateforme.');
    // Montant à rendre : le total payé pour une opération en cours ; pour un envoi wallet déjà PAYÉ, le rappel
    // (réglage de la société) reprend la somme au bénéficiaire et rend montant (+ frais selon le réglage).
    let refundAmount = Number(tx.total);
    if (tx.status === 'PAID') {
      const recall = await this.transactions.assessRecallFor(clientId, tx as any);
      if (!recall.ok) throw new ConflictException(recall.reason);
      refundAmount = recall.refundAmount;
    } else if (!REFUNDABLE_STATUSES.includes(tx.status)) {
      throw new ConflictException(`Cette opération est déjà « ${tx.status} » : rien à rembourser.`);
    }
    if (await this.prisma.refundRequest.count({ where: { transactionId: tx.id, status: 'PENDING' } })) {
      throw new ConflictException('Une demande de remboursement est déjà en attente pour cette opération.');
    }
    if (dto.ticketId) {
      const ticket = await this.prisma.supportTicket.findFirst({ where: { id: dto.ticketId, clientId }, select: { id: true } });
      if (!ticket) throw new NotFoundException('Demande d\'assistance introuvable.');
    }

    const created = await this.prisma.refundRequest.create({
      data: {
        clientId,
        transactionId: tx.id,
        ticketId: dto.ticketId ?? null,
        amount: refundAmount,
        currency: tx.currency,
        reason: dto.reason.trim(),
        requestedById: user.id,
      },
    });
    await this.audit(user, clientId, 'REFUND_REQUEST', created.id, { transactionId: tx.id, reference: tx.reference, amount: refundAmount, currency: tx.currency, ...(tx.status === 'PAID' ? { recall: true } : {}) });
    await this.notifier.notifyDeciders(
      clientId,
      {
        kind: 'STAFF_REFUND_PENDING',
        type: 'WARNING',
        title: 'Remboursement à valider',
        body: `${tx.reference} — ${refundAmount} ${tx.currency}${tx.status === 'PAID' ? ' (rappel d\'un envoi déjà crédité)' : ''}`,
        actionUrl: '/support/refunds',
        actionLabel: 'Remboursements',
      },
      'REFUNDS_DECIDE',
      user.id,
    );
    return view(created, { reference: tx.reference });
  }

  async list(user: AuthUserPayload, q: { status?: string; page?: number; limit?: number; clientId?: number }) {
    const page = Math.max(1, Math.floor(q.page ?? 1));
    const limit = Math.min(50, Math.max(1, Math.floor(q.limit ?? 20)));
    const clientId = user.role === 'SUPER_ADMIN' ? q.clientId : this.companyOf(user);
    const where: Prisma.RefundRequestWhereInput = {
      ...(clientId ? { clientId } : {}),
      ...(q.status && ['PENDING', 'APPROVED', 'REJECTED', 'FAILED'].includes(q.status) ? { status: q.status as never } : {}),
    };
    const [total, rows, pending] = await Promise.all([
      this.prisma.refundRequest.count({ where }),
      this.prisma.refundRequest.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
      this.prisma.refundRequest.count({ where: { ...(clientId ? { clientId } : {}), status: 'PENDING' } }),
    ]);
    const txs = await this.prisma.transaction.findMany({
      where: { id: { in: rows.map((r) => r.transactionId) } },
      select: { id: true, reference: true, status: true, sender: { select: { firstName: true, lastName: true, email: true } } },
    });
    const byId = new Map(txs.map((t) => [t.id, t]));
    const people = await this.prisma.user.findMany({
      where: { id: { in: Array.from(new Set(rows.flatMap((r) => [r.requestedById, r.decidedById].filter(Boolean) as string[]))) } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const name = new Map(people.map((p) => [p.id, `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || p.email]));
    return {
      page,
      limit,
      total,
      pending,
      items: rows.map((r) => {
        const t = byId.get(r.transactionId);
        return view(r, {
          reference: t?.reference ?? null,
          transactionStatus: t?.status ?? null,
          customer: t?.sender ? `${t.sender.firstName ?? ''} ${t.sender.lastName ?? ''}`.trim() || t.sender.email : null,
          requestedBy: name.get(r.requestedById) ?? null,
          decidedBy: r.decidedById ? name.get(r.decidedById) ?? null : null,
          canDecide: r.status === 'PENDING' && (canDecideOwn(user.role) || r.requestedById !== user.id),
        });
      }),
    };
  }

  async decide(user: AuthUserPayload, id: string, dto: DecideRefundDto) {
    const clientId = this.companyOf(user);
    const req = await this.prisma.refundRequest.findFirst({ where: { id, clientId } });
    if (!req) throw new NotFoundException('Demande de remboursement introuvable.');
    if (req.status !== 'PENDING') throw new ConflictException('Cette demande a déjà été traitée.');
    if (req.requestedById === user.id && !canDecideOwn(user.role)) {
      throw new ForbiddenException('Vous ne pouvez pas décider une demande que vous avez créée : un autre membre de l\'équipe doit la valider.');
    }
    const note = (dto.note ?? '').trim();
    if (!dto.approve && note.length < 5) throw new BadRequestException('Indiquez le motif du refus (5 caractères minimum).');

    // Réservation de la décision : un seul décideur passe (pas de double remboursement).
    const claimed = await this.prisma.refundRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: dto.approve ? 'APPROVED' : 'REJECTED', decidedById: user.id, decidedAt: new Date(), decisionNote: note || null },
    });
    if (claimed.count !== 1) throw new ConflictException('Cette demande vient d\'être traitée par quelqu\'un d\'autre.');

    const tx = await this.prisma.transaction.findUnique({ where: { id: req.transactionId }, select: { reference: true, status: true, sender: { select: { id: true, email: true, firstName: true } } } });
    let finalStatus: 'APPROVED' | 'REJECTED' | 'FAILED' = dto.approve ? 'APPROVED' : 'REJECTED';
    let failure: string | null = null;

    if (dto.approve) {
      try {
        await this.transactions.refundOnSupportDecision(clientId, user.id, req.transactionId, id);
      } catch (e: any) {
        if (e instanceof ConflictException || e instanceof NotFoundException) {
          finalStatus = 'FAILED';
          failure = String(e.message ?? 'Remboursement impossible');
          await this.prisma.refundRequest.update({ where: { id }, data: { status: 'FAILED', decisionNote: [note, failure].filter(Boolean).join(' — ').slice(0, 500) } });
        } else {
          // Panne technique : rien n'a bougé, la demande redevient décidable.
          await this.prisma.refundRequest.update({ where: { id }, data: { status: 'PENDING', decidedById: null, decidedAt: null, decisionNote: null } }).catch(() => undefined);
          throw e;
        }
      }
    }

    await this.audit(user, clientId, 'REFUND_DECIDE', id, { decision: finalStatus, transactionId: req.transactionId, amount: Number(req.amount), currency: req.currency, ...(failure ? { failure } : {}) });

    // Notifications : le demandeur (équipe), et le client concerné quand l'argent est revenu ou la demande refusée.
    const requester = await this.prisma.user.findUnique({ where: { id: req.requestedById }, select: { id: true, email: true, firstName: true } });
    const ref = tx?.reference ?? req.transactionId;
    if (requester && requester.id !== user.id) {
      await this.notifier.notifyUser(requester, {
        kind: finalStatus === 'APPROVED' ? 'REFUND_APPROVED' : finalStatus === 'REJECTED' ? 'REFUND_REJECTED' : 'REFUND_FAILED',
        type: finalStatus === 'APPROVED' ? 'SUCCESS' : 'WARNING',
        title: finalStatus === 'APPROVED' ? 'Remboursement accepté' : finalStatus === 'REJECTED' ? 'Remboursement refusé' : 'Remboursement impossible',
        body: finalStatus === 'FAILED' ? `${ref} : ${failure}` : `${ref} — ${note || 'sans commentaire'}`,
        actionUrl: '/support/refunds',
        actionLabel: 'Remboursements',
        email: false,
      });
    }
    if (tx?.sender && finalStatus === 'APPROVED') {
      await this.notifier.notifyUser(tx.sender, {
        kind: 'REFUND_APPROVED',
        type: 'SUCCESS',
        title: 'Remboursement effectué',
        body: `${Number(req.amount)} ${req.currency} ont été recrédités sur votre portefeuille (envoi ${ref} ${tx.status === 'PAID' ? 'rappelé' : 'annulé'}).`,
        actionUrl: '/wallet',
        actionLabel: 'Portefeuille',
      });
    } else if (tx?.sender && finalStatus === 'REJECTED') {
      await this.notifier.notifyUser(tx.sender, {
        kind: 'REFUND_REJECTED',
        type: 'INFO',
        title: 'Demande de remboursement refusée',
        body: `Envoi ${ref} : ${note}`,
        actionLabel: 'Aide',
      });
    }

    const fresh = await this.prisma.refundRequest.findUniqueOrThrow({ where: { id } });
    return view(fresh, { reference: ref });
  }
}
