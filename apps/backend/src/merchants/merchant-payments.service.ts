// apps/backend/src/merchants/merchant-payments.service.ts
// =========================================================
// ENCAISSEMENTS (lot 11) — un marchand fait payer un client, par numéro de téléphone ou par QR code.
//
//   PHONE  Le marchand saisit le numéro du client et le montant. Le client reçoit la demande (notification + liste « À payer »),
//          vérifie le montant, saisit son code secret : il est débité, le marchand est crédité.
//   QR     Le marchand affiche un QR code pour un montant. Le client le scanne avec l'appareil photo de l'application, vérifie le
//          montant, saisit son code secret. Le premier client qui paie solde la demande ; le QR est à usage unique.
//
//   Marchand → marchand : un marchand est aussi un client, il paie un autre marchand exactement de la même façon.
//
// Sécurité et argent
//   • Le règlement est UNE transaction SQL : prise de la demande (PENDING → PAID, atomique), opération, débit du client, crédit du
//     marchand (montant − commission), crédit de la société (commission). Tout réussit ou rien n'est écrit : deux clients qui scannent
//     le même QR ne paient jamais deux fois, un double appui ne débite qu'une fois.
//   • Code secret vérifié à chaque paiement (5 erreurs → 30 min de blocage), identité vérifiée (KYC) exigée du payeur.
//   • Montants, commission et durée de validité sont figés à la création, d'après les réglages de la société.
//   • Solde insuffisant : rien n'est débité, la demande reste ouverte (le client peut recharger puis payer).
// =========================================================

import { BadRequestException, ConflictException, ForbiddenException, GoneException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, type PaymentRequest } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { normalizePhoneStrict, PHONE_INVALID_MESSAGE } from '../common/utils/phone.util';
import { KycGuardService } from '../kyc/kyc-guard.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import type { CreatePhonePaymentDto, CreateQrPaymentDto } from './dto/merchants.dto';
import { formatMoney, MerchantNotifierService } from './merchant-notifier.service';
import {
  assertValidAmount,
  assertWithinBounds,
  buildQrPayload,
  computeExpiry,
  computeFee,
  generateQrToken,
  generateReference,
  isExpired,
  MAX_PENDING_PER_MERCHANT,
  MAX_PENDING_PER_PAYER,
  parseQrPayload,
  secondsLeft,
} from './merchant-rules';
import { MerchantsService } from './merchants.service';
import { PinVerifierService } from './pin-verifier.service';

export const PAYMENT_EXPIRED_CODE = 'PAYMENT_EXPIRED';
export const PAYMENT_CLOSED_CODE = 'PAYMENT_CLOSED';

const personName = (u: { firstName?: string | null; lastName?: string | null; email?: string | null } | null | undefined): string => {
  if (!u) return 'Client';
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.email || 'Client';
};
/** « Mamadou D. » — assez pour reconnaître la personne, sans exposer son identité complète à un tiers. */
const shortName = (u: { firstName?: string | null; lastName?: string | null } | null | undefined): string => {
  const first = (u?.firstName ?? '').trim();
  const last = (u?.lastName ?? '').trim();
  return [first, last ? `${last[0].toUpperCase()}.` : ''].filter(Boolean).join(' ') || 'Client';
};

const ACTOR_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  kycLevel: true,
  clientId: true,
  isActive: true,
  isSuspended: true,
  deletedAt: true,
  primaryCurrency: true,
} as const;
type Actor = Prisma.UserGetPayload<{ select: typeof ACTOR_SELECT }>;

type RequestWithParties = PaymentRequest & {
  payee: { id: string; firstName: string | null; lastName: string | null; email: string; merchantProfile: { businessName: string; city: string | null; category: string | null; status: string } | null };
  payer: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
};

