// apps/backend/src/support/support-desk.service.ts
// =========================================================
// BUREAU D'ASSISTANCE (lot 9) — ce que voit et fait le service client sur les comptes clients et les opérations.
//   • Périmètre : la société de l'utilisateur, comptes de rôle USER uniquement (jamais un agent, un admin, un autre support).
//   • Chaque méthode est protégée par une délégation (voir le contrôleur) ; un administrateur de société a tous les droits.
//   • Lecture seule pour les opérations : pas de code de retrait, pas de données de paiement, pas de pièce d'identité (celles-ci passent par /kyc).
//   • Suspension / réactivation : motif obligatoire à la suspension, tracé (USER_SUSPEND / USER_REACTIVATE) et notifié au client.
// =========================================================

import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import { SupportNotifierService } from './support-notifier.service';
import { hasPermission } from './support-permissions';

const CLIENT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  country: true,
  kycLevel: true,
  isActive: true,
  isSuspended: true,
  suspendedAt: true,
  suspendedReason: true,
  lastLoginAt: true,
  createdAt: true,
  clientId: true,
} as const;

function clientView(u: any) {
  return {
    id: u.id,
    firstName: u.firstName ?? null,
    lastName: u.lastName ?? null,
    email: u.email,
    phone: u.phone ?? null,
    country: u.country ?? null,
    kycLevel: u.kycLevel,
    suspended: Boolean(u.isSuspended),
    suspendedAt: u.suspendedAt ? new Date(u.suspendedAt).toISOString() : null,
    suspendedReason: u.suspendedReason ?? null,
    lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
    createdAt: new Date(u.createdAt).toISOString(),
  };
}

/** Vue d'une opération pour le service client : aucune donnée de retrait ni de paiement. */
export function transactionView(t: any) {
  return {
    id: t.id,
    reference: t.reference,
    type: t.type,
    status: t.status,
    amount: Number(t.amount),
    fees: Number(t.fees),
    total: Number(t.total),
    currency: t.currency,
    targetCurrency: t.targetCurrency ?? null,
    receivedAmount: t.receivedAmount == null ? null : Number(t.receivedAmount),
    payoutMethod: t.payoutMethod,
    createdAt: new Date(t.createdAt).toISOString(),
    paidAt: t.paidAt ? new Date(t.paidAt).toISOString() : null,
    cancelledAt: t.cancelledAt ? new Date(t.cancelledAt).toISOString() : null,
    isFlagged: Boolean(t.isFlagged),
    sender: t.sender ? { id: t.sender.id, name: `${t.sender.firstName ?? ''} ${t.sender.lastName ?? ''}`.trim() || t.sender.email } : null,
  };
}

