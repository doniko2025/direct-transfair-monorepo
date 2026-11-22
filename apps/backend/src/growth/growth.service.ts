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
import { MailService } from '../mail/mail.service';
import { PushService } from '../push/push.service';
import { SmsService } from '../sms/sms.service';
import { escapeHtml, platform } from '../common/platform.config';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../rates/rates.service';
import { loadReferralSettings, referralReferenceCurrency } from './growth.core';
import {
  MAX_OPEN_LOCKS, MAX_OPEN_REQUESTS, REFERRAL_KIND, addDays, addMinutes, applyLockMargin, lockMarginPct, lockMinutes, parseReferralSettings, parseRequestAmount,
  paidInRequestCurrency, requestDays, startOfMonthUtc,
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
    private readonly mail: MailService,
    private readonly sms: SmsService,
  ) {}

  /**
   * Invitation à se connecter : e-mail (si le compte en a un) + SMS (sauf MONEY_REQUEST_SMS=false).
   * Complète la notification dans l'application et le push. Ne lève jamais : un envoi raté ne bloque pas la demande.
   */
  private async inviteToLogin(
    payer: { id: string; firstName?: string | null; email?: string | null; phone?: string | null },
    requesterName: string, amount: number, currency: string, note: string | null,
  ): Promise<void> {
    const amountText = `${amount.toLocaleString('fr-FR')} ${currency}`;
    const link = platform.appUrl;
    if (payer.email) {
      try {
        const noteHtml = note ? `<p style="margin:12px 0;padding:10px 14px;background:#FAFAF7;border-radius:8px;color:#444;">« ${escapeHtml(note)} »</p>` : '';
        const cta = link
          ? `<p style="margin:22px 0;text-align:center;"><a href="${escapeHtml(link)}" style="display:inline-block;padding:13px 26px;border-radius:999px;background:#111;color:#fff;text-decoration:none;font-weight:600;">Ouvrir l’application</a></p>`
          : '<p>Ouvrez l’application pour répondre à cette demande.</p>';
        await this.mail.sendEmail({
          to: payer.email,
          userId: payer.id,
          subject: `${requesterName} vous demande ${amountText}`,
          htmlContent:
            `<p>Bonjour <strong>${escapeHtml(payer.firstName?.trim() || '')}</strong>,</p>` +
            `<p><strong>${escapeHtml(requesterName)}</strong> vous demande <strong>${escapeHtml(amountText)}</strong>.</p>` +
            noteHtml +
            '<p>Connectez-vous pour la régler en un geste ou la refuser : la demande vous attend sur votre page d’accueil.</p>' +
            cta,
        });
      } catch (e) {
        this.logger.warn(`Demande d'argent : e-mail non envoyé (${(e as Error).message})`);
      }
    }
    if (payer.phone && (process.env.MONEY_REQUEST_SMS ?? '').trim().toLowerCase() !== 'false') {
      try {
        await this.sms.send({
          to: payer.phone,
          userId: payer.id,
          message: `${platform.smsTag} ${requesterName} vous demande ${amountText}. Connectez-vous pour répondre${link ? ` : ${link}` : '.'}`,
        });
      } catch (e) {
        this.logger.warn(`Demande d'argent : SMS non envoyé (${(e as Error).message})`);
      }
    }
  }

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
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
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
    void this.inviteToLogin(payer, fullName(requester), amount, currency, row.note);

    return this.requestView(row, 'SENT', { firstName: payer.firstName, lastName: payer.lastName, phone: payer.phone });
  }

  /** Expire les demandes échues. Le règlement, lui, se fait à l'envoi (lien explicite moneyRequestId), plus jamais par rapprochement au hasard. */
  private async refreshRequests(userId: string, now: Date): Promise<void> {
    await this.prisma.moneyRequest.updateMany({
      where: { status: 'PENDING', expiresAt: { lte: now }, OR: [{ payerId: userId }, { requesterId: userId }] },
      data: { status: 'EXPIRED', respondedAt: now },
    });
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
    const paidIds = rows.map((r) => r.paidTransactionId).filter((v): v is string => !!v);
    const txs = paidIds.length
      ? await this.prisma.transaction.findMany({
          where: { id: { in: paidIds }, clientId },
          select: { id: true, currency: true, amount: true, targetCurrency: true, receivedAmount: true },
        })
      : [];
    const txById = new Map(txs.map((t) => [t.id, t]));
    const views = rows.map((r) => {
      const mine = r.requesterId === user.id;
      const tx = r.paidTransactionId ? txById.get(r.paidTransactionId) : undefined;
      const settlement = tx
        ? {
            transactionId: tx.id,
            sentAmount: num(tx.amount),
            sentCurrency: String(tx.currency),
            receivedAmount: paidInRequestCurrency(
              { senderId: '', recipientId: null, clientId, status: 'PAID', currency: String(tx.currency), amount: num(tx.amount),
                targetCurrency: tx.targetCurrency ? String(tx.targetCurrency) : null, receivedAmount: num(tx.receivedAmount), createdAt: now, deletedAt: null },
              String(r.currency),
            ),
            receivedCurrency: String(r.currency),
          }
        : null;
      return this.requestView(r, mine ? 'SENT' : 'RECEIVED', byId.get(mine ? r.payerId : r.requesterId) ?? null, settlement);
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
    settlement: { transactionId: string; sentAmount: number; sentCurrency: string; receivedAmount: number; receivedCurrency: string } | null = null,
  ) {
    return {
      id: r.id, direction, status: r.status, amount: num(r.amount), currency: r.currency, note: r.note, settlement,
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
    const [me, cfg, referred, rewards, refCurrency] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: user.id }, select: { referralCode: true } }),
      loadReferralSettings(this.prisma, clientId),
      this.prisma.user.count({ where: { referredById: user.id, clientId } }),
      this.prisma.referralReward.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      referralReferenceCurrency(this.prisma, clientId),
    ]);
    const usable = rewards.filter((r) => r.status === 'AVAILABLE' && r.remaining > 0 && r.expiresAt > now);
    return {
      code: me?.referralCode ?? null,
      program: { active: cfg.isActive, refereeWaivers: cfg.refereeWaivers, referrerWaivers: cfg.referrerWaivers, validityDays: cfg.rewardValidityDays, minFirstTransfer: cfg.minFirstTransfer, minFirstTransferCurrency: refCurrency },
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

  /** Réglages + devise dans laquelle s'exprime le premier envoi minimal (devise principale de la société). */
  private async settingsWithCurrency(clientId: number) {
    const [settings, minFirstTransferCurrency] = await Promise.all([loadReferralSettings(this.prisma, clientId), referralReferenceCurrency(this.prisma, clientId)]);
    return { ...settings, minFirstTransferCurrency };
  }

  async getReferralConfig(user: AuthUserPayload) {
    return this.settingsWithCurrency(this.companyOf(user));
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
    return { ...next, minFirstTransferCurrency: await referralReferenceCurrency(this.prisma, clientId) };
  }

  async referralStats(user: AuthUserPayload) {
    const clientId = this.companyOf(user);
    const now = new Date();
    const monthStart = startOfMonthUtc(now);
    const [config, referredTotal, referredMonth, rewardsByStatus, top, freeUsed] = await Promise.all([
      this.settingsWithCurrency(clientId),
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
