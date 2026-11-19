// apps/backend/src/treasury/treasury-withdrawals.service.ts
// =========================================================
// DOUBLE VALIDATION DES RETRAITS DE TRÉSORERIE (audit argent I4)
// Avant : un seul administrateur (ou une session volée) pouvait retirer tout le portefeuille de la société, sans second regard.
// Maintenant : il DEMANDE le retrait ; un autre administrateur de la société (ou le super admin) l'approuve. L'argent ne bouge
// qu'à l'approbation, dans la MÊME transaction SQL que la prise en charge de la demande (jamais deux retraits pour une demande).
// Une demande sans réponse expire au bout de 48 h. Tout est tracé dans le journal d'audit.
// =========================================================

import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { assertAmountFitsCurrency } from '../wallets/money';
import { DENY_MESSAGE, expiryFrom, whyCannotCancel, whyCannotDecide, type DenyReason } from './withdrawal-rules';

export const MAX_WITHDRAWAL = 1_000_000_000_000;
const MAX_PENDING_PER_COMPANY = 20;

@Injectable()
export class TreasuryWithdrawalsService {
  private readonly logger = new Logger(TreasuryWithdrawalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletsService,
  ) {}

  private deny(reason: DenyReason): never {
    if (reason === 'FOREIGN_COMPANY') throw new NotFoundException(DENY_MESSAGE[reason]);
    if (reason === 'NOT_PENDING' || reason === 'EXPIRED') throw new ConflictException(DENY_MESSAGE[reason]);
    throw new ForbiddenException(DENY_MESSAGE[reason]);
  }