export const TX_SELECT = {
  id: true,
  reference: true,
  type: true,
  status: true,
  amount: true,
  fees: true,
  total: true,
  currency: true,
  targetCurrency: true,
  receivedAmount: true,
  payoutMethod: true,
  createdAt: true,
  paidAt: true,
  cancelledAt: true,
  isFlagged: true,
  clientId: true,
  senderId: true,
  sender: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

@Injectable()
export class SupportDeskService {
  private readonly logger = new Logger(SupportDeskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: SupportNotifierService,
  ) {}

  /** Société de travail : celle du compte ; le super administrateur n'a pas de société et passe `clientId` s'il en cible une. */
  scopeClientId(user: AuthUserPayload, requested?: number): number | undefined {
    if (user.role === 'SUPER_ADMIN') return requested;
    if (!user.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    return user.clientId;
  }

  private async audit(user: AuthUserPayload, clientId: number | null, action: 'USER_SUSPEND' | 'USER_REACTIVATE', entityId: string, details: Record<string, unknown>) {
    try {
      await this.prisma.auditLog.create({ data: { userId: user.id, clientId, action, entity: 'User', entityId, details: details as Prisma.InputJsonValue, successful: true } });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (${action}, ${entityId}) : ${(err as Error).message}`);
    }
  }

  async listClients(user: AuthUserPayload, q: { search?: string; status?: string; page?: number; limit?: number; clientId?: number }) {
    const clientId = this.scopeClientId(user, q.clientId);
    const page = Math.max(1, Math.floor(q.page ?? 1));
    const limit = Math.min(50, Math.max(1, Math.floor(q.limit ?? 20)));
    const search = q.search?.trim();
    const where: Prisma.UserWhereInput = {
      role: 'USER',
      deletedAt: null,
      ...(clientId ? { clientId } : {}),
      ...(q.status === 'SUSPENDED' ? { isSuspended: true } : q.status === 'ACTIVE' ? { isSuspended: false } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search.replace(/[^\d+]/g, '') || search } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({ where, select: CLIENT_SELECT, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
    ]);
    return { page, limit, total, items: rows.map(clientView) };
  }

  private async clientOf(user: AuthUserPayload, id: string) {
    const row = await this.prisma.user.findFirst({ where: { id, role: 'USER', deletedAt: null }, select: CLIENT_SELECT });
    const clientId = this.scopeClientId(user);
    if (!row || (clientId && row.clientId !== clientId)) throw new NotFoundException('Client introuvable.');
    return row;
  }

  async clientDetail(user: AuthUserPayload, id: string) {
    const row = await this.clientOf(user, id);
    const canTx = hasPermission(user, 'TRANSACTIONS_VIEW');
    const canTickets = hasPermission(user, 'TICKETS_HANDLE');
    const [recent, openTickets] = await Promise.all([
      canTx
        ? this.prisma.transaction.findMany({ where: { senderId: id }, select: TX_SELECT, orderBy: { createdAt: 'desc' }, take: 10 })
        : Promise.resolve([] as any[]),
      canTickets ? this.prisma.supportTicket.count({ where: { userId: id, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_USER'] } } }) : Promise.resolve(null),
    ]);
    return { client: clientView(row), recentTransactions: canTx ? recent.map(transactionView) : null, openTickets };
  }

  async suspend(user: AuthUserPayload, id: string, reason: string) {
    const why = (reason ?? '').trim();
    if (why.length < 5) throw new BadRequestException('Indiquez le motif de la suspension (5 caractères minimum).');
    const row = await this.clientOf(user, id);
    if (row.isSuspended) throw new ConflictException('Ce compte est déjà suspendu.');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { isSuspended: true, suspendedAt: new Date(), suspendedReason: why.slice(0, 300) } }),
      this.prisma.userSession.deleteMany({ where: { userId: id } }),
    ]);
    await this.audit(user, row.clientId, 'USER_SUSPEND', id, { reason: why.slice(0, 300), by: user.role });
    await this.notifier.notifyUser(row, {
      kind: 'ACCOUNT_SUSPENDED',
      type: 'WARNING',
      title: 'Compte suspendu',
      body: 'Votre compte a été suspendu. Contactez le service client pour en savoir plus.',
    });
    return clientView(await this.clientOf(user, id));
  }

  async reactivate(user: AuthUserPayload, id: string) {
    const row = await this.clientOf(user, id);
    if (!row.isSuspended) throw new ConflictException("Ce compte n'est pas suspendu.");
    await this.prisma.user.update({ where: { id }, data: { isSuspended: false, suspendedAt: null, suspendedReason: null, isActive: true } });
    await this.audit(user, row.clientId, 'USER_REACTIVATE', id, { by: user.role });
    await this.notifier.notifyUser(row, {
      kind: 'ACCOUNT_REACTIVATED',
      type: 'SUCCESS',
      title: 'Compte réactivé',
      body: 'Votre compte est de nouveau actif. Vous pouvez vous reconnecter.',
    });
    return clientView(await this.clientOf(user, id));
  }

  /** Compteurs du tableau de bord : uniquement pour les domaines que le compte a le droit de traiter. */
  async overview(user: AuthUserPayload) {
    const clientId = this.scopeClientId(user);
    const co = clientId ? { clientId } : {};
    const [tickets, disputes, refunds, kyc] = await Promise.all([
      hasPermission(user, 'TICKETS_HANDLE') ? this.prisma.supportTicket.count({ where: { ...co, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_USER'] } } }) : null,
      hasPermission(user, 'TICKETS_HANDLE') ? this.prisma.supportTicket.count({ where: { ...co, transactionId: { not: null }, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_USER'] } } }) : null,
      hasPermission(user, 'REFUNDS_DECIDE') ? this.prisma.refundRequest.count({ where: { ...co, status: 'PENDING' } }) : null,
      hasPermission(user, 'KYC_REVIEW') ? this.prisma.kycDocument.count({ where: { status: 'PENDING', user: { ...co, role: 'USER' } } }) : null,
    ]);
    return { permissions: user.role === 'SUPPORT' ? user.permissions ?? [] : null, counts: { tickets, disputes, refunds, kyc } };
  }

  // ── Opérations (lecture seule) ───────────────────────
  async searchTransactions(user: AuthUserPayload, q: { search?: string; status?: string; page?: number; limit?: number; clientId?: number }) {
    const clientId = this.scopeClientId(user, q.clientId);
    const page = Math.max(1, Math.floor(q.page ?? 1));
    const limit = Math.min(50, Math.max(1, Math.floor(q.limit ?? 20)));
    const search = q.search?.trim();
    const STATUSES = ['PENDING', 'VALIDATED', 'PROCESSING', 'PAID', 'CANCELLED', 'FAILED', 'REFUNDED', 'EXPIRED'];
    const where: Prisma.TransactionWhereInput = {
      ...(clientId ? { clientId } : {}),
      ...(q.status && STATUSES.includes(q.status) ? { status: q.status as never } : {}),
      ...(search
        ? {
            OR: [
              { reference: { contains: search, mode: 'insensitive' } },
              { sender: { email: { contains: search, mode: 'insensitive' } } },
              { sender: { lastName: { contains: search, mode: 'insensitive' } } },
              { sender: { phone: { contains: search.replace(/[^\d+]/g, '') || search } } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({ where, select: TX_SELECT, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
    ]);
    return { page, limit, total, items: rows.map(transactionView) };
  }

  async transactionDetail(user: AuthUserPayload, id: string) {
    const clientId = this.scopeClientId(user);
    const t = await this.prisma.transaction.findFirst({ where: { id, ...(clientId ? { clientId } : {}) }, select: TX_SELECT });
    if (!t) throw new NotFoundException('Opération introuvable.');
    const refunds = await this.prisma.refundRequest.findMany({ where: { transactionId: id }, orderBy: { createdAt: 'desc' }, take: 10 });
    return {
      transaction: transactionView(t),
      refundable: ['TRANSFER', 'SCHEDULED'].includes(t.type) && ['PENDING', 'VALIDATED', 'PROCESSING'].includes(t.status),
      refundRequests: refunds.map((r) => ({ id: r.id, status: r.status, amount: Number(r.amount), currency: r.currency, createdAt: r.createdAt.toISOString() })),
    };
  }
}
