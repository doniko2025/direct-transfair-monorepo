// apps/backend/src/merchants/merchant-payments.service.ts
// =========================================================
// ENCAISSEMENTS (lot 11) — un marchand fait payer un client, par numéro de téléphone ou par QR code.
//
//   PHONE  Le marchand saisit le numéro du client et le montant. Le client reçoit la demande (notification + liste « À payer »),
//          vérifie le montant, saisit son code secret : il est débité, le marchand est crédité.
//   QR     Le marchand affiche un QR code pour un montant. Le client le scanne avec l'appareil photo de l'application, vérifie le
//          montant, saisit son code secret. Le premier client qui paie solde la demande ; le QR est à usage unique.
//
//   QR DE CAISSE (permanent) Le commerce affiche un QR fixe ; le client le scanne, SAISIT le montant, valide avec son code secret. Une demande
//          est créée à la volée puis réglée dans la même opération (et fermée si le règlement échoue : aucune demande orpheline).
//   CAISSIERS Un caissier (voir merchant-staff.service) crée des demandes POUR le commerce : le propriétaire est encaissé, la demande garde
//          le caissier (`createdById`) pour le suivi et l'export.
//   REMBOURSEMENT Le propriétaire (ou un caissier autorisé) rend un paiement au client : en une transaction SQL, le portefeuille du
//          commerce est débité du montant payé par le client, le client est recrédité, la demande est marquée remboursée (une seule fois).
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
import type { CreatePhonePaymentDto, CreateQrPaymentDto, RefundPaymentDto } from './dto/merchants.dto';
import { MerchantAlertsService } from './merchant-alerts.service';
import { assertRefundable, assertWithinStaffLimit, generateRefundReference, isRefundable, STATIC_QR_REQUEST_MINUTES } from './merchant-extras';
import { receiptCode } from './receipt-seal';
import { MerchantComplianceService } from './merchant-compliance.service';
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
  payee: { id: string; firstName: string | null; lastName: string | null; email: string; merchantProfile: { id: string; businessName: string; city: string | null; category: string | null; address: string | null; status: string; logo: { sha256: string } | null } | null };
  payer: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
};

type ShopByToken = Prisma.MerchantProfileGetPayload<{ include: { logo: { select: { sha256: true } }; user: { select: { id: true; primaryCurrency: true } } } }>;

