// apps/backend/src/merchants/merchant-payouts.service.ts
// =========================================================
// RETRAITS DU MARCHAND (lot 11) — le solde du portefeuille marchand part vers son Orange Money ou son compte bancaire.
//
//   Demande   Code secret + identité vérifiée. Le montant est DÉBITÉ tout de suite (le marchand ne peut pas le dépenser deux fois),
//             une opération MERCHANT_PAYOUT « en attente » est créée, la destination est figée dans la demande.
//             Refusé pendant le délai de sécurité qui suit un changement de numéro / de compte bancaire.
//   Traitement
//     MANUAL   (défaut, production)  l'administrateur envoie l'argent hors plateforme (Orange Money / virement) puis clique « Payé »
//                                    avec la référence de l'opérateur, ou « Refuser » avec un motif : le montant est alors recrédité.
//     SANDBOX  (essais uniquement)   payé automatiquement. Jamais appliqué en production (voir effectivePayoutMode).
//   La commission de retrait est versée à la société quand le retrait est PAYÉ — jamais sur un retrait refusé.
//   Chaque transition est atomique (PENDING → PAID/REJECTED/FAILED en une seule prise) : un double clic ne paie ni ne recrédite deux fois.
// =========================================================

import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, type MerchantPayout } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { KycGuardService } from '../kyc/kyc-guard.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import type { MarkPayoutPaidDto, RejectPayoutDto, RequestPayoutDto } from './dto/merchants.dto';
import { MerchantAlertsService } from './merchant-alerts.service';
import { formatMoney, MerchantNotifierService } from './merchant-notifier.service';
import {
  assertValidAmount,
  assertWithinBounds,
  availablePayoutMethods,
  computeFee,
  effectivePayoutMode,
  generateReference,
  maskIban,
  maskPhone,
  payoutCooldown,
  isOrangePhoneConsistent,
  ORANGE_COUNTRY_MISMATCH_CODE,
} from './merchant-rules';
import { MerchantsService } from './merchants.service';
import { PinVerifierService } from './pin-verifier.service';

export const PAYOUT_LOCKED_CODE = 'PAYOUT_LOCKED';
const MAX_PENDING_PAYOUTS = 5;

type PayoutWithUser = MerchantPayout & { user: { id: string; email: string; firstName: string | null; lastName: string | null; phone: string | null; merchantProfile: { businessName: string } | null } };
const INCLUDE = { user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, merchantProfile: { select: { businessName: true } } } } } satisfies Prisma.MerchantPayoutInclude;

@Injectable()
export class MerchantPayoutsService {
  private readonly logger = new Logger(MerchantPayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletsService,
    private readonly kyc: KycGuardService,
    private readonly pins: PinVerifierService,
    private readonly merchants: MerchantsService,
    private readonly notifier: MerchantNotifierService,
    private readonly alerts: MerchantAlertsService,
  ) {}

