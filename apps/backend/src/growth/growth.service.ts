// apps/backend/src/growth/growth.service.ts
// =========================================================
// GROWTH SERVICE v1.0 (lot 16)
//   • taux garanti        POST /rate-locks
//   • demandes d'argent   POST/GET /money-requests, decline, cancel (+ rapprochement automatique avec l'envoi qui règle)
//   • parrainage          GET /referrals/me (client) ; GET/PUT /referrals-admin/config, GET /referrals-admin/stats (admin)
// Cloisonnement : tout est filtré par la société du compte connecté.
// =========================================================

import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CurrencyCode, Prisma } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { normalizePhoneE164 } from '../common/utils/phone.util';
import { roundToCurrency } from '../fee-schedule/fee-engine';
import { PushService } from '../push/push.service';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../rates/rates.service';
import { loadReferralSettings } from './growth.core';
import {
  MAX_OPEN_LOCKS, MAX_OPEN_REQUESTS, REFERRAL_KIND, addDays, addMinutes, applyLockMargin, lockMarginPct, lockMinutes, parseReferralSettings, parseRequestAmount,
  paymentSettlesRequest, requestDays, startOfMonthUtc, type PaymentLike,
} from './growth.rules';
import type { CreateMoneyRequestDto, QuoteRateLockDto, UpdateReferralConfigDto } from './dto/growth.dto';