const INCLUDE = {
  payee: { select: { id: true, firstName: true, lastName: true, email: true, merchantProfile: { select: { id: true, businessName: true, city: true, category: true, address: true, status: true, logo: { select: { sha256: true } } } } } },
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
    private readonly alerts: MerchantAlertsService,
    private readonly compliance: MerchantComplianceService,
  ) {}

  // ── Utilitaires ────────────────────────────────────────

  private async actor(userId: string): Promise<Actor> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: ACTOR_SELECT });
    if (!u || !u.clientId || u.deletedAt || !u.isActive || u.isSuspended) throw new ForbiddenException('Compte indisponible.');
    return u;
  }

  private async audit(userId: string, clientId: number, action: 'MERCHANT_PAYMENT' | 'MERCHANT_REFUND', entityId: string, details: Record<string, unknown>, successful = true) {
    try {
      await this.prisma.auditLog.create({ data: { userId, clientId, action, entity: 'PaymentRequest', entityId, details: details as Prisma.InputJsonValue, successful } });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (${action}, ${entityId}) : ${(err as Error).message}`);
    }
  }

  private businessOf(r: RequestWithParties): string {
    return r.payee.merchantProfile?.businessName ?? personName(r.payee);
  }

  /**
   * Vue renvoyée à l'application. Le numéro et l'identité du payeur ne sont montrés qu'au côté « marchand » : le propriétaire et le caissier
   * qui a créé la demande. `extra.canRefund` : le demandeur peut rembourser CE paiement (droit + paiement encore remboursable).
   */
  private view(r: RequestWithParties, viewerId: string, now = new Date(), extra: { canRefund?: boolean } = {}) {
    const isPayee = r.payeeId === viewerId || r.createdById === viewerId;
    const pending = r.status === 'PENDING';
    const shop = r.payee.merchantProfile;
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
      merchant: { id: r.payee.id, shopId: shop?.id ?? null, businessName: this.businessOf(r), city: shop?.city ?? null, category: shop?.category ?? null, address: shop?.address ?? null, logoVersion: shop?.logo?.sha256 ?? null },
      payer: r.payer ? { id: r.payer.id, name: isPayee ? personName(r.payer) : 'Vous' } : null,
      payerPhone: isPayee ? r.payerPhone : undefined,
      qrPayload: isPayee && r.method === 'QR' && pending && r.qrToken ? buildQrPayload(r.qrToken) : undefined,
      expiresAt: r.expiresAt.toISOString(),
      secondsLeft: pending ? secondsLeft(r.expiresAt, now) : 0,
      createdAt: r.createdAt.toISOString(),
      paidAt: r.paidAt ? r.paidAt.toISOString() : null,
      failureReason: r.failureReason,
      isMine: isPayee ? 'PAYEE' : 'PAYER',
      viaStaticQr: r.viaStaticQr,
      refunded: !!r.refundedAt,
      refundedAt: r.refundedAt ? r.refundedAt.toISOString() : null,
      refundReason: r.refundReason ?? null,
      canRefund: !!extra.canRefund && isRefundable(r, now),
      /** Code imprimé en QR sur le reçu : permet de contrôler le document auprès du serveur (lot 14). */
      verifyCode: r.status === 'PAID' && r.paidAt ? receiptCode({ id: r.id, reference: r.reference, amount: r.amount, currency: String(r.currency), paidAt: r.paidAt }) : undefined,
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
    if (r.viaStaticQr) return true; // demande née du QR de caisse : transitoire, rien à signaler
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

  private async prepare(user: AuthUserPayload, amountRaw: unknown, currencyRaw: string | undefined, kind: 'PHONE' | 'QR', merchantId?: string) {
    const acting = await this.merchants.resolveActing(user, merchantId);
    const { profile, settings } = acting;
    // Le propriétaire est celui qui est encaissé ; un caissier est lui aussi vérifié (compte actif, non suspendu).
    const merchantUser = await this.actor(acting.ownerId);
    if (!acting.isOwner) await this.actor(user.id);
    // Un caissier encaisse toujours dans la devise du commerce.
    const currency = acting.isOwner ? (currencyRaw ?? merchantUser.primaryCurrency) : merchantUser.primaryCurrency;
    const amount = assertValidAmount(amountRaw, currency);
    assertWithinBounds(amount, currency, { min: settings.minPayment[currency], max: settings.maxPayment[currency] });
    assertWithinStaffLimit(amount, acting.staff?.maxAmount === null || acting.staff?.maxAmount === undefined ? null : Number(acting.staff.maxAmount), currency);

    const pending = await this.prisma.paymentRequest.count({ where: { payeeId: acting.ownerId, status: 'PENDING', viaStaticQr: false, expiresAt: { gt: new Date() } } });
    if (pending >= MAX_PENDING_PER_MERCHANT) {
      throw new BadRequestException(`Trop de demandes en attente (${MAX_PENDING_PER_MERCHANT}). Annulez-en ou attendez qu'elles expirent.`);
    }
    const now = new Date();
    const { fee, net } = computeFee(amount, settings.paymentFeePct, currency);
    return { merchantUser, profile, currency, amount, fee, net, expiresAt: computeExpiry(kind, settings, now), now, ownerId: acting.ownerId, createdById: acting.isOwner ? null : user.id };
  }

  /** Le marchand adresse la demande à un client par son numéro de téléphone. */
  async createPhoneRequest(user: AuthUserPayload, dto: CreatePhonePaymentDto) {
    const p = await this.prepare(user, dto.amount, dto.currency, 'PHONE', dto.merchantId);
    const phone = normalizePhoneStrict(dto.payerPhone);
    if (!phone) throw new BadRequestException(PHONE_INVALID_MESSAGE);

    const payer = await this.prisma.user.findFirst({
      where: { phone, clientId: p.merchantUser.clientId!, role: 'USER', isActive: true, isSuspended: false, deletedAt: null },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (!payer) throw new NotFoundException("Aucun client Direct Transf'air avec ce numéro. Vérifiez-le, ou proposez le paiement par QR code.");
    if (payer.id === user.id || payer.id === p.ownerId) throw new BadRequestException('Vous ne pouvez pas vous adresser une demande à vous-même.');

    // Double appui sur « Envoyer » : la même demande, encore ouverte, est renvoyée au lieu d'en créer une seconde.
    const duplicate = await this.load({
      payeeId: p.ownerId,
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
        payeeId: p.ownerId,
        createdById: p.createdById,
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
    const p = await this.prepare(user, dto.amount, dto.currency, 'QR', dto.merchantId);
    const created = await this.prisma.paymentRequest.create({
      data: {
        reference: generateReference('PAYMENT', p.now),
        clientId: p.merchantUser.clientId!,
        payeeId: p.ownerId,
        createdById: p.createdById,
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

  /** Droit de rembourser ce paiement pour la personne qui le consulte (propriétaire, ou caissier autorisé). */
  private async canRefundFor(r: RequestWithParties, userId: string): Promise<boolean> {
    if (r.payeeId === userId) return true;
    const shopId = r.payee.merchantProfile?.id;
    if (!shopId) return false;
    const staff = await this.prisma.merchantStaff.findFirst({ where: { merchantId: shopId, userId, active: true }, select: { canRefund: true } });
    return !!staff?.canRefund;
  }

  /** Suivi d'une demande : le marchand, le caissier qui l'a créée, ou le payeur. */
  async getOne(user: AuthUserPayload, id: string) {
    const r = await this.load({ id, clientId: user.clientId, OR: [{ payeeId: user.id }, { payerId: user.id }, { createdById: user.id }] });
    if (!r) throw new NotFoundException('Demande introuvable.');
    if (r.status === 'PENDING' && isExpired(r.expiresAt, new Date())) await this.expireOne(r);
    const fresh = (await this.load({ id })) ?? r;
    const mayRefund = fresh.status === 'PAID' && !fresh.refundedAt && (fresh.payeeId === user.id || fresh.createdById === user.id) ? await this.canRefundFor(fresh, user.id) : false;
    return this.view(fresh, user.id, new Date(), { canRefund: mayRefund });
  }

  /** Commerce dont le QR PERMANENT porte ce jeton (dans la société du demandeur), ou null. */
  private async findShopByStaticToken(token: string, clientId: number | undefined): Promise<ShopByToken | null> {
    if (!clientId) return null;
    return this.prisma.merchantProfile.findFirst({
      where: { staticQrToken: token, clientId },
      include: { logo: { select: { sha256: true } }, user: { select: { id: true, primaryCurrency: true } } },
    });
  }

  private async assertShopOpen(shop: { status: string; clientId: number }) {
    const settings = await this.merchants.settingsFor(shop.clientId);
    if (shop.status !== 'ACTIVE' || !settings.enabled) throw new ConflictException('Ce marchand ne peut plus encaisser pour le moment.');
    return settings;
  }

  /** Aperçu d'un QR scanné : qui encaisse, combien (ou « à saisir » pour le QR de caisse) — avant toute saisie du code secret. */
  async previewQr(user: AuthUserPayload, raw: string) {
    const token = parseQrPayload(raw);
    if (!token) throw new BadRequestException("Ce QR code n'est pas un QR de paiement Direct Transf'air.");

    const shop = await this.findShopByStaticToken(token, user.clientId);
    if (shop) {
      if (shop.userId === user.id) throw new BadRequestException('Vous ne pouvez pas payer votre propre QR code.');
      const settings = await this.assertShopOpen(shop);
      const currency = String(shop.user.primaryCurrency ?? 'XOF');
      const now = new Date();
      return {
        id: `static-${shop.id}`,
        reference: '',
        method: 'QR' as const,
        status: 'PENDING' as const,
        amount: 0,
        currency,
        note: null,
        merchant: { id: shop.userId, shopId: shop.id, businessName: shop.businessName, city: shop.city, category: shop.category, address: shop.address, logoVersion: shop.logo?.sha256 ?? null },
        payer: null,
        expiresAt: new Date(now.getTime() + STATIC_QR_REQUEST_MINUTES * 60_000).toISOString(),
        secondsLeft: STATIC_QR_REQUEST_MINUTES * 60,
        createdAt: now.toISOString(),
        paidAt: null,
        failureReason: null,
        isMine: 'PAYER' as const,
        viaStaticQr: true,
        staticQr: true,
        refunded: false,
        refundedAt: null,
        refundReason: null,
        canRefund: false,
        minAmount: settings.minPayment[currency] ?? null,
        maxAmount: settings.maxPayment[currency] ?? null,
      };
    }

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

  /**
   * Historique des encaissements. Propriétaire : tous ceux du commerce (y compris ceux de ses caissiers). Caissier (`merchantId`) : uniquement
   * ceux qu'il a créés. Les demandes transitoires nées du QR de caisse n'apparaissent que si elles ont été payées.
   */
  async listMine(user: AuthUserPayload, q: { status?: string; page?: number; limit?: number; merchantId?: string }) {
    const a = await this.merchants.resolveActing(user, q.merchantId);
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(Math.max(1, q.limit ?? 20), 100);
    const now = new Date();
    const status = ['PENDING', 'PAID', 'DECLINED', 'EXPIRED', 'CANCELLED'].includes(q.status ?? '') ? (q.status as PaymentRequest['status']) : undefined;
    const statusWhere: Prisma.PaymentRequestWhereInput =
      q.status === 'REFUNDED'
        ? { status: 'PAID', refundedAt: { not: null } }
        : status === 'PENDING'
          ? { status, expiresAt: { gt: now } }
          : status === 'EXPIRED'
            ? { OR: [{ status: 'EXPIRED' }, { status: 'PENDING', expiresAt: { lte: now } }] }
            : status
              ? { status }
              : {};
    const where: Prisma.PaymentRequestWhereInput = {
      AND: [{ payeeId: a.ownerId, ...(a.isOwner ? {} : { createdById: user.id }) }, { OR: [{ viaStaticQr: false }, { status: 'PAID' }] }, statusWhere],
    };
    const [rows, total] = await Promise.all([
      this.prisma.paymentRequest.findMany({ where, include: INCLUDE, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.paymentRequest.count({ where }),
    ]);
    const mayRefund = a.isOwner || !!a.staff?.canRefund;
    return { data: (rows as RequestWithParties[]).map((r) => this.view(r, user.id, now, { canRefund: mayRefund })), meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) } };
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

  /**
   * Payer un QR code scanné. QR d'une demande : le montant est celui du marchand. QR de caisse (permanent) : le client a SAISI `opts.amount`,
   * une demande est créée à la volée puis réglée ; si le règlement échoue elle est fermée (aucune demande orpheline).
   */
  async payQr(user: AuthUserPayload, raw: string, pin: string, opts: { amount?: unknown } = {}) {
    const token = parseQrPayload(raw);
    if (!token) throw new BadRequestException("Ce QR code n'est pas un QR de paiement Direct Transf'air.");

    const shop = await this.findShopByStaticToken(token, user.clientId);
    if (shop) return this.payStatic(user, shop, pin, opts.amount);

    const r = await this.load({ qrToken: token, clientId: user.clientId });
    if (!r) throw new NotFoundException('QR code inconnu ou non valable pour votre société.');
    return this.settle(user, r, pin);
  }

  private async payStatic(user: AuthUserPayload, shop: ShopByToken, pin: string, amountRaw: unknown) {
    const payer = await this.actor(user.id);
    if (payer.role !== 'USER') throw new ForbiddenException('Seuls les clients peuvent payer.');
    if (shop.userId === payer.id) throw new BadRequestException('Vous ne pouvez pas payer votre propre QR code.');
    const settings = await this.assertShopOpen(shop);

    const currency = String(shop.user.primaryCurrency ?? 'XOF');
    if (amountRaw === undefined || amountRaw === null || amountRaw === '') throw new BadRequestException('Saisissez le montant à payer.');
    const amount = assertValidAmount(amountRaw, currency);
    assertWithinBounds(amount, currency, { min: settings.minPayment[currency], max: settings.maxPayment[currency] });
    const { fee, net } = computeFee(amount, settings.paymentFeePct, currency);

    const now = new Date();
    const created = await this.prisma.paymentRequest.create({
      data: {
        reference: generateReference('PAYMENT', now),
        clientId: shop.clientId,
        payeeId: shop.userId,
        payerId: payer.id,
        method: 'QR',
        viaStaticQr: true,
        amount,
        fee,
        netAmount: net,
        currency: currency as never,
        expiresAt: new Date(now.getTime() + STATIC_QR_REQUEST_MINUTES * 60_000),
      },
      include: INCLUDE,
    });
    try {
      return await this.settle(user, created as RequestWithParties, pin);
    } catch (err) {
      // Code secret faux, solde insuffisant, KYC… : la demande transitoire est fermée, le client recommence en rescannant.
      await this.prisma.paymentRequest
        .updateMany({ where: { id: created.id, status: 'PENDING' }, data: { status: 'CANCELLED', cancelledAt: new Date(), failureReason: err instanceof Error ? err.message.slice(0, 200) : 'Paiement non abouti' } })
        .catch(() => undefined);
      throw err;
    }
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
    // Le payeur paie avec son portefeuille PERSONNEL ; l'encaissement va sur le portefeuille PROPRE du commerce (jamais sur celui
    // du client, même si c'est la même personne).
    const merchantProfileId = r.payee.merchantProfile?.id;
    if (!merchantProfileId) throw new ConflictException('Ce marchand ne peut plus encaisser pour le moment.');
    const [payerWallet, merchantWallet, companyWallet] = await Promise.all([
      this.wallets.getOrCreateWallet({ userId: payer.id, currency }),
      this.wallets.getOrCreateWallet({ merchantId: merchantProfileId, currency }),
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
        // Plafonds du niveau KYC (envois + paiements marchand), contrôlés SOUS le verrou du portefeuille : le débit ci-dessus l'a pris.
        await this.compliance.assertWithinLimits(tx, { clientId: r.clientId, payerId: payer.id, currency, amount, requestId: r.id });
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

    await this.audit(payer.id, r.clientId, 'MERCHANT_PAYMENT', r.id, { step: 'PAID', method: r.method, amount, fee: Number(r.fee), currency, transactionId, viaStaticQr: r.viaStaticQr, createdById: r.createdById });
    // Scoring AML non bloquant (signalement à la conformité) — ne lève jamais.
    await this.compliance.scorePayment({ transactionId, requestId: r.id, payerId: payer.id, amount, currency });
    const money = formatMoney(r.amount, currency);
    const net = formatMoney(r.netAmount, currency);
    const cashier = r.createdById ? await this.prisma.user.findUnique({ where: { id: r.createdById }, select: { id: true, email: true, firstName: true, lastName: true } }) : null;
    await Promise.all([
      this.notifier.notifyUser(r.payee, {
        kind: 'PAYMENT_RECEIVED',
        title: `Paiement reçu : ${money}`,
        body: `${personName(payer)} vient de vous payer ${money}${Number(r.fee) > 0 ? ` (net ${net} après commission)` : ''}${cashier ? `, encaissé par ${personName(cashier)}` : ''}. Réf. ${r.reference}.`,
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
      // Le caissier qui a créé la demande voit tout de suite qu'elle est payée (dans son espace client : il n'a pas d'espace marchand).
      cashier
        ? this.notifier.notifyUser(cashier, {
            kind: 'PAYMENT_RECEIVED',
            title: `Paiement reçu : ${money}`,
            body: `${personName(payer)} a payé ${money} à ${this.businessOf(r)}. Réf. ${r.reference}.`,
            actionUrl: '/cashier',
            actionLabel: 'Caisse',
            type: 'SUCCESS',
            email: false,
          })
        : Promise.resolve(),
    ]);
    // L'encaissement remonte le solde : réarme l'alerte « solde bas » si elle avait été envoyée.
    await this.alerts.onBalanceChanged(merchantProfileId, currency);

    const done = await this.load({ id: r.id });
    return { ...this.view(done ?? r, payer.id), transactionId };
  }

  /** Échec du règlement : journal, compteur d'échecs, et prévenir le payeur (et le marchand une seule fois). Ne lève jamais. */
  private async onSettleFailure(r: RequestWithParties, payer: Actor, err: unknown): Promise<void> {
    try {
      const message = err instanceof Error ? err.message : String(err);
      const insufficient = /solde insuffisant/i.test(message);
      const overLimit = err instanceof ForbiddenException && (err.getResponse() as { code?: string })?.code === 'LIMIT_EXCEEDED';
      const closed = err instanceof ConflictException || err instanceof GoneException;
      if (closed) return; // déjà payée / expirée : rien à signaler de plus
      await this.audit(payer.id, r.clientId, 'MERCHANT_PAYMENT', r.id, { step: 'FAILED', reason: message }, false);
      // Compteur d'échecs : alimente l'alerte « plusieurs paiements échoués » du marchand.
      await this.prisma.paymentRequest.updateMany({ where: { id: r.id }, data: { failedAttempts: { increment: 1 } } });
      const money = formatMoney(r.amount, r.currency);
      await this.notifier.notifyUser(payer, {
        kind: 'PAYMENT_FAILED',
        title: insufficient ? 'Paiement impossible : solde insuffisant' : overLimit ? 'Paiement refusé : plafond atteint' : 'Paiement non effectué',
        body: overLimit
          ? `${message} Aucun montant n'a été débité.`
          : insufficient
          ? r.viaStaticQr
            ? `Rechargez votre portefeuille puis scannez de nouveau le QR code de ${this.businessOf(r)} pour payer ${money}.`
            : `Rechargez votre portefeuille puis payez à nouveau ${money} à ${this.businessOf(r)} tant que la demande est valable.`
          : `Le paiement de ${money} à ${this.businessOf(r)} n'a pas abouti. Aucun montant n'a été débité.`,
        actionUrl: insufficient ? '/wallet' : r.viaStaticQr ? '/pay/scan' : '/pay/requests',
        actionLabel: insufficient ? 'Portefeuille' : r.viaStaticQr ? 'Scanner' : 'À payer',
        type: 'ERROR',
        email: false,
      });
      // Demande transitoire du QR de caisse : le marchand n'est pas dérangé pour chaque échec (l'alerte groupée suffit).
      if (!r.viaStaticQr && !r.failureReason) {
        await this.prisma.paymentRequest.updateMany({ where: { id: r.id, status: 'PENDING', failureReason: null }, data: { failureReason: insufficient ? 'Solde insuffisant du client' : overLimit ? 'Plafond du client atteint' : 'Paiement non abouti' } });
        await this.notifier.notifyUser(r.payee, {
          kind: 'PAYMENT_FAILED',
          title: 'Paiement non abouti',
          body: `${insufficient ? 'Le solde du client est insuffisant' : overLimit ? 'Le client a atteint son plafond de paiement' : 'Le paiement a échoué'} pour la demande de ${money} (${r.reference}). La demande reste ouverte jusqu'à son expiration.`,
          actionUrl: `/merchant/payment?id=${r.id}`,
          actionLabel: 'Encaissements',
          type: 'WARNING',
          email: false,
        });
      }
      await this.alerts.onPaymentFailed(r.payeeId);
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

  /** Le marchand — ou le caissier qui l'a créée — annule une demande encore ouverte (QR fermé, erreur de montant). */
  async cancel(user: AuthUserPayload, id: string) {
    const r = await this.load({ id, OR: [{ payeeId: user.id }, { createdById: user.id }] });
    if (!r) throw new NotFoundException('Demande introuvable.');
    const done = await this.prisma.paymentRequest.updateMany({
      where: { id, status: 'PENDING', OR: [{ payeeId: user.id }, { createdById: user.id }] },
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

  // ── Remboursement ──────────────────────────────────────

  /**
   * Rembourse TOTALEMENT un paiement reçu. Propriétaire, ou caissier auquel le droit a été accordé (avec SON code secret).
   * Une seule transaction SQL : prise du remboursement (une seule fois), opération MERCHANT_REFUND, débit du portefeuille du commerce,
   * crédit du portefeuille du client. Solde du commerce insuffisant : rien n'est écrit. La commission de service n'est pas restituée.
   */
  async refund(user: AuthUserPayload, id: string, dto: RefundPaymentDto) {
    const r = await this.load({ id, clientId: user.clientId });
    if (!r) throw new NotFoundException('Paiement introuvable.');
    const shopId = r.payee.merchantProfile?.id;
    let byStaff = false;
    if (r.payeeId !== user.id) {
      const staff = shopId ? await this.prisma.merchantStaff.findFirst({ where: { merchantId: shopId, userId: user.id, active: true } }) : null;
      if (!staff) throw new NotFoundException('Paiement introuvable.');
      if (!staff.canRefund) throw new ForbiddenException("Vous n'avez pas le droit de rembourser. Demandez au propriétaire du commerce.");
      byStaff = true;
    }
    await this.merchants.assertActiveMerchant(r.payeeId);
    const refunder = await this.actor(user.id);
    const now = new Date();
    assertRefundable(r, now);
    if (!r.payerId || !r.payer || !shopId) throw new ConflictException('Ce paiement ne peut pas être remboursé automatiquement : client introuvable. Contactez le service client.');
    const payerAccount = await this.prisma.user.findUnique({ where: { id: r.payerId }, select: { id: true, email: true, firstName: true, lastName: true, isActive: true, deletedAt: true } });
    if (!payerAccount || payerAccount.deletedAt || !payerAccount.isActive) throw new ConflictException("Le compte du client n'est plus actif : le remboursement doit passer par le service client.");
    await this.pins.assertPin(user.id, dto.pin);

    const reason = dto.reason?.trim().slice(0, 200) || null;
    const currency = r.currency;
    const amount = Number(r.amount);
    const [merchantWallet, payerWallet] = await Promise.all([
      this.wallets.getOrCreateWallet({ merchantId: shopId, currency }),
      this.wallets.getOrCreateWallet({ userId: r.payerId, currency }),
    ]);

    let refundTxId: string;
    const reference = generateRefundReference(now);
    try {
      refundTxId = await this.prisma.$transaction(async (tx) => {
        const claim = await tx.paymentRequest.updateMany({
          where: { id: r.id, status: 'PAID', refundedAt: null },
          data: { refundedAt: now, refundedById: refunder.id, refundReason: reason },
        });
        if (claim.count !== 1) throw new ConflictException('Ce paiement a déjà été remboursé.');
        const created = await tx.transaction.create({
          data: {
            reference,
            type: 'MERCHANT_REFUND',
            direction: 'INTERNAL',
            amount: r.amount,
            fees: 0,
            total: r.amount,
            currency,
            receivedAmount: r.amount,
            platformCommission: 0,
            status: 'PAID',
            payoutMethod: 'WALLET',
            paymentMethod: 'WALLET',
            senderId: r.payeeId,
            recipientId: r.payerId,
            clientId: r.clientId,
            note: `Remboursement ${r.reference}${reason ? ` — ${reason}` : ''}`,
            paidAt: now,
          },
        });
        await this.wallets.debitInTx(tx, merchantWallet.id, amount, `Remboursement ${r.reference}`, created.id);
        // allowFrozen : un portefeuille client gelé entre-temps ne doit pas empêcher de lui rendre son argent.
        await this.wallets.creditInTx(tx, payerWallet.id, amount, `Remboursement ${this.businessOf(r)} ${r.reference}`, created.id, { allowFrozen: true });
        await tx.paymentRequest.update({ where: { id: r.id }, data: { refundTransactionId: created.id } });
        return created.id;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (!(err instanceof ConflictException) && /solde insuffisant/i.test(message)) {
        throw new BadRequestException(`Le solde de votre commerce ne suffit pas pour rembourser ${formatMoney(amount, currency)}. Encaissez d'abord ou attendez qu'un retrait refusé soit recrédité.`);
      }
      throw err;
    }

    await this.audit(user.id, r.clientId, 'MERCHANT_REFUND', r.id, { amount, currency, reference, refundTransactionId: refundTxId, byStaff, reason });
    const money = formatMoney(amount, currency);
    await Promise.all([
      this.notifier.notifyUser(payerAccount, {
        kind: 'PAYMENT_REFUNDED',
        title: `Remboursement reçu : ${money}`,
        body: `${this.businessOf(r)} vous a remboursé ${money}${reason ? ` (${reason})` : ''}. Le montant est de nouveau sur votre portefeuille. Réf. ${r.reference}.`,
        actionUrl: '/wallet',
        actionLabel: 'Portefeuille',
        type: 'SUCCESS',
        email: true,
      }),
      byStaff
        ? this.notifier.notifyUser(r.payee, {
            kind: 'PAYMENT_REFUND_SENT',
            title: `Paiement remboursé : ${money}`,
            body: `${personName(refunder)} a remboursé ${money} à ${personName(r.payer)} (réf. ${r.reference})${reason ? ` — ${reason}` : ''}.`,
            actionUrl: `/merchant/payment?id=${r.id}`,
            actionLabel: 'Encaissements',
            type: 'WARNING',
            email: true,
          })
        : Promise.resolve(),
    ]);
    await this.alerts.onBalanceChanged(shopId, currency);

    const done = (await this.load({ id: r.id })) ?? r;
    return { ...this.view(done, user.id, now, { canRefund: false }), refundTransactionId: refundTxId };
  }

}