  private async audit(userId: string, clientId: number, action: 'MERCHANT_PAYOUT_REQUEST' | 'MERCHANT_PAYOUT_PROCESS', entityId: string, details: Record<string, unknown>) {
    try {
      await this.prisma.auditLog.create({ data: { userId, clientId, action, entity: 'MerchantPayout', entityId, details: details as Prisma.InputJsonValue, successful: true } });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (${action}, ${entityId}) : ${(err as Error).message}`);
    }
  }

  /** Vue marchand : la destination est masquée. */
  private view(p: MerchantPayout) {
    return {
      id: p.id,
      reference: p.reference,
      method: p.method,
      status: p.status,
      amount: Number(p.amount),
      fee: Number(p.fee),
      netAmount: Number(p.netAmount),
      currency: p.currency,
      destination: p.method === 'ORANGE_MONEY' ? maskPhone(p.destination) : maskIban(p.destination),
      destinationLabel: p.destinationLabel,
      providerRef: p.providerRef,
      failureReason: p.failureReason,
      createdAt: p.createdAt.toISOString(),
      processedAt: p.processedAt ? p.processedAt.toISOString() : null,
    };
  }

  // ── Marchand ───────────────────────────────────────────

  async request(user: AuthUserPayload, dto: RequestPayoutDto) {
    const me = await this.prisma.user.findUnique({ where: { id: user.id }, select: { id: true, role: true, kycLevel: true, clientId: true, primaryCurrency: true, email: true, firstName: true, isActive: true, isSuspended: true, deletedAt: true } });
    if (!me || !me.clientId || me.deletedAt || !me.isActive || me.isSuspended) throw new ForbiddenException('Compte indisponible.');
    const { profile, settings } = await this.merchants.assertActiveMerchant(user.id);

    await this.kyc.assertVerified({ id: me.id, role: me.role, kycLevel: String(me.kycLevel) });
    await this.pins.assertPin(user.id, dto.pin);

    const now = new Date();
    const methods = availablePayoutMethods(settings.payoutMethods, profile, String(me.primaryCurrency));
    if (!methods.includes(dto.method)) {
      throw new BadRequestException(
        settings.payoutMethods.includes(dto.method) ? 'Renseignez cette destination (numéro Orange Money ou compte bancaire) dans vos réglages marchand.' : "Ce moyen de retrait n'est pas ouvert.",
      );
    }
    const cooldown = payoutCooldown(profile.destinationChangedAt, settings.payoutCooldownHours, now);
    if (cooldown.active) {
      throw new ForbiddenException({
        statusCode: 403,
        code: PAYOUT_LOCKED_CODE,
        until: cooldown.until!.toISOString(),
        message: `Par sécurité, les retraits sont suspendus jusqu'au ${cooldown.until!.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} (suite à la modification de votre destination).`,
      });
    }

    const currency = dto.currency ?? me.primaryCurrency;
    const amount = assertValidAmount(dto.amount, currency);
    assertWithinBounds(amount, currency, { min: settings.minPayout[currency] }, 'retrait');
    const { fee, net } = computeFee(amount, settings.payoutFeePct, currency);
    if (net <= 0) throw new BadRequestException('Montant trop faible après commission.');

    const pending = await this.prisma.merchantPayout.count({ where: { userId: user.id, status: 'PENDING' } });
    if (pending >= MAX_PENDING_PAYOUTS) throw new BadRequestException('Vous avez déjà plusieurs retraits en cours de traitement. Attendez leur confirmation.');

    // Anciens comptes : un numéro Orange Money d'un autre pays que la devise (ex. numéro guinéen sur un compte en euros) ne reçoit plus de retrait.
    if (dto.method === 'ORANGE_MONEY' && !isOrangePhoneConsistent(profile.orangeMoneyPhone, currency)) {
      throw new ConflictException({
        statusCode: 409,
        code: ORANGE_COUNTRY_MISMATCH_CODE,
        message: `Le numéro Orange Money enregistré ne correspond pas à la devise de votre compte (${currency}). Modifiez la destination de vos retraits dans les réglages du commerce.`,
      });
    }
    const destination = dto.method === 'ORANGE_MONEY' ? profile.orangeMoneyPhone! : profile.bankIban!;
    const label = dto.method === 'ORANGE_MONEY' ? 'Orange Money' : (profile.bankHolderName ?? 'Compte bancaire');
    // Le retrait se prend sur le portefeuille PROPRE du commerce (et non sur le portefeuille personnel du client).
    const wallet = await this.wallets.getOrCreateWallet({ merchantId: profile.id, currency });
    const reference = generateReference('PAYOUT', now);

    const payout = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          reference,
          type: 'MERCHANT_PAYOUT',
          direction: 'OUTBOUND',
          amount,
          fees: 0,
          total: amount,
          currency: currency as never,
          receivedAmount: net,
          platformCommission: fee,
          status: 'PENDING',
          payoutMethod: dto.method === 'ORANGE_MONEY' ? 'MOBILE_MONEY' : 'IBAN_TRANSFER',
          paymentMethod: 'WALLET',
          senderId: user.id,
          clientId: me.clientId!,
          note: `Retrait marchand vers ${label}`,
        },
      });
      // Le débit prend le verrou du portefeuille : solde insuffisant ⇒ erreur, rien n'est écrit.
      await this.wallets.debitInTx(tx, wallet.id, amount, `Retrait ${reference}`, created.id);
      return tx.merchantPayout.create({
        data: {
          reference,
          clientId: me.clientId!,
          userId: user.id,
          method: dto.method,
          amount,
          fee,
          netAmount: net,
          currency: currency as never,
          destination,
          destinationLabel: label,
          transactionId: created.id,
        },
      });
    });
    await this.audit(user.id, me.clientId, 'MERCHANT_PAYOUT_REQUEST', payout.id, { amount, fee, currency, method: dto.method });
    // Le retrait vient de baisser le solde du commerce : alerte « solde bas » si le seuil choisi est franchi.
    await this.alerts.onBalanceChanged(profile.id, currency);

    const money = formatMoney(amount, currency);
    const mode = effectivePayoutMode(settings.payoutMode);
    if (mode === 'SANDBOX') {
      await this.complete(payout.id, { processedById: null, providerRef: `SANDBOX-${payout.reference}` });
    } else {
      await this.notifier.notifyUser(me, {
        kind: 'PAYOUT_REQUESTED',
        title: 'Retrait en cours de traitement',
        body: `Votre retrait de ${money} vers ${label} (${dto.method === 'ORANGE_MONEY' ? maskPhone(destination) : maskIban(destination)}) est enregistré. Vous serez prévenu dès qu'il est envoyé.`,
        actionUrl: '/merchant/payouts',
        actionLabel: 'Retraits',
        type: 'INFO',
      });
      await this.notifyAdmins(me.clientId, {
        title: 'Retrait marchand à traiter',
        body: `${profile.businessName} demande ${money} vers ${label}. Réf. ${payout.reference}.`,
      });
    }
    return this.view((await this.prisma.merchantPayout.findUnique({ where: { id: payout.id } })) ?? payout);
  }

  async listMine(user: AuthUserPayload, q: { page?: number; limit?: number }) {
    await this.merchants.assertActiveMerchant(user.id);
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(Math.max(1, q.limit ?? 20), 100);
    const [rows, total] = await Promise.all([
      this.prisma.merchantPayout.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.merchantPayout.count({ where: { userId: user.id } }),
    ]);
    return { data: rows.map((r) => this.view(r)), meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) } };
  }

  // ── Administrateur ─────────────────────────────────────

  private scope(actor: AuthUserPayload, clientId?: number): number {
    if (actor.role === 'SUPER_ADMIN') {
      if (!clientId) throw new BadRequestException('Précisez la société (clientId).');
      return clientId;
    }
    if (!actor.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    return actor.clientId;
  }

  async listAdmin(actor: AuthUserPayload, q: { status?: string; page?: number; limit?: number; clientId?: number }) {
    const clientId = this.scope(actor, q.clientId);
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(Math.max(1, q.limit ?? 20), 100);
    const status = ['PENDING', 'PAID', 'REJECTED', 'FAILED'].includes(q.status ?? '') ? (q.status as MerchantPayout['status']) : undefined;
    const where: Prisma.MerchantPayoutWhereInput = { clientId, ...(status ? { status } : {}) };
    const [rows, total, pending] = await Promise.all([
      this.prisma.merchantPayout.findMany({ where, include: INCLUDE, orderBy: status === 'PENDING' ? { createdAt: 'asc' } : { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.merchantPayout.count({ where }),
      this.prisma.merchantPayout.count({ where: { clientId, status: 'PENDING' } }),
    ]);
    return {
      data: (rows as PayoutWithUser[]).map((r) => ({
        ...this.view(r),
        // L'administrateur doit voir la vraie destination pour envoyer l'argent.
        destination: r.destination,
        merchant: { userId: r.userId, businessName: r.user.merchantProfile?.businessName ?? null, name: [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') || r.user.email, phone: r.user.phone },
      })),
      meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
      pendingCount: pending,
    };
  }

  /** L'administrateur confirme avoir envoyé l'argent. */
  async markPaid(actor: AuthUserPayload, id: string, dto: MarkPayoutPaidDto, clientIdParam?: number) {
    const clientId = this.scope(actor, clientIdParam);
    const p = await this.prisma.merchantPayout.findFirst({ where: { id, clientId }, select: { id: true } });
    if (!p) throw new NotFoundException('Retrait introuvable.');
    return this.complete(id, { processedById: actor.id, providerRef: dto.providerRef?.trim() || null });
  }

  /** L'administrateur refuse : le montant est recrédité au marchand. */
  async reject(actor: AuthUserPayload, id: string, dto: RejectPayoutDto, clientIdParam?: number) {
    const clientId = this.scope(actor, clientIdParam);
    const p = await this.prisma.merchantPayout.findFirst({ where: { id, clientId }, select: { id: true } });
    if (!p) throw new NotFoundException('Retrait introuvable.');
    return this.refund(id, 'REJECTED', dto.reason.trim(), actor.id);
  }

  // ── Transitions (atomiques) ────────────────────────────

  private async complete(id: string, by: { processedById: string | null; providerRef: string | null }) {
    const before = await this.prisma.merchantPayout.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Retrait introuvable.');
    if (before.status !== 'PENDING') throw new ConflictException('Ce retrait a déjà été traité.');
    // Portefeuille de la société résolu avant la transaction (sa création ne doit pas dépendre d'elle).
    const company = Number(before.fee) > 0 ? await this.wallets.getOrCreateWallet({ clientId: before.clientId, currency: before.currency }) : null;
    const payout = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.merchantPayout.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'PAID', processedAt: new Date(), processedById: by.processedById, providerRef: by.providerRef },
      });
      if (claim.count !== 1) throw new ConflictException('Ce retrait a déjà été traité.');
      const p = await tx.merchantPayout.findUniqueOrThrow({ where: { id } });
      if (p.transactionId) await tx.transaction.update({ where: { id: p.transactionId }, data: { status: 'PAID', paidAt: new Date() } });
      if (company && Number(p.fee) > 0) {
        await this.wallets.creditInTx(tx, company.id, Number(p.fee), `Commission retrait ${p.reference}`, p.transactionId ?? undefined, { allowFrozen: true });
      }
      return p;
    });
    await this.audit(by.processedById ?? payout.userId, payout.clientId, 'MERCHANT_PAYOUT_PROCESS', payout.id, { outcome: 'PAID', providerRef: by.providerRef });
    const user = await this.prisma.user.findUnique({ where: { id: payout.userId }, select: { id: true, email: true, firstName: true } });
    if (user) {
      await this.notifier.notifyUser(user, {
        kind: 'PAYOUT_PAID',
        title: 'Retrait envoyé',
        body: `${formatMoney(payout.netAmount, payout.currency)} ont été envoyés vers ${payout.method === 'ORANGE_MONEY' ? `l'Orange Money ${maskPhone(payout.destination)}` : `le compte ${maskIban(payout.destination)}`}. Réf. ${payout.reference}.`,
        actionUrl: '/merchant/payouts',
        actionLabel: 'Retraits',
        type: 'SUCCESS',
        email: true,
      });
    }
    return this.view(payout);
  }

  /** Retrait refusé ou en échec : recrédit intégral (commission comprise, elle n'a jamais été prélevée). */
  async refund(id: string, outcome: 'REJECTED' | 'FAILED', reason: string, processedById: string | null) {
    const before = await this.prisma.merchantPayout.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Retrait introuvable.');
    if (before.status !== 'PENDING') throw new ConflictException('Ce retrait a déjà été traité.');
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { userId: before.userId }, select: { id: true } });
    if (!merchant) throw new NotFoundException('Compte marchand introuvable.');
    const wallet = await this.wallets.getOrCreateWallet({ merchantId: merchant.id, currency: before.currency });
    const payout = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.merchantPayout.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: outcome, processedAt: new Date(), processedById, failureReason: reason },
      });
      if (claim.count !== 1) throw new ConflictException('Ce retrait a déjà été traité.');
      const p = await tx.merchantPayout.findUniqueOrThrow({ where: { id } });
      // allowFrozen : un portefeuille gelé entre-temps ne doit pas empêcher de rendre son argent au marchand.
      await this.wallets.creditInTx(tx, wallet.id, Number(p.amount), `Retrait ${p.reference} ${outcome === 'REJECTED' ? 'refusé' : 'échoué'} — remboursement`, p.transactionId ?? undefined, { allowFrozen: true });
      if (p.transactionId) await tx.transaction.update({ where: { id: p.transactionId }, data: { status: outcome === 'REJECTED' ? 'CANCELLED' : 'FAILED' } });
      return p;
    });
    await this.audit(processedById ?? payout.userId, payout.clientId, 'MERCHANT_PAYOUT_PROCESS', payout.id, { outcome, reason });
    await this.alerts.onBalanceChanged(merchant.id, payout.currency); // le recrédit remonte le solde : réarme l'alerte « solde bas »
    const user = await this.prisma.user.findUnique({ where: { id: payout.userId }, select: { id: true, email: true, firstName: true } });
    if (user) {
      await this.notifier.notifyUser(user, {
        kind: outcome === 'REJECTED' ? 'PAYOUT_REJECTED' : 'PAYOUT_FAILED',
        title: outcome === 'REJECTED' ? 'Retrait refusé' : 'Retrait non abouti',
        body: `Votre retrait de ${formatMoney(payout.amount, payout.currency)} (${payout.reference}) n'a pas pu être effectué : ${reason}. Le montant a été remis sur votre portefeuille.`,
        actionUrl: '/merchant/payouts',
        actionLabel: 'Retraits',
        type: 'ERROR',
        email: true,
      });
    }
    return this.view(payout);
  }

  private async notifyAdmins(clientId: number, m: { title: string; body: string }): Promise<void> {
    try {
      const admins = await this.prisma.user.findMany({
        where: { clientId, role: 'COMPANY_ADMIN', isActive: true, isSuspended: false, deletedAt: null },
        select: { id: true, email: true, firstName: true },
      });
      for (const a of admins) await this.notifier.notifyUser(a, { kind: 'PAYOUT_PENDING_ADMIN', title: m.title, body: m.body, actionUrl: '/merchants/payouts', type: 'INFO', email: false });
    } catch (err) {
      this.logger.warn(`Prévenir les administrateurs impossible : ${(err as Error).message}`);
    }
  }
}