  private async audit(user: Pick<AuthUserPayload, 'id'>, clientId: number, kind: string, details: Record<string, unknown>) {
    try {
      await this.prisma.auditLog.create({
        data: { userId: user.id, clientId, action: 'BALANCE_ADJUSTMENT', entity: 'Treasury', entityId: kind, details: { kind, ...details } as Prisma.InputJsonValue, successful: true },
      });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (${kind}) : ${(err as Error).message}`);
    }
  }

  private async notify(userIds: string[], title: string, message: string, metadata: Record<string, unknown>) {
    await Promise.all(userIds.map((userId) => this.prisma.notification.create({
      data: { userId, title, message, type: 'WARNING', metadata: metadata as Prisma.InputJsonValue },
    }).catch(() => undefined)));
  }

  /** Crée la demande. Aucun mouvement d'argent. */
  async request(user: AuthUserPayload, input: { currency: string; amount: number; reason?: string | null }) {
    if (user.role !== 'COMPANY_ADMIN' || !user.clientId) throw new ForbiddenException('Cette action est réservée aux admins société (COMPANY_ADMIN).');
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_WITHDRAWAL) throw new BadRequestException('Montant invalide.');
    const currency = String(input.currency).toUpperCase().trim();
    assertAmountFitsCurrency(amount, currency);

    const pending = await this.prisma.treasuryWithdrawalRequest.count({ where: { clientId: user.clientId, status: 'PENDING', expiresAt: { gt: new Date() } } });
    if (pending >= MAX_PENDING_PER_COMPANY) throw new ConflictException('Trop de demandes en attente : faites traiter les précédentes.');

    const created = await this.prisma.treasuryWithdrawalRequest.create({
      data: { clientId: user.clientId, currency, amount, reason: input.reason?.trim() || null, requestedBy: user.id, expiresAt: expiryFrom(new Date()) },
    });
    await this.audit(user, user.clientId, 'TREASURY_WITHDRAW_REQUEST', { requestId: created.id, currency, amount });

    const others = await this.prisma.user.findMany({ where: { clientId: user.clientId, role: 'COMPANY_ADMIN', isActive: true, deletedAt: null, id: { not: user.id } }, select: { id: true } });
    await this.notify(others.map((o) => o.id), '💸 Retrait à valider', `Un retrait de ${amount} ${currency} attend votre validation (expire sous 48 h).`, { kind: 'TREASURY_WITHDRAW_REQUEST', requestId: created.id });
    return { ...created, amount: Number(created.amount), status: 'PENDING' as const, soloAdmin: others.length === 0 };
  }

  async list(user: AuthUserPayload, status?: string) {
    const isSuper = user.role === 'SUPER_ADMIN';
    if (!isSuper && !user.clientId) throw new ForbiddenException('Société inconnue.');
    const now = new Date();
    const rows = await this.prisma.treasuryWithdrawalRequest.findMany({
      where: { ...(isSuper ? {} : { clientId: user.clientId }), ...(status ? { status } : {}) },
      orderBy: { requestedAt: 'desc' },
      take: 100,
    });
    const ids = [...new Set(rows.flatMap((r) => [r.requestedBy, r.decidedBy].filter((x): x is string => !!x)))];
    const users = ids.length ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } }) : [];
    const name = (id?: string | null) => { const u = users.find((x) => x.id === id); return u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || null : null; };
    return rows.map((r) => ({
      id: r.id, clientId: r.clientId, currency: r.currency, amount: Number(r.amount), reason: r.reason,
      status: r.status === 'PENDING' && r.expiresAt <= now ? 'EXPIRED' : r.status,
      requestedBy: r.requestedBy, requestedByName: name(r.requestedBy), requestedAt: r.requestedAt, expiresAt: r.expiresAt,
      decidedBy: r.decidedBy, decidedByName: name(r.decidedBy), decidedAt: r.decidedAt, decisionNote: r.decisionNote, failureReason: r.failureReason,
      canDecide: r.status === 'PENDING' && whyCannotDecide(user, r, now) === null,
      canCancel: whyCannotCancel(user, r) === null && r.expiresAt > now,
    }));
  }

  private async load(user: AuthUserPayload, id: string) {
    const row = await this.prisma.treasuryWithdrawalRequest.findUnique({ where: { id } });
    // Une demande d'une autre société n'existe pas pour cet utilisateur.
    if (!row || (user.role !== 'SUPER_ADMIN' && row.clientId !== user.clientId)) throw new NotFoundException('Demande introuvable.');
    return row;
  }

  /** Approuve ET exécute le retrait, atomiquement. Un solde insuffisant laisse la demande en attente. */
  async approve(user: AuthUserPayload, id: string) {
    const row = await this.load(user, id);
    const why = whyCannotDecide(user, row);
    if (why === 'EXPIRED') await this.prisma.treasuryWithdrawalRequest.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'EXPIRED' } });
    if (why) this.deny(why);

    const amount = Number(row.amount);
    const wallet = await this.wallets.getOrCreateWallet({ clientId: row.clientId, currency: row.currency });
    try {
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.treasuryWithdrawalRequest.updateMany({
          where: { id, status: 'PENDING', expiresAt: { gt: new Date() }, requestedBy: { not: user.id } },
          data: { status: 'APPROVED', decidedBy: user.id, decidedAt: new Date(), failureReason: null },
        });
        if (claimed.count !== 1) throw new ConflictException(DENY_MESSAGE.NOT_PENDING);
        await this.wallets.debitInTx(tx, wallet.id, amount, row.reason ? `Retrait trésorerie : ${row.reason}` : 'Retrait trésorerie validé');
      });
    } catch (err) {
      // Échec d'exécution (ex. solde insuffisant) : la transaction a tout annulé, la demande reste PENDING avec la cause.
      if (!(err instanceof ConflictException)) {
        const msg = (err as { message?: string })?.message ?? 'Échec du retrait.';
        await this.prisma.treasuryWithdrawalRequest.updateMany({ where: { id, status: 'PENDING' }, data: { failureReason: String(msg).slice(0, 300) } }).catch(() => undefined);
      }
      throw err;
    }
    await this.audit(user, row.clientId, 'TREASURY_WITHDRAW_APPROVED', { requestId: id, currency: row.currency, amount, requestedBy: row.requestedBy });
    await this.notify([row.requestedBy], '✅ Retrait validé', `Votre retrait de ${amount} ${row.currency} a été validé et exécuté.`, { kind: 'TREASURY_WITHDRAW_APPROVED', requestId: id });
    return { id, status: 'APPROVED' as const };
  }

  async reject(user: AuthUserPayload, id: string, note?: string | null) {
    const row = await this.load(user, id);
    const why = whyCannotDecide(user, row);
    if (why) this.deny(why);
    const res = await this.prisma.treasuryWithdrawalRequest.updateMany({
      where: { id, status: 'PENDING', requestedBy: { not: user.id } },
      data: { status: 'REJECTED', decidedBy: user.id, decidedAt: new Date(), decisionNote: note?.trim().slice(0, 300) || null },
    });
    if (res.count !== 1) throw new ConflictException(DENY_MESSAGE.NOT_PENDING);
    await this.audit(user, row.clientId, 'TREASURY_WITHDRAW_REJECTED', { requestId: id, currency: row.currency, amount: Number(row.amount) });
    await this.notify([row.requestedBy], '❌ Retrait refusé', `Votre demande de retrait de ${Number(row.amount)} ${row.currency} a été refusée.${note ? ` Motif : ${note.trim().slice(0, 300)}` : ''}`, { kind: 'TREASURY_WITHDRAW_REJECTED', requestId: id });
    return { id, status: 'REJECTED' as const };
  }

  async cancel(user: AuthUserPayload, id: string) {
    const row = await this.load(user, id);
    const why = whyCannotCancel(user, row);
    if (why) this.deny(why);
    const res = await this.prisma.treasuryWithdrawalRequest.updateMany({ where: { id, status: 'PENDING', requestedBy: user.id }, data: { status: 'CANCELLED', decidedBy: user.id, decidedAt: new Date() } });
    if (res.count !== 1) throw new ConflictException(DENY_MESSAGE.NOT_PENDING);
    await this.audit(user, row.clientId, 'TREASURY_WITHDRAW_CANCELLED', { requestId: id });
    return { id, status: 'CANCELLED' as const };
  }
}