const num = (v: unknown): number => Number(v ?? 0);
const fullName = (u?: { firstName?: string | null; lastName?: string | null } | null): string => `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || 'Client';

@Injectable()
export class GrowthService {
  private readonly logger = new Logger(GrowthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rates: RatesService,
    private readonly push: PushService,
  ) {}

  /** Notification dans l'application (+ push) qui ouvre l'écran voulu. Ne lève jamais. */
  private async notify(userId: string, title: string, body: string, kind: string, actionUrl: string): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: { userId, title, message: body, type: 'INFO', channels: ['IN_APP', 'PUSH'], priority: 'NORMAL', actionUrl, groupKey: 'growth', space: 'client', metadata: { kind } },
      });
    } catch (e) {
      this.logger.warn(`Notification ${kind} → ${userId} impossible : ${(e as Error).message}`);
    }
    try {
      await this.push.sendToUser(userId, { title, body, data: { type: 'GROWTH', kind, space: 'client', actionUrl } });
    } catch (e) {
      this.logger.warn(`Push ${kind} → ${userId} impossible : ${(e as Error).message}`);
    }
  }

  private companyOf(user: AuthUserPayload): number {
    if (!user.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    return user.clientId;
  }

  private currencyOf(raw: string): CurrencyCode {
    const c = raw.trim().toUpperCase();
    if (!(Object.values(CurrencyCode) as string[]).includes(c)) throw new BadRequestException(`Devise non prise en charge : ${raw}.`);
    return c as CurrencyCode;
  }

  // ── Taux garanti ────────────────────────────────────────

  async quoteRate(user: AuthUserPayload, dto: QuoteRateLockDto) {
    const clientId = this.companyOf(user);
    const currency = this.currencyOf(dto.currency);
    const targetCurrency = this.currencyOf(dto.targetCurrency);
    const now = new Date();

    // Même demande déjà garantie et encore valable plus d'une minute : on la renvoie (évite d'empiler des garanties).
    const same = await this.prisma.rateLock.findFirst({
      where: { userId: user.id, currency, targetCurrency, amount: new Prisma.Decimal(dto.amount), consumedAt: null, expiresAt: { gt: addMinutes(now, 1) } },
      orderBy: { expiresAt: 'desc' },
    });
    if (same) return this.lockView(same, now);

    const open = await this.prisma.rateLock.count({ where: { userId: user.id, consumedAt: null, expiresAt: { gt: now } } });
    if (open >= MAX_OPEN_LOCKS) throw new ConflictException('Trop de taux garantis en cours. Utilisez l’un d’eux ou patientez quelques minutes.');

    const market = currency === targetCurrency ? dto.amount : await this.rates.convert(dto.amount, currency, targetCurrency, clientId);
    // audit argent (M2) : la marge s'applique seulement à une vraie conversion ; elle est incluse dans le montant et le taux garantis,
    // donc le client voit (et obtient) exactement ce qui est affiché.
    const raw = currency === targetCurrency ? market : applyLockMargin(market, lockMarginPct());
    const received = currency === targetCurrency ? dto.amount : roundToCurrency(raw, targetCurrency);
    if (!(received > 0)) throw new BadRequestException('Montant trop faible : le montant reçu serait nul après conversion.');

    const lock = await this.prisma.rateLock.create({
      data: {
        clientId, userId: user.id, currency, targetCurrency, amount: new Prisma.Decimal(dto.amount),
        rate: dto.amount > 0 ? raw / dto.amount : 1, receivedAmount: new Prisma.Decimal(received), expiresAt: addMinutes(now, lockMinutes()),
      },
    });
    return this.lockView(lock, now);
  }

  private lockView(l: { id: string; currency: string; targetCurrency: string; amount: Prisma.Decimal; rate: number; receivedAmount: Prisma.Decimal; expiresAt: Date }, now: Date) {
    return {
      id: l.id, currency: l.currency, targetCurrency: l.targetCurrency, amount: num(l.amount), rate: l.rate,
      receivedAmount: num(l.receivedAmount), expiresAt: l.expiresAt.toISOString(),
      secondsLeft: Math.max(0, Math.round((l.expiresAt.getTime() - now.getTime()) / 1000)),
    };
  }

  // ── Demandes d'argent ───────────────────────────────────

  async createRequest(user: AuthUserPayload, dto: CreateMoneyRequestDto) {
    const clientId = this.companyOf(user);
    const amount = parseRequestAmount(dto.amount);
    const currency = this.currencyOf(dto.currency);

    const phone = normalizePhoneE164(dto.payerPhone);
    if (!phone) throw new BadRequestException('Numéro de téléphone invalide (indicatif du pays compris).');
    const payer = await this.prisma.user.findFirst({
      where: { clientId, phone, isActive: true, deletedAt: null, role: 'USER' },
      select: { id: true, firstName: true, lastName: true, phone: true },
    });
    if (!payer) throw new NotFoundException('Aucun client avec ce numéro. Il doit avoir un compte pour recevoir votre demande.');
    if (payer.id === user.id) throw new BadRequestException('Vous ne pouvez pas vous adresser une demande.');

    const open = await this.prisma.moneyRequest.count({ where: { requesterId: user.id, status: 'PENDING', expiresAt: { gt: new Date() } } });
    if (open >= MAX_OPEN_REQUESTS) throw new ConflictException('Trop de demandes en attente. Annulez-en avant d’en créer d’autres.');

    const now = new Date();
    const row = await this.prisma.moneyRequest.create({
      data: {
        clientId, requesterId: user.id, payerId: payer.id, amount: new Prisma.Decimal(amount), currency,
        note: dto.note?.trim() || null, expiresAt: addDays(now, requestDays()),
      },
    });

    const requester = await this.prisma.user.findUnique({ where: { id: user.id }, select: { firstName: true, lastName: true } });
    void this.notify(payer.id, 'Demande d’argent', `${fullName(requester)} vous demande ${amount.toLocaleString('fr-FR')} ${currency}${row.note ? ` — « ${row.note} »` : ''}.`, 'MONEY_REQUEST', '/money-requests');

    return this.requestView(row, 'SENT', { firstName: payer.firstName, lastName: payer.lastName, phone: payer.phone });
  }

  /** Expire les demandes échues et rapproche celles que l'envoi du payeur a déjà réglées. Idempotent, borné à un utilisateur. */
  private async refreshRequests(userId: string, now: Date): Promise<void> {
    await this.prisma.moneyRequest.updateMany({
      where: { status: 'PENDING', expiresAt: { lte: now }, OR: [{ payerId: userId }, { requesterId: userId }] },
      data: { status: 'EXPIRED', respondedAt: now },
    });

    const pending = await this.prisma.moneyRequest.findMany({
      where: { status: 'PENDING', OR: [{ payerId: userId }, { requesterId: userId }] },
      take: 50,
    });
    for (const r of pending) {
      const candidates = await this.prisma.transaction.findMany({
        where: {
          clientId: r.clientId, senderId: r.payerId, recipientId: r.requesterId, status: 'PAID', deletedAt: null,
          createdAt: { gte: new Date(r.createdAt.getTime() - 1000) },
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
        select: { id: true, senderId: true, recipientId: true, clientId: true, status: true, currency: true, amount: true, targetCurrency: true, receivedAmount: true, createdAt: true, deletedAt: true },
      });
      for (const t of candidates) {
        const like: PaymentLike = {
          senderId: t.senderId, recipientId: t.recipientId, clientId: t.clientId, status: t.status, currency: String(t.currency), amount: num(t.amount),
          targetCurrency: t.targetCurrency ? String(t.targetCurrency) : null, receivedAmount: num(t.receivedAmount), createdAt: t.createdAt, deletedAt: t.deletedAt,
        };
        if (!paymentSettlesRequest({ clientId: r.clientId, requesterId: r.requesterId, payerId: r.payerId, amount: num(r.amount), currency: String(r.currency), createdAt: r.createdAt }, like)) continue;
        // Un envoi ne règle qu'une demande (paidTransactionId est unique).
        const taken = await this.prisma.moneyRequest.findFirst({ where: { paidTransactionId: t.id }, select: { id: true } });
        if (taken) continue;
        const done = await this.prisma.moneyRequest.updateMany({
          where: { id: r.id, status: 'PENDING' },
          data: { status: 'PAID', respondedAt: now, paidTransactionId: t.id },
        });
        if (done.count > 0) {
          void this.notify(r.requesterId, 'Demande réglée ✅', `Votre demande de ${num(r.amount).toLocaleString('fr-FR')} ${r.currency} a été réglée.`, 'MONEY_REQUEST_PAID', '/money-requests');
        }
        break;
      }
    }
  }

  async listRequests(user: AuthUserPayload) {
    const clientId = this.companyOf(user);
    const now = new Date();
    await this.refreshRequests(user.id, now);
    const rows = await this.prisma.moneyRequest.findMany({
      where: { clientId, OR: [{ payerId: user.id }, { requesterId: user.id }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const ids = [...new Set(rows.flatMap((r) => [r.payerId, r.requesterId]))];
    const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, phone: true } });
    const byId = new Map(users.map((u) => [u.id, u]));
    const views = rows.map((r) => {
      const mine = r.requesterId === user.id;
      return this.requestView(r, mine ? 'SENT' : 'RECEIVED', byId.get(mine ? r.payerId : r.requesterId) ?? null);
    });
    return {
      received: views.filter((v) => v.direction === 'RECEIVED'),
      sent: views.filter((v) => v.direction === 'SENT'),
      pendingToPay: views.filter((v) => v.direction === 'RECEIVED' && v.status === 'PENDING').length,
    };
  }

  private requestView(
    r: { id: string; amount: Prisma.Decimal; currency: string; note: string | null; status: string; expiresAt: Date; createdAt: Date; respondedAt: Date | null; payerId: string; requesterId: string },
    direction: 'SENT' | 'RECEIVED',
    other: { firstName?: string | null; lastName?: string | null; phone?: string | null } | null,
  ) {
    return {
      id: r.id, direction, status: r.status, amount: num(r.amount), currency: r.currency, note: r.note,
      counterpartId: direction === 'SENT' ? r.payerId : r.requesterId, counterpartName: fullName(other), counterpartPhone: other?.phone ?? null,
      expiresAt: r.expiresAt.toISOString(), createdAt: r.createdAt.toISOString(), respondedAt: r.respondedAt?.toISOString() ?? null,
    };
  }

  /** Le payeur refuse, ou le demandeur annule : seule une demande encore en attente peut changer d'état. */
  async closeRequest(user: AuthUserPayload, id: string, as: 'DECLINE' | 'CANCEL') {
    const clientId = this.companyOf(user);
    const r = await this.prisma.moneyRequest.findFirst({ where: { id, clientId } });
    const allowed = r && (as === 'DECLINE' ? r.payerId === user.id : r.requesterId === user.id);
    if (!r || !allowed) throw new NotFoundException('Demande introuvable.');
    if (r.status !== 'PENDING') throw new ConflictException('Cette demande n’est plus en attente.');

    const now = new Date();
    const res = await this.prisma.moneyRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: as === 'DECLINE' ? 'DECLINED' : 'CANCELLED', respondedAt: now },
    });
    if (res.count === 0) throw new ConflictException('Cette demande n’est plus en attente.');

    if (as === 'DECLINE') {
      void this.notify(r.requesterId, 'Demande refusée', `Votre demande de ${num(r.amount).toLocaleString('fr-FR')} ${r.currency} a été refusée.`, 'MONEY_REQUEST_DECLINED', '/money-requests');
    }
    return { id, status: as === 'DECLINE' ? 'DECLINED' : 'CANCELLED' };
  }

  // ── Parrainage : côté client ────────────────────────────

  async myReferral(user: AuthUserPayload) {
    const clientId = this.companyOf(user);
    const now = new Date();
    const [me, cfg, referred, rewards] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: user.id }, select: { referralCode: true } }),
      loadReferralSettings(this.prisma, clientId),
      this.prisma.user.count({ where: { referredById: user.id, clientId } }),
      this.prisma.referralReward.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    const usable = rewards.filter((r) => r.status === 'AVAILABLE' && r.remaining > 0 && r.expiresAt > now);
    return {
      code: me?.referralCode ?? null,
      program: { active: cfg.isActive, refereeWaivers: cfg.refereeWaivers, referrerWaivers: cfg.referrerWaivers, validityDays: cfg.rewardValidityDays, minFirstTransfer: cfg.minFirstTransfer },
      referredCount: referred,
      freeTransfersLeft: usable.reduce((s, r) => s + r.remaining, 0),
      nextExpiry: usable.length ? usable.map((r) => r.expiresAt).sort((a, b) => a.getTime() - b.getTime())[0]!.toISOString() : null,
      rewards: rewards.map((r) => ({
        id: r.id, kind: r.kind, status: r.expiresAt <= now && r.status === 'AVAILABLE' ? 'EXPIRED' : r.status, remaining: r.remaining,
        expiresAt: r.expiresAt.toISOString(), createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  // ── Parrainage : administrateur de société ──────────────

  async getReferralConfig(user: AuthUserPayload) {
    return loadReferralSettings(this.prisma, this.companyOf(user));
  }

  async updateReferralConfig(user: AuthUserPayload, dto: UpdateReferralConfigDto) {
    const clientId = this.companyOf(user);
    const current = await loadReferralSettings(this.prisma, clientId);
    const next = parseReferralSettings({ ...dto }, current);
    await this.prisma.referralConfig.upsert({
      where: { clientId },
      create: { clientId, ...next, minFirstTransfer: new Prisma.Decimal(next.minFirstTransfer) },
      update: { ...next, minFirstTransfer: new Prisma.Decimal(next.minFirstTransfer) },
    });
    try {
      await this.prisma.auditLog.create({
        data: { userId: user.id, clientId, action: 'REFERRAL_CONFIG', entity: 'ReferralConfig', entityId: String(clientId), details: { before: current, after: next } as unknown as Prisma.InputJsonValue, successful: true },
      });
    } catch (e) {
      this.logger.error(`Journal d'audit non écrit (REFERRAL_CONFIG) : ${(e as Error).message}`);
    }
    return next;
  }

  async referralStats(user: AuthUserPayload) {
    const clientId = this.companyOf(user);
    const now = new Date();
    const monthStart = startOfMonthUtc(now);
    const [config, referredTotal, referredMonth, rewardsByStatus, top, freeUsed] = await Promise.all([
      loadReferralSettings(this.prisma, clientId),
      this.prisma.user.count({ where: { clientId, referredById: { not: null } } }),
      this.prisma.user.count({ where: { clientId, referredById: { not: null }, createdAt: { gte: monthStart } } }),
      this.prisma.referralReward.groupBy({ by: ['kind', 'status'], where: { clientId }, _count: { _all: true } }),
      this.prisma.user.groupBy({ by: ['referredById'], where: { clientId, referredById: { not: null } }, _count: { _all: true }, orderBy: { _count: { referredById: 'desc' } }, take: 10 }),
      this.prisma.referralReward.count({ where: { clientId, usedAt: { not: null } } }),
    ]);

    const ids = top.map((t) => t.referredById).filter((x): x is string => !!x);
    const names = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } });
    const byId = new Map(names.map((n) => [n.id, n]));
    const count = (kind: string, status?: string) => rewardsByStatus.filter((r) => r.kind === kind && (!status || r.status === status)).reduce((s, r) => s + r._count._all, 0);

    return {
      config,
      referredTotal,
      referredMonth,
      rewardsGiven: { referee: count(REFERRAL_KIND.referee), referrer: count(REFERRAL_KIND.referrer) },
      rewardsAvailable: count(REFERRAL_KIND.referee, 'AVAILABLE') + count(REFERRAL_KIND.referrer, 'AVAILABLE'),
      rewardsUsed: count(REFERRAL_KIND.referee, 'USED') + count(REFERRAL_KIND.referrer, 'USED'),
      rewardsUsedAtLeastOnce: freeUsed,
      topReferrers: top.map((t) => ({ userId: t.referredById as string, name: fullName(byId.get(t.referredById as string)), referred: t._count._all })),
    };
  }
}
