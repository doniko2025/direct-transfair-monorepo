// apps/backend/src/merchants/merchant-staff.service.ts
// =========================================================
// CAISSIERS (lot 13) — le propriétaire autorise des personnes de confiance à encaisser POUR son commerce.
//   Un caissier est un client Direct Transf'air ordinaire (même société) rattaché au commerce par son numéro de téléphone.
//   Il PEUT  : créer des encaissements (QR / téléphone), afficher le QR de caisse, suivre et annuler SES encaissements, voir son total du jour,
//              et — seulement si le propriétaire l'a accordé — rembourser (avec SON code secret).
//   Il NE PEUT PAS : voir le solde, retirer, modifier le commerce ou sa destination de retrait, exporter, clôturer, gérer l'équipe.
//   Le propriétaire peut limiter chaque caissier (plafond par encaissement), le suspendre ou le retirer à tout moment.
// =========================================================

import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { normalizePhoneStrict, PHONE_INVALID_MESSAGE } from '../common/utils/phone.util';
import { PrismaService } from '../prisma/prisma.service';
import type { AddStaffDto, UpdateStaffDto } from './dto/merchants.dto';
import { dayBounds, localDay, MAX_STAFF_PER_MERCHANT, normalizeStaffLimit, parseTzOffset } from './merchant-extras';
import { MerchantNotifierService } from './merchant-notifier.service';
import { maskPhone } from './merchant-rules';
import { MerchantsService } from './merchants.service';
import { PinVerifierService } from './pin-verifier.service';