const INCLUDE = {
  payee: { select: { id: true, firstName: true, lastName: true, email: true, merchantProfile: { select: { businessName: true, city: true, category: true, status: true } } } },
  payer: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.PaymentRequestInclude;

@Injectable()
export class MerchantPaymentsService {
  private readonly logger = new Logger(MerchantPaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletsService,
    private readonly kyc: KycGuardService,
    private readonly pins: PinVerifierService,
    private readonly merchants: MerchantsService,
    private readonly notifier: MerchantNotifierService,
  ) {}

  // ── Utilitaires ────────────────────────────────────────

  private async actor(userId: string): Promise<Actor> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: ACTOR_SELECT });
    if (!u || !u.clientId || u.deletedAt || !u.isActive || u.isSuspended) throw new ForbiddenException('Compte indisponible.');
    return u;
  }

  private async audit(userId: string, clientId: number, action: 'MERCHANT_PAYMENT', entityId: string, details: Record<string, unknown>, successful = true) {
    try {
      await this.prisma.auditLog.create({ data: { userId, clientId, action, entity: 'PaymentRequest', entityId, details: details as Prisma.InputJsonValue, successful } });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (${action}, ${entityId}) : ${(err as Error).message}`);
    }
  }

  private businessOf(r: RequestWithParties): string {
    return r.payee.merchantProfile?.businessName ?? personName(r.payee);
  }

  /** Vue renvoyée à l'application. Le numéro et l'identité du payeur ne sont montrés qu'au marchand concerné. */
  private view(r: RequestWithParties, viewerId: string, now = new Date()) {
    const isPayee = r.payeeId === viewerId;
    const pending = r.status === 'PENDING';
    return {
      id: r.id,
      reference: r.reference,
      method: r.method,
      status: pending && isExpired(r.expiresAt, now) ? 'EXPIRED' : r.status,
      amount: Number(r.amount),
      fee: isPayee ? Number(r.fee) : undefined,
      netAmount: isPayee ? Number(r.netAmount) : undefined,
      currency: r.currency,
      note: r.note,
      merchant: { id: r.payee.id, businessName: this.businessOf(r), city: r.payee.merchantProfile?.city ?? null, category: r.payee.merchantProfile?.category ?? null },
      payer: r.payer ? { id: r.payer.id, name: isPayee ? personName(r.payer) : 'Vous' } : null,
      payerPhone: isPayee ? r.payerPhone : undefined,
      qrPayload: isPayee && r.method === 'QR' && pending && r.qrToken ? buildQrPayload(r.qrToken) : undefined,
      expiresAt: r.expiresAt.toISOString(),
      secondsLeft: pending ? secondsLeft(r.expiresAt, now) : 0,
      createdAt: r.createdAt.toISOString(),
      paidAt: r.paidAt ? r.paidAt.toISOString() : null,
      failureReason: r.failureReason,
      isMine: isPayee ? 'PAYEE' : 'PAYER',
    };
  }

  private async load(where: Prisma.PaymentRequestWhereInput): Promise<RequestWithParties | null> {
    return this.prisma.paymentRequest.findFirst({ where, include: INCLUDE }) as Promise<RequestWithParties | null>;
  }

  /** Passe une demande échue à EXPIRED (une seule fois) et prévient les deux parties. Renvoie true si c'est ce passage qui l'a fermée. */
  private async expireOne(r: RequestWithParties): Promise<boolean> {
    const done = await this.prisma.paymentRequest.updateMany({
      where: { id: r.id, status: 'PENDING', expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED', failureReason: 'Demande expirée' },
    });
    if (done.count === 0) return false;
    const amount = formatMoney(r.amount, r.currency);
    await this.notifier.notifyUser(r.payee, {
      kind: 'PAYMENT_EXPIRED',
      title: 'Demande de paiement expirée',
      body: `La demande de ${amount} (${r.reference}) n'a pas été payée à temps.`,
      actionUrl: `/merchant/payment?id=${r.id}`,
      actionLabel: 'Encaissements',
      type: 'WARNING',
    });
    if (r.payerId && r.method === 'PHONE') {
      await this.notifier.notifyUser(
        { id: r.payerId, email: null },
        { kind: 'PAYMENT_EXPIRED', title: 'Demande de paiement expirée', body: `La demande de ${amount} de ${this.businessOf(r)} a expiré.`, actionUrl: '/pay/requests', actionLabel: 'À payer', type: 'INFO' },
      );
    }
    return true;
  }

  /** Balayage planifié : ferme les demandes échues. */
  async sweepExpired(limit = 200): Promise<number> {
    const rows = (await this.prisma.paymentRequest.findMany({
      where: { status: 'PENDING', expiresAt: { lte: new Date() } },
      include: INCLUDE,
      orderBy: { expiresAt: 'asc' },
      take: limit,
    })) as RequestWithParties[];
    let n = 0;
    for (const r of rows) if (await this.expireOne(r)) n++;
    return n;
  }

  // ── Création (marchand) ────────────────────────────────

  private async prepare(user: AuthUserPayload, amountRaw: unknown, currencyRaw: string | undefined, kind: 'PHONE' | 'QR') {
    const merchantUser = await this.actor(user.id);
    const { profile, settings } = await this.merchants.assertActiveMerchant(user.id);
    const currency = currencyRaw ?? merchantUser.primaryCurrency;
    const amount = assertValidAmount(amountRaw, currency);
    assertWithinBounds(amount, currency, { min: settings.minPayment[currency], max: settings.maxPayment[currency] });

    const pending = await this.prisma.paymentRequest.count({ where: { payeeId: user.id, status: 'PENDING', expiresAt: { gt: new Date() } } });
    if (pending >= MAX_PENDING_PER_MERCHANT) {
      throw new BadRequestException(`Trop de demandes en attente (${MAX_PENDING_PER_MERCHANT}). Annulez-en ou attendez qu'elles expirent.`);
    }
    const now = new Date();
    const { fee, net } = computeFee(amount, settings.paymentFeePct, currency);
    return { merchantUser, profile, currency, amount, fee, net, expiresAt: computeExpiry(kind, settings, now), now };
  }

  /** Le marchand adresse la demande à un client par son numéro de téléphone. */
  async createPhoneRequest(user: AuthUserPayload, dto: CreatePhonePaymentDto) {
    const p = await this.prepare(user, dto.amount, dto.currency, 'PHONE');
    const phone = normalizePhoneStrict(dto.payerPhone);
    if (!phone) throw new BadRequestException(PHONE_INVALID_MESSAGE);

    const payer = await this.prisma.user.findFirst({
      where: { phone, clientId: p.merchantUser.clientId!, role: 'USER', isActive: true, isSuspended: false, deletedAt: null },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (!payer) throw new NotFoundException("Aucun client Direct Transf'air avec ce numéro. Vérifiez-le, ou proposez le paiement par QR code.");
    if (payer.id === user.id) throw new BadRequestException('Vous ne pouvez pas vous adresser une demande à vous-même.');

    // Double appui sur « Envoyer » : la même demande, encore ouverte, est renvoyée au lieu d'en créer une seconde.
    const duplicate = await this.load({
      payeeId: user.id,
      payerId: payer.id,
      method: 'PHONE',
      status: 'PENDING',
      amount: p.amount,
      currency: p.currency as never,
      expiresAt: { gt: p.now },
      createdAt: { gt: new Date(p.now.getTime() - 60_000) },
    });
    if (duplicate) return this.view(duplicate, user.id, p.now);

    const waiting = await this.prisma.paymentRequest.count({ where: { payerId: payer.id, status: 'PENDING', expiresAt: { gt: p.now } } });
    if (waiting >= MAX_PENDING_PER_PAYER) throw new BadRequestException('Ce client a déjà beaucoup de demandes en attente. Réessayez plus tard.');

    const created = await this.prisma.paymentRequest.create({
      data: {
        reference: generateReference('PAYMENT', p.now),
        clientId: p.merchantUser.clientId!,
        payeeId: user.id,
        payerId: payer.id,
        payerPhone: phone,
        method: 'PHONE',
        amount: p.amount,
        fee: p.fee,
        netAmount: p.net,
        currency: p.currency as never,
        note: dto.note?.trim() || null,
        expiresAt: p.expiresAt,
      },
      include: INCLUDE,
    });
    const r = created as RequestWithParties;
    await this.audit(user.id, r.clientId, 'MERCHANT_PAYMENT', r.id, { step: 'REQUEST', method: 'PHONE', amount: p.amount, currency: p.currency });

    await this.notifier.notifyUser(payer, {
      kind: 'PAYMENT_REQUEST',
      title: `${p.profile.businessName} vous demande ${formatMoney(p.amount, p.currency)}`,
      body: `Ouvrez la demande, vérifiez le montant puis confirmez avec votre code secret. Valable ${Math.round((p.expiresAt.getTime() - p.now.getTime()) / 60_000)} min.`,
      actionUrl: `/pay/request?id=${r.id}`,
      actionLabel: 'À payer',
      type: 'INFO',
    });
    // Le marchand reconnaît la personne visée (« Mamadou D. ») sans que son identité complète ne soit exposée.
    const view = this.view(r, user.id, p.now);
    return { ...view, payer: { id: payer.id, name: shortName(payer) } };
  }

  /** Le marchand affiche un QR code pour un montant. */
  async createQrRequest(user: AuthUserPayload, dto: CreateQrPaymentDto) {
    const p = await this.prepare(user, dto.amount, dto.currency, 'QR');
    const created = await this.prisma.paymentRequest.create({
      data: {
        reference: generateReference('PAYMENT', p.now),
        clientId: p.merchantUser.clientId!,
        payeeId: user.id,
        method: 'QR',
        qrToken: generateQrToken(),
        amount: p.amount,
        fee: p.fee,
        netAmount: p.net,
        currency: p.currency as never,
        note: dto.note?.trim() || null,
        expiresAt: p.expiresAt,
      },
      include: INCLUDE,
    });
    const r = created as RequestWithParties;
    await this.audit(user.id, r.clientId, 'MERCHANT_PAYMENT', r.id, { step: 'REQUEST', method: 'QR', amount: p.amount, currency: p.currency });
    return this.view(r, user.id, p.now);
  }

  // ── Lecture ────────────────────────────────────────────

  /** Suivi d'une demande (marchand ou payeur) — l'application l'interroge toutes les 2 s tant que le QR est affiché. */
  async getOne(user: AuthUserPayload, id: string) {
    const r = await this.load({ id, clientId: user.clientId, OR: [{ payeeId: user.id }, { payerId: user.id }] });
    if (!r) throw new NotFoundException('Demande introuvable.');
    if (r.status === 'PENDING' && isExpired(r.expiresAt, new Date())) await this.expireOne(r);
    const fresh = (await this.load({ id })) ?? r;
    return this.view(fresh, user.id);
  }

  /** Aperçu d'un QR code scanné : qui encaisse, combien — avant toute saisie du code secret. */
  async previewQr(user: AuthUserPayload, raw: string) {
    const token = parseQrPayload(raw);
    if (!token) throw new BadRequestException("Ce QR code n'est pas un QR de paiement Direct Transf'air.");
    const r = await this.load({ qrToken: token, clientId: user.clientId });
    if (!r) throw new NotFoundException('QR code inconnu ou non valable pour votre société.');
    if (r.payeeId === user.id) throw new BadRequestException('Vous ne pouvez pas payer votre propre QR code.');
    if (r.status === 'PENDING' && isExpired(r.expiresAt, new Date())) await this.expireOne(r);
    const fresh = (await this.load({ id: r.id })) ?? r;
    this.assertOpen(fresh);
    return this.view(fresh, user.id);
  }

  /** Demandes qui attendent mon paiement (méthode PHONE). */
  async incoming(user: AuthUserPayload) {
    const now = new Date();
    const rows = (await this.prisma.paymentRequest.findMany({
      where: { payerId: user.id, method: 'PHONE', status: 'PENDING', expiresAt: { gt: now } },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })) as RequestWithParties[];
    return { data: rows.map((r) => this.view(r, user.id, now)) };
  }

  /** Historique des encaissements du marchand. */
  async listMine(user: AuthUserPayload, q: { status?: string; page?: number; limit?: number }) {
    await this.merchants.assertActiveMerchant(user.id);
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(Math.max(1, q.limit ?? 20), 100);
    const now = new Date();
    const status = ['PENDING', 'PAID', 'DECLINED', 'EXPIRED', 'CANCELLED'].includes(q.status ?? '') ? (q.status as PaymentRequest['status']) : undefined;
    const where: Prisma.PaymentRequestWhereInput = {
      payeeId: user.id,
      ...(status === 'PENDING' ? { status, expiresAt: { gt: now } } : status === 'EXPIRED' ? { OR: [{ status: 'EXPIRED' }, { status: 'PENDING', expiresAt: { lte: now } }] } : status ? { status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.paymentRequest.findMany({ where, include: INCLUDE, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.paymentRequest.count({ where }),
    ]);
    return { data: (rows as RequestWithParties[]).map((r) => this.view(r, user.id, now)), meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) } };
  }

  // ── Paiement (client ou marchand-payeur) ───────────────

  private assertOpen(r: RequestWithParties): void {
    if (r.status === 'PENDING' && !isExpired(r.expiresAt, new Date())) return;
    const status = r.status === 'PENDING' ? 'EXPIRED' : r.status;
    const message: Record<string, string> = {
      PAID: 'Cette demande est déjà payée.',
      DECLINED: 'Cette demande a été refusée.',
      EXPIRED: 'Cette demande a expiré. Demandez au marchand d’en créer une nouvelle.',
      CANCELLED: 'Cette demande a été annulée par le marchand.',
    };
    if (status === 'EXPIRED') throw new GoneException({ statusCode: 410, code: PAYMENT_EXPIRED_CODE, message: message.EXPIRED });
    throw new ConflictException({ statusCode: 409, code: PAYMENT_CLOSED_CODE, status, message: message[status] ?? 'Cette demande est close.' });
  }

  /** Payer une demande adressée à mon numéro (PHONE). */
  async payRequest(user: AuthUserPayload, id: string, pin: string) {
    const r = await this.load({ id, clientId: user.clientId });
    if (!r || r.method !== 'PHONE' || r.payerId !== user.id) throw new NotFoundException('Demande introuvable.');
    return this.settle(user, r, pin);
  }

  /** Payer un QR code scanné. */
  async payQr(user: AuthUserPayload, raw: string, pin: string) {
    const token = parseQrPayload(raw);
    if (!token) throw new BadRequestException("Ce QR code n'est pas un QR de paiement Direct Transf'air.");
    const r = await this.load({ qrToken: token, clientId: user.clientId });
    if (!r) throw new NotFoundException('QR code inconnu ou non valable pour votre société.');
    return this.settle(user, r, pin);
  }

  private async settle(user: AuthUserPayload, loaded: RequestWithParties, pin: string) {
    const payer = await this.actor(user.id);
    if (payer.role !== 'USER') throw new ForbiddenException('Seuls les clients peuvent payer.');
    if (loaded.payeeId === payer.id) throw new BadRequestException('Vous ne pouvez pas vous payer vous-même.');
    if (loaded.clientId !== payer.clientId) throw new NotFoundException('Demande introuvable.');

    if (loaded.status === 'PENDING' && isExpired(loaded.expiresAt, new Date())) await this.expireOne(loaded);
    const r = (await this.load({ id: loaded.id })) ?? loaded;
    this.assertOpen(r);
    if (r.payee.merchantProfile?.status !== 'ACTIVE') throw new ConflictException('Ce marchand ne peut plus encaisser pour le moment.');

    await this.kyc.assertVerified({ id: payer.id, role: payer.role, kycLevel: String(payer.kycLevel) });
    await this.pins.assertPin(payer.id, pin);

    const currency = r.currency;
    const amount = Number(r.amount);
    const [payerWallet, merchantWallet, companyWallet] = await Promise.all([
      this.wallets.getOrCreateWallet({ userId: payer.id, currency }),
      this.wallets.getOrCreateWallet({ userId: r.payeeId, currency }),
      Number(r.fee) > 0 ? this.wallets.getOrCreateWallet({ clientId: r.clientId, currency }) : Promise.resolve(null),
    ]);

    let transactionId: string;
    try {
      transactionId = await this.prisma.$transaction(async (tx) => {
        // Prise de la demande : un seul payeur peut passer de PENDING à PAID.
        const claim = await tx.paymentRequest.updateMany({
          where: { id: r.id, status: 'PENDING', expiresAt: { gt: new Date() }, ...(r.method === 'PHONE' ? { payerId: payer.id } : {}) },
          data: { status: 'PAID', payerId: payer.id, paidAt: new Date(), failureReason: null },
        });
        if (claim.count !== 1) throw new ConflictException({ statusCode: 409, code: PAYMENT_CLOSED_CODE, message: 'Cette demande vient d’être payée ou a expiré.' });

        const created = await tx.transaction.create({
          data: {
            reference: r.reference,
            type: 'MERCHANT_PAYMENT',
            direction: 'INTERNAL',
            amount: r.amount,
            fees: 0,
            total: r.amount,
            currency,
            receivedAmount: r.netAmount,
            platformCommission: r.fee,
            status: 'PAID',
            payoutMethod: 'WALLET',
            paymentMethod: 'WALLET',
            senderId: payer.id,
            recipientId: r.payeeId,
            clientId: r.clientId,
            note: r.note ?? `Paiement ${this.businessOf(r)}`,
            paidAt: new Date(),
          },
        });
        const label = this.businessOf(r);
        await this.wallets.debitInTx(tx, payerWallet.id, amount, `Paiement ${label} ${r.reference}`, created.id);
        await this.wallets.creditInTx(tx, merchantWallet.id, Number(r.netAmount), `Encaissement ${r.reference}`, created.id);
        if (companyWallet && Number(r.fee) > 0) {
          await this.wallets.creditInTx(tx, companyWallet.id, Number(r.fee), `Commission encaissement ${r.reference}`, created.id, { allowFrozen: true });
        }
        await tx.paymentRequest.update({ where: { id: r.id }, data: { transactionId: created.id } });
        return created.id;
      });
    } catch (err) {
      await this.onSettleFailure(r, payer, err);
      throw err;
    }

    await this.audit(payer.id, r.clientId, 'MERCHANT_PAYMENT', r.id, { step: 'PAID', method: r.method, amount, fee: Number(r.fee), currency, transactionId });
    const money = formatMoney(r.amount, currency);
    const net = formatMoney(r.netAmount, currency);
    await Promise.all([
      this.notifier.notifyUser(r.payee, {
        kind: 'PAYMENT_RECEIVED',
        title: `Paiement reçu : ${money}`,
        body: `${personName(payer)} vient de vous payer ${money}${Number(r.fee) > 0 ? ` (net ${net} après commission)` : ''}. Réf. ${r.reference}.`,
        actionUrl: `/merchant/payment?id=${r.id}`,
        actionLabel: 'Encaissements',
        type: 'SUCCESS',
        email: true,
      }),
      this.notifier.notifyUser(payer, {
        kind: 'PAYMENT_SENT',
        title: `Paiement effectué : ${money}`,
        body: `Vous avez payé ${money} à ${this.businessOf(r)}. Réf. ${r.reference}.`,
        actionUrl: '/wallet',
        actionLabel: 'Portefeuille',
        type: 'SUCCESS',
        email: true,
      }),
    ]);

    const done = await this.load({ id: r.id });
    return { ...this.view(done ?? r, payer.id), transactionId };
  }

  /** Échec du règlement : journal, et prévenir le payeur (et le marchand une seule fois). Ne lève jamais. */
  private async onSettleFailure(r: RequestWithParties, payer: Actor, err: unknown): Promise<void> {
    try {
      const message = err instanceof Error ? err.message : String(err);
      const insufficient = /solde insuffisant/i.test(message);
      const closed = err instanceof ConflictException || err instanceof GoneException;
      if (closed) return; // déjà payée / expirée : rien à signaler de plus
      await this.audit(payer.id, r.clientId, 'MERCHANT_PAYMENT', r.id, { step: 'FAILED', reason: message }, false);
      const money = formatMoney(r.amount, r.currency);
      await this.notifier.notifyUser(payer, {
        kind: 'PAYMENT_FAILED',
        title: insufficient ? 'Paiement impossible : solde insuffisant' : 'Paiement non effectué',
        body: insufficient
          ? `Rechargez votre portefeuille puis payez à nouveau ${money} à ${this.businessOf(r)} tant que la demande est valable.`
          : `Le paiement de ${money} à ${this.businessOf(r)} n'a pas abouti. Aucun montant n'a été débité.`,
        actionUrl: insufficient ? '/wallet' : '/pay/requests',
        actionLabel: insufficient ? 'Portefeuille' : 'À payer',
        type: 'ERROR',
        email: false,
      });
      if (!r.failureReason) {
        await this.prisma.paymentRequest.updateMany({ where: { id: r.id, status: 'PENDING', failureReason: null }, data: { failureReason: insufficient ? 'Solde insuffisant du client' : 'Paiement non abouti' } });
        await this.notifier.notifyUser(r.payee, {
          kind: 'PAYMENT_FAILED',
          title: 'Paiement non abouti',
          body: `${insufficient ? 'Le solde du client est insuffisant' : 'Le paiement a échoué'} pour la demande de ${money} (${r.reference}). La demande reste ouverte jusqu'à son expiration.`,
          actionUrl: `/merchant/payment?id=${r.id}`,
          actionLabel: 'Encaissements',
          type: 'WARNING',
          email: false,
        });
      }
    } catch (e) {
      this.logger.warn(`Notification d'échec impossible pour ${r.id} : ${(e as Error).message}`);
    }
  }

  // ── Refus / annulation ─────────────────────────────────

  /** Le client refuse une demande reçue par téléphone. */
  async decline(user: AuthUserPayload, id: string) {
    const r = await this.load({ id, clientId: user.clientId, payerId: user.id, method: 'PHONE' });
    if (!r) throw new NotFoundException('Demande introuvable.');
    const done = await this.prisma.paymentRequest.updateMany({
      where: { id, status: 'PENDING', payerId: user.id },
      data: { status: 'DECLINED', declinedAt: new Date(), failureReason: 'Refusée par le client' },
    });
    if (done.count === 0) this.assertOpen((await this.load({ id })) ?? r);
    const payer = r.payer;
    await this.notifier.notifyUser(r.payee, {
      kind: 'PAYMENT_DECLINED',
      title: 'Demande de paiement refusée',
      body: `${payer ? personName(payer) : 'Le client'} a refusé la demande de ${formatMoney(r.amount, r.currency)} (${r.reference}).`,
      actionUrl: `/merchant/payment?id=${r.id}`,
      actionLabel: 'Encaissements',
      type: 'WARNING',
      email: true,
    });
    await this.audit(user.id, r.clientId, 'MERCHANT_PAYMENT', r.id, { step: 'DECLINED' });
    return this.view((await this.load({ id })) ?? r, user.id);
  }

  /** Le marchand annule une demande encore ouverte (QR fermé, erreur de montant). */
  async cancel(user: AuthUserPayload, id: string) {
    const r = await this.load({ id, payeeId: user.id });
    if (!r) throw new NotFoundException('Demande introuvable.');
    const done = await this.prisma.paymentRequest.updateMany({
      where: { id, status: 'PENDING', payeeId: user.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), failureReason: 'Annulée par le marchand' },
    });
    if (done.count === 0) this.assertOpen(r);
    if (r.payerId && r.method === 'PHONE') {
      await this.notifier.notifyUser(
        { id: r.payerId },
        { kind: 'PAYMENT_CANCELLED', title: 'Demande annulée', body: `${this.businessOf(r)} a annulé sa demande de ${formatMoney(r.amount, r.currency)}.`, actionUrl: '/pay/requests', actionLabel: 'À payer', type: 'INFO' },
      );
    }
    await this.audit(user.id, r.clientId, 'MERCHANT_PAYMENT', r.id, { step: 'CANCELLED' });
    return this.view((await this.load({ id })) ?? r, user.id);
  }
}