const fullName = (u: { firstName?: string | null; lastName?: string | null; email?: string | null }): string =>
  [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || 'Caissier';

@Injectable()
export class MerchantStaffService {
  private readonly logger = new Logger(MerchantStaffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly merchants: MerchantsService,
    private readonly pins: PinVerifierService,
    private readonly notifier: MerchantNotifierService,
  ) {}

  private async audit(userId: string, clientId: number, entityId: string, details: Record<string, unknown>) {
    try {
      await this.prisma.auditLog.create({ data: { userId, clientId, action: 'MERCHANT_STAFF', entity: 'MerchantStaff', entityId, details: details as Prisma.InputJsonValue, successful: true } });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (MERCHANT_STAFF, ${entityId}) : ${(err as Error).message}`);
    }
  }

  private async currencyOf(userId: string): Promise<string> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { primaryCurrency: true } });
    return String(u?.primaryCurrency ?? 'XOF');
  }

  private view(s: { id: string; userId: string; active: boolean; canRefund: boolean; maxAmount: Prisma.Decimal | null; createdAt: Date; user: { firstName: string | null; lastName: string | null; email: string; phone: string | null } }) {
    return {
      id: s.id,
      userId: s.userId,
      name: fullName(s.user),
      phoneMasked: maskPhone(s.user.phone),
      active: s.active,
      canRefund: s.canRefund,
      maxAmount: s.maxAmount === null ? null : Number(s.maxAmount),
      createdAt: s.createdAt.toISOString(),
    };
  }

  private static readonly INCLUDE = { user: { select: { firstName: true, lastName: true, email: true, phone: true } } } as const;

  // ── Propriétaire ───────────────────────────────────────

  async list(user: AuthUserPayload) {
    const { profile } = await this.merchants.assertActiveMerchant(user.id);
    const rows = await this.prisma.merchantStaff.findMany({ where: { merchantId: profile.id }, include: MerchantStaffService.INCLUDE, orderBy: [{ active: 'desc' }, { createdAt: 'asc' }] });
    return { data: rows.map((r) => this.view(r)), max: MAX_STAFF_PER_MERCHANT };
  }

  async add(user: AuthUserPayload, dto: AddStaffDto) {
    const { profile } = await this.merchants.assertActiveMerchant(user.id);
    await this.pins.assertPin(user.id, dto.pin);
    const phone = normalizePhoneStrict(dto.phone);
    if (!phone) throw new BadRequestException(PHONE_INVALID_MESSAGE);

    const person = await this.prisma.user.findFirst({
      where: { phone, clientId: profile.clientId, role: 'USER', isActive: true, isSuspended: false, deletedAt: null },
      select: { id: true, email: true, firstName: true, lastName: true, phone: true },
    });
    if (!person) throw new NotFoundException("Aucun client Direct Transf'air avec ce numéro. La personne doit d'abord ouvrir un compte.");
    if (person.id === user.id) throw new BadRequestException('Vous êtes déjà le propriétaire de ce commerce.');

    const limit = normalizeStaffLimit(dto.maxAmount, await this.currencyOf(user.id));
    const existing = await this.prisma.merchantStaff.findUnique({ where: { merchantId_userId: { merchantId: profile.id, userId: person.id } } });
    if (existing?.active) throw new ConflictException('Cette personne est déjà caissier de votre commerce.');

    const activeCount = await this.prisma.merchantStaff.count({ where: { merchantId: profile.id, active: true } });
    if (activeCount >= MAX_STAFF_PER_MERCHANT) throw new BadRequestException(`Vous pouvez avoir ${MAX_STAFF_PER_MERCHANT} caissiers au maximum.`);

    const data = { active: true, canRefund: !!dto.canRefund, maxAmount: limit, addedById: user.id };
    const row = existing
      ? await this.prisma.merchantStaff.update({ where: { id: existing.id }, data, include: MerchantStaffService.INCLUDE })
      : await this.prisma.merchantStaff.create({ data: { merchantId: profile.id, userId: person.id, ...data }, include: MerchantStaffService.INCLUDE });
    await this.audit(user.id, profile.clientId, row.id, { step: 'ADD', staffUserId: person.id, canRefund: row.canRefund, maxAmount: limit });

    await this.notifier.notifyUser(person, {
      kind: 'STAFF_ADDED',
      title: `Vous êtes caissier de ${profile.businessName}`,
      body: `${profile.businessName} vous autorise à encaisser ses clients depuis votre application (profil → Caisse). Vous ne voyez ni le solde ni les retraits du commerce.`,
      actionUrl: '/cashier',
      actionLabel: 'Caisse',
      type: 'INFO',
      email: false,
    });
    return this.view(row);
  }

  async update(user: AuthUserPayload, id: string, dto: UpdateStaffDto) {
    const { profile } = await this.merchants.assertActiveMerchant(user.id);
    const row = await this.prisma.merchantStaff.findFirst({ where: { id, merchantId: profile.id } });
    if (!row) throw new NotFoundException('Caissier introuvable.');
    const data: Prisma.MerchantStaffUpdateInput = {};
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.canRefund !== undefined) {
      if (dto.canRefund && !row.canRefund) {
        if (!dto.pin) throw new BadRequestException('Code secret requis pour accorder le droit de rembourser.');
        await this.pins.assertPin(user.id, dto.pin);
      }
      data.canRefund = dto.canRefund;
    }
    if (dto.maxAmount !== undefined) data.maxAmount = normalizeStaffLimit(dto.maxAmount, await this.currencyOf(user.id));
    if (Object.keys(data).length === 0) {
      return this.view((await this.prisma.merchantStaff.findUnique({ where: { id }, include: MerchantStaffService.INCLUDE }))!);
    }
    const updated = await this.prisma.merchantStaff.update({ where: { id }, data, include: MerchantStaffService.INCLUDE });
    if (dto.active === false) {
      await this.prisma.paymentRequest.updateMany({
        where: { payeeId: user.id, createdById: row.userId, status: 'PENDING' },
        data: { status: 'CANCELLED', cancelledAt: new Date(), failureReason: 'Caissier suspendu' },
      });
    }
    await this.audit(user.id, profile.clientId, id, { step: 'UPDATE', fields: Object.keys(data) });
    return this.view(updated);
  }

  /** Retire le caissier (ses encaissements passés restent dans l'historique du commerce). */
  async remove(user: AuthUserPayload, id: string) {
    const { profile } = await this.merchants.assertActiveMerchant(user.id);
    const row = await this.prisma.merchantStaff.findFirst({ where: { id, merchantId: profile.id } });
    if (!row) throw new NotFoundException('Caissier introuvable.');
    await this.prisma.merchantStaff.delete({ where: { id } });
    // Ses demandes encore ouvertes sont fermées : un QR affiché par un caissier retiré ne doit plus pouvoir être payé.
    await this.prisma.paymentRequest.updateMany({
      where: { payeeId: user.id, createdById: row.userId, status: 'PENDING' },
      data: { status: 'CANCELLED', cancelledAt: new Date(), failureReason: 'Caissier retiré' },
    });
    await this.audit(user.id, profile.clientId, id, { step: 'REMOVE', staffUserId: row.userId });
    const person = await this.prisma.user.findUnique({ where: { id: row.userId }, select: { id: true, email: true, firstName: true } });
    if (person) {
      await this.notifier.notifyUser(person, {
        kind: 'STAFF_REMOVED',
        title: `Vous n'êtes plus caissier de ${profile.businessName}`,
        body: "Vous ne pouvez plus encaisser pour ce commerce.",
        actionUrl: '/cashier',
        actionLabel: 'Caisse',
        type: 'INFO',
      });
    }
    return { removed: true };
  }

  // ── Caissier ───────────────────────────────────────────

  /** Commerces où je suis caissier actif (écran « Caisse »). Un commerce suspendu ou fermé par la société est listé comme indisponible. */
  async memberships(user: AuthUserPayload) {
    const rows = await this.prisma.merchantStaff.findMany({
      where: { userId: user.id, active: true },
      include: { merchant: { include: { logo: { select: { sha256: true } }, user: { select: { primaryCurrency: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    const out: Array<Record<string, unknown>> = [];
    for (const r of rows) {
      const settings = await this.merchants.settingsFor(r.merchant.clientId);
      const currency = String(r.merchant.user.primaryCurrency ?? 'XOF');
      out.push({
        shopId: r.merchantId,
        businessName: r.merchant.businessName,
        city: r.merchant.city,
        logoVersion: r.merchant.logo?.sha256 ?? null,
        available: r.merchant.status === 'ACTIVE' && settings.enabled,
        canRefund: r.canRefund,
        maxAmount: r.maxAmount === null ? null : Number(r.maxAmount),
        currency,
        minPayment: settings.minPayment[currency] ?? null,
        maxPayment: settings.maxPayment[currency] ?? null,
        qrValidityMinutes: settings.qrValidityMinutes,
      });
    }
    return { data: out };
  }

  /** Mon activité du jour dans ce commerce (nombre et total des paiements encaissés grâce à MES demandes). */
  async myDay(user: AuthUserPayload, merchantId: string, tz?: unknown) {
    const a = await this.merchants.resolveActing(user, merchantId);
    const offset = parseTzOffset(tz);
    const day = localDay(new Date(), offset);
    const { from, to } = dayBounds(day, offset);
    const where: Prisma.PaymentRequestWhereInput = { payeeId: a.ownerId, status: 'PAID', paidAt: { gte: from, lt: to }, ...(a.isOwner ? {} : { createdById: user.id }) };
    const rows = await this.prisma.paymentRequest.groupBy({ by: ['currency'], where, _sum: { amount: true }, _count: { _all: true } });
    return { day, totals: rows.map((r) => ({ currency: r.currency, count: r._count._all, gross: Number(r._sum.amount ?? 0) })) };
  }

  /** Vérifie qu'une personne a bien le droit d'agir pour ce commerce (utilisé pour le remboursement par un caissier). */
  async staffOf(merchantId: string, userId: string) {
    return this.prisma.merchantStaff.findFirst({ where: { merchantId, userId, active: true } });
  }

  static forbidRefund(): never {
    throw new ForbiddenException("Vous n'avez pas le droit de rembourser. Demandez au propriétaire du commerce.");
  }
}
