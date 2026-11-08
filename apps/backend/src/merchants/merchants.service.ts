// apps/backend/src/merchants/merchants.service.ts
// =========================================================
// COMPTE MARCHAND (lot 11) — fiche du commerce, activation, destination des retraits, suivi côté administrateur.
//   • Un marchand est un compte USER (accountType = MERCHANT) avec une fiche MerchantProfile et son portefeuille PROPRE (Wallet.merchantId),
//     séparé du portefeuille personnel du client : l'espace marchand démarre à 0 et ne reprend ni le solde ni les opérations du client.
//   • On devient marchand à l'inscription (choix « Je suis marchand ») ou plus tard (activation, avec le code secret).
//   • Changer le numéro Orange Money ou le compte bancaire : code secret obligatoire, notification, délai de sécurité avant le prochain retrait.
//   • L'administrateur de la société voit ses marchands, peut les suspendre (plus d'encaissement ni de retrait) et les réactiver.
// =========================================================

import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, type MerchantStaff } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { CompanySettingsService } from '../company-settings/company-settings.service';
import type { MerchantSettings } from '../company-settings/company-settings.logic';
import { PrismaService } from '../prisma/prisma.service';
import type { ActivateMerchantDto, ChangeDestinationDto, MerchantListQueryDto, UpdateAlertsDto, UpdateMerchantProfileDto } from './dto/merchants.dto';
import { dayBounds, localDay, parseTzOffset } from './merchant-extras';
import { MerchantNotifierService } from './merchant-notifier.service';
import {
  type MerchantProfileInput,
  assertBic,
  assertIban,
  assertOrangePhone,
  assertOrangePhoneForCurrency,
  assertValidAmount,
  buildQrPayload,
  generateQrToken,
  isOrangeMoneyCurrency,
  isOrangePhoneConsistent,
  availablePayoutMethods,
  DEFAULT_CATEGORIES,
  maskIban,
  maskPhone,
  normalizeProfileInput,
  payoutCooldown,
} from './merchant-rules';
import { PinVerifierService } from './pin-verifier.service';

export const MERCHANT_REQUIRED_CODE = 'MERCHANT_REQUIRED';
export const MERCHANT_SUSPENDED_CODE = 'MERCHANT_SUSPENDED';
export const MERCHANT_DISABLED_CODE = 'MERCHANT_DISABLED';

const clean = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  return s ? s : null;
};

type ProfileRow = Prisma.MerchantProfileGetPayload<{ include: { logo: { select: { sha256: true } } } }>;
const WITH_LOGO = { logo: { select: { sha256: true } } } as const;

/** Pour qui une personne agit-elle : son propre commerce (propriétaire) ou le commerce où elle est caissier. */
export interface Acting {
  /** Propriétaire du commerce (c'est lui qui est encaissé et dont le portefeuille de commerce est utilisé). */
  ownerId: string;
  profile: ProfileRow;
  settings: MerchantSettings;
  staff: MerchantStaff | null;
  isOwner: boolean;
}
export const NOT_STAFF_CODE = 'NOT_STAFF';

@Injectable()
export class MerchantsService {
  private readonly logger = new Logger(MerchantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companySettings: CompanySettingsService,
    private readonly pins: PinVerifierService,
    private readonly notifier: MerchantNotifierService,
  ) {}

  private companyOf(user: AuthUserPayload): number {
    if (!user.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    return user.clientId;
  }

  private async audit(userId: string, clientId: number, action: string, entityId: string, details: Record<string, unknown>) {
    try {
      await this.prisma.auditLog.create({
        data: { userId, clientId, action: action as never, entity: 'MerchantProfile', entityId, details: details as Prisma.InputJsonValue, successful: true },
      });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (${action}, ${entityId}) : ${(err as Error).message}`);
    }
  }

  async settingsFor(clientId: number): Promise<MerchantSettings> {
    return (await this.companySettings.forClient(clientId)).merchant;
  }

  /** Refuse (403 + code) si l'utilisateur n'est pas un marchand actif dans une société qui ouvre les comptes marchands. */
  async assertActiveMerchant(userId: string): Promise<{ profile: ProfileRow; settings: MerchantSettings }> {
    const profile = await this.prisma.merchantProfile.findUnique({ where: { userId }, include: WITH_LOGO });
    if (!profile) {
      throw new ForbiddenException({ statusCode: 403, code: MERCHANT_REQUIRED_CODE, message: "Ce compte n'est pas un compte marchand." });
    }
    if (profile.status === 'SUSPENDED') {
      throw new ForbiddenException({
        statusCode: 403,
        code: MERCHANT_SUSPENDED_CODE,
        message: `Votre compte marchand est suspendu${profile.suspendedReason ? ` : ${profile.suspendedReason}` : ''}. Contactez le service client.`,
      });
    }
    const settings = await this.settingsFor(profile.clientId);
    if (!settings.enabled) {
      throw new ForbiddenException({ statusCode: 403, code: MERCHANT_DISABLED_CODE, message: 'Les comptes marchands sont temporairement fermés.' });
    }
    return { profile, settings };
  }

  /**
   * Résout « pour quel commerce j'agis ». Sans `merchantId` : mon propre commerce. Avec `merchantId` : mon commerce si j'en suis le propriétaire,
   * sinon le commerce où je suis caissier actif — sinon 403. Le commerce doit être actif (ni suspendu, ni fermé par la société).
   */
  async resolveActing(user: AuthUserPayload, merchantId?: string): Promise<Acting> {
    if (!merchantId) {
      const { profile, settings } = await this.assertActiveMerchant(user.id);
      return { ownerId: user.id, profile, settings, staff: null, isOwner: true };
    }
    const shop = await this.prisma.merchantProfile.findUnique({ where: { id: merchantId }, select: { userId: true, clientId: true } });
    if (!shop || !user.clientId || shop.clientId !== user.clientId) throw new NotFoundException('Commerce introuvable.');
    if (shop.userId === user.id) {
      const { profile, settings } = await this.assertActiveMerchant(user.id);
      return { ownerId: user.id, profile, settings, staff: null, isOwner: true };
    }
    const staff = await this.prisma.merchantStaff.findFirst({ where: { merchantId, userId: user.id, active: true } });
    if (!staff) throw new ForbiddenException({ statusCode: 403, code: NOT_STAFF_CODE, message: "Vous n'êtes pas caissier de ce commerce." });
    const { profile, settings } = await this.assertActiveMerchant(shop.userId);
    return { ownerId: shop.userId, profile, settings, staff, isOwner: false };
  }

  // ── Création de la fiche ───────────────────────────────

  /** À appeler dans la transaction d'inscription (ou d'activation) : pose accountType = MERCHANT et crée la fiche. */
  async createProfileInTx(tx: Prisma.TransactionClient, owner: { userId: string; clientId: number }, input: MerchantProfileInput, currency?: string) {
    const data = normalizeProfileInput(input, currency);
    await tx.user.update({ where: { id: owner.userId }, data: { accountType: 'MERCHANT' } });
    return tx.merchantProfile.create({
      data: {
        userId: owner.userId,
        clientId: owner.clientId,
        businessName: data.businessName,
        category: data.category,
        address: data.address,
        city: data.city,
        orangeMoneyPhone: data.orangeMoneyPhone,
      },
    });
  }

  /** Vérifie que la société accepte de nouveaux marchands (à l'inscription et à l'activation). */
  async assertOpenForNewMerchants(clientId: number): Promise<void> {
    const s = await this.settingsFor(clientId);
    if (!s.enabled) throw new ForbiddenException({ statusCode: 403, code: MERCHANT_DISABLED_CODE, message: "Les comptes marchands ne sont pas ouverts pour l'instant." });
  }

  async activate(user: AuthUserPayload, dto: ActivateMerchantDto) {
    const clientId = this.companyOf(user);
    if (user.role !== 'USER') throw new ForbiddenException('Réservé aux clients.');
    await this.assertOpenForNewMerchants(clientId);
    const existing = await this.prisma.merchantProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (existing) throw new ConflictException('Votre compte marchand existe déjà.');

    await this.pins.assertPin(user.id, dto.pin);
    // Devise du compte : le numéro Orange Money doit être celui du pays de cette devise (un compte en euros n'a pas d'Orange Money).
    const owner = await this.prisma.user.findUnique({ where: { id: user.id }, select: { primaryCurrency: true } });
    const currency = String(owner?.primaryCurrency ?? '');
    try {
      await this.prisma.$transaction((tx) => this.createProfileInTx(tx, { userId: user.id, clientId }, dto, currency || undefined));
    } catch (err) {
      if ((err as { code?: string })?.code === 'P2002') throw new ConflictException('Votre compte marchand existe déjà.');
      throw err;
    }
    await this.audit(user.id, clientId, 'MERCHANT_CREATE', user.id, { via: 'activation' });
    const u = await this.prisma.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, firstName: true } });
    if (u) {
      await this.notifier.notifyUser(u, {
        kind: 'MERCHANT_ACTIVATED',
        title: 'Compte marchand activé',
        body: 'Vous pouvez maintenant encaisser vos clients par téléphone ou par QR code.',
        actionUrl: '/merchant',
        actionLabel: 'Espace marchand',
        type: 'SUCCESS',
      });
    }
    return this.getMine(user);
  }

  // ── Lecture ────────────────────────────────────────────

  private profileView(p: ProfileRow, settings: MerchantSettings, now = new Date()) {
    const cooldown = payoutCooldown(p.destinationChangedAt, settings.payoutCooldownHours, now);
    return {
      businessName: p.businessName,
      category: p.category,
      address: p.address,
      city: p.city,
      status: p.status,
      suspendedReason: p.status === 'SUSPENDED' ? p.suspendedReason : null,
      orangeMoneyPhone: p.orangeMoneyPhone,
      orangeMoneyMasked: maskPhone(p.orangeMoneyPhone),
      bank: p.bankIban ? { holderName: p.bankHolderName, ibanMasked: maskIban(p.bankIban), bic: p.bankBic } : null,
      destinationChangedAt: p.destinationChangedAt ? p.destinationChangedAt.toISOString() : null,
      payoutLockedUntil: cooldown.until ? cooldown.until.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
      /** Identifiant public du commerce (logo, QR permanent, caissiers). */
      shopId: p.id,
      /** Empreinte du logo (nulle = pas de logo) : l'application ne retélécharge que si elle change. */
      logoVersion: p.logo?.sha256 ?? null,
      hasStaticQr: !!p.staticQrToken,
      alerts: {
        lowBalanceThreshold: p.lowBalanceThreshold === null || p.lowBalanceThreshold === undefined ? null : Number(p.lowBalanceThreshold),
        failureAlertsEnabled: p.failureAlertsEnabled ?? true,
      },
    };
  }

  /** Réglages utiles à l'application (jamais de donnée interne). */
  private publicSettings(s: MerchantSettings) {
    return {
      enabled: s.enabled,
      paymentFeePct: s.paymentFeePct,
      payoutFeePct: s.payoutFeePct,
      qrValidityMinutes: s.qrValidityMinutes,
      phoneRequestValidityMinutes: s.phoneRequestValidityMinutes,
      payoutCooldownHours: s.payoutCooldownHours,
      payoutMethods: s.payoutMethods,
      minPayment: s.minPayment,
      maxPayment: s.maxPayment,
      minPayout: s.minPayout,
    };
  }

  /** Catalogue pour le formulaire d'inscription (avant même d'avoir un compte) : réglages publics + catégories. */
  async publicOptions(clientId: number) {
    const s = await this.settingsFor(clientId);
    return { enabled: s.enabled, categories: [...DEFAULT_CATEGORIES], paymentFeePct: s.paymentFeePct };
  }

  async getMine(user: AuthUserPayload) {
    const me = await this.prisma.user.findUnique({ where: { id: user.id }, select: { accountType: true, clientId: true, primaryCurrency: true } });
    if (!me) throw new NotFoundException('Compte introuvable.');
    const profile = await this.prisma.merchantProfile.findUnique({ where: { userId: user.id }, include: WITH_LOGO });
    const settings = await this.settingsFor(me.clientId ?? this.companyOf(user));
    const now = new Date();
    return {
      isMerchant: !!profile,
      accountType: me.accountType,
      canActivate: !profile && settings.enabled,
      profile: profile ? this.profileView(profile, settings, now) : null,
      availablePayoutMethods: profile ? availablePayoutMethods(settings.payoutMethods, profile, me.primaryCurrency ? String(me.primaryCurrency) : null) : [],
      /** Devise du compte et règle du numéro Orange Money : l'application adapte ses formulaires (pas d'Orange Money en euros, numéro guinéen en GNF). */
      currency: me.primaryCurrency ? String(me.primaryCurrency) : null,
      orangeMoneyAllowed: me.primaryCurrency ? isOrangeMoneyCurrency(String(me.primaryCurrency)) : true,
      /** Vrai si le numéro Orange Money enregistré ne correspond plus à la devise du compte (ancien compte) : il faut le changer. */
      orangeNeedsUpdate: !!profile?.orangeMoneyPhone && !!me.primaryCurrency && !isOrangePhoneConsistent(profile.orangeMoneyPhone, String(me.primaryCurrency)),
      settings: this.publicSettings(settings),
      categories: [...DEFAULT_CATEGORIES],
    };
  }

  /**
   * Résumé du commerce. `today` et `total` : paiements reçus, MOINS les remboursements faits sur la période (c'est la vraie variation du solde).
   * `tz` : décalage de fuseau de l'appareil en minutes (Paris hiver : 60) pour que « aujourd'hui » soit le jour de l'appareil.
   */
  async summary(user: AuthUserPayload, tz?: unknown) {
    const { profile } = await this.assertActiveMerchant(user.id);
    const offset = parseTzOffset(tz);
    const startOfDay = dayBounds(localDay(new Date(), offset), offset).from;
    const [todaySales, todayRefunds, pending, totalSales, totalRefunds, payoutsPending, merchantWallets] = await Promise.all([
      this.prisma.paymentRequest.groupBy({ by: ['currency'], where: { payeeId: user.id, status: 'PAID', paidAt: { gte: startOfDay } }, _sum: { netAmount: true, amount: true }, _count: { _all: true } }),
      this.prisma.paymentRequest.groupBy({ by: ['currency'], where: { payeeId: user.id, refundedAt: { gte: startOfDay } }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.paymentRequest.count({ where: { payeeId: user.id, status: 'PENDING', viaStaticQr: false, expiresAt: { gt: new Date() } } }),
      this.prisma.paymentRequest.groupBy({ by: ['currency'], where: { payeeId: user.id, status: 'PAID' }, _sum: { netAmount: true }, _count: { _all: true } }),
      this.prisma.paymentRequest.groupBy({ by: ['currency'], where: { payeeId: user.id, refundedAt: { not: null } }, _sum: { amount: true } }),
      this.prisma.merchantPayout.count({ where: { userId: user.id, status: 'PENDING' } }),
      // Solde du COMMERCE (jamais celui du portefeuille personnel du client). Aucune ligne = rien encaissé = 0.
      this.prisma.wallet.findMany({ where: { merchantId: profile.id, isActive: true }, orderBy: { currency: 'asc' }, select: { currency: true, balance: true, reservedBalance: true } }),
    ]);
    const refundOf = (rows: { currency: string; _sum: { amount: Prisma.Decimal | null } }[], c: string) => Number(rows.find((r) => r.currency === c)?._sum.amount ?? 0);
    const currenciesToday = [...new Set([...todaySales.map((r) => r.currency), ...todayRefunds.map((r) => r.currency)])].sort();
    return {
      wallets: merchantWallets.map((w) => ({ currency: w.currency, balance: Number(w.balance), reserved: Number(w.reservedBalance), available: Number(w.balance) - Number(w.reservedBalance) })),
      today: currenciesToday.map((c) => {
        const sales = todaySales.find((r) => r.currency === c);
        const refunds = refundOf(todayRefunds, c);
        return { currency: c, count: sales?._count._all ?? 0, gross: Number(sales?._sum.amount ?? 0), net: Number(sales?._sum.netAmount ?? 0) - refunds, refundsTotal: refunds, refundsCount: todayRefunds.find((r) => r.currency === c)?._count._all ?? 0 };
      }),
      total: totalSales.map((r) => ({ currency: r.currency, count: r._count._all, net: Number(r._sum.netAmount ?? 0) - refundOf(totalRefunds, r.currency) })),
      pendingRequests: pending,
      pendingPayouts: payoutsPending,
    };
  }

  // ── Modification ───────────────────────────────────────

  async updateProfile(user: AuthUserPayload, dto: UpdateMerchantProfileDto) {
    const { profile } = await this.assertActiveMerchant(user.id);
    const data: Prisma.MerchantProfileUpdateInput = {};
    if (dto.businessName !== undefined) {
      const name = clean(dto.businessName);
      if (!name || name.length < 2) throw new BadRequestException('Nom du commerce : 2 caractères minimum.');
      data.businessName = name.slice(0, 80);
    }
    if (dto.category !== undefined) data.category = clean(dto.category)?.slice(0, 60) ?? null;
    if (dto.address !== undefined) data.address = clean(dto.address)?.slice(0, 160) ?? null;
    if (dto.city !== undefined) data.city = clean(dto.city)?.slice(0, 80) ?? null;
    if (Object.keys(data).length === 0) return this.getMine(user);
    await this.prisma.merchantProfile.update({ where: { id: profile.id }, data });
    await this.audit(user.id, profile.clientId, 'MERCHANT_UPDATE', user.id, { fields: Object.keys(data) });
    return this.getMine(user);
  }

  /**
   * Change le numéro Orange Money et/ou le compte bancaire des retraits. Code secret obligatoire (même pour un marchand déjà
   * connecté : un téléphone volé ne suffit pas). Ouvre le délai de sécurité avant le prochain retrait.
   */
  async changeDestination(user: AuthUserPayload, dto: ChangeDestinationDto) {
    const { profile, settings } = await this.assertActiveMerchant(user.id);
    await this.pins.assertPin(user.id, dto.pin);

    const data: Prisma.MerchantProfileUpdateInput = {};
    const changed: string[] = [];
    if (dto.orangeMoneyPhone !== undefined) {
      const owner = await this.prisma.user.findUnique({ where: { id: user.id }, select: { primaryCurrency: true } });
      const phone = owner?.primaryCurrency
        ? assertOrangePhoneForCurrency(dto.orangeMoneyPhone, String(owner.primaryCurrency))
        : assertOrangePhone(dto.orangeMoneyPhone);
      if (phone !== profile.orangeMoneyPhone) {
        data.orangeMoneyPhone = phone;
        changed.push('ORANGE_MONEY');
      }
    }
    if (dto.bankIban !== undefined) {
      if (clean(dto.bankIban) === null) {
        if (profile.bankIban) {
          data.bankIban = null;
          data.bankBic = null;
          data.bankHolderName = null;
          changed.push('BANK_TRANSFER');
        }
      } else {
        const iban = assertIban(dto.bankIban);
        const holder = clean(dto.bankHolderName) ?? profile.bankHolderName;
        if (!holder) throw new BadRequestException('Indiquez le titulaire du compte bancaire.');
        if (iban !== profile.bankIban || holder !== profile.bankHolderName || (dto.bankBic !== undefined && assertBic(dto.bankBic) !== profile.bankBic)) {
          data.bankIban = iban;
          data.bankHolderName = holder.slice(0, 80);
          if (dto.bankBic !== undefined) data.bankBic = assertBic(dto.bankBic);
          changed.push('BANK_TRANSFER');
        }
      }
    }
    if (changed.length === 0) throw new BadRequestException("Aucune modification : la destination saisie est identique à l'actuelle.");

    const now = new Date();
    data.destinationChangedAt = now;
    const updated = await this.prisma.merchantProfile.update({ where: { id: profile.id }, data });
    await this.audit(user.id, profile.clientId, 'MERCHANT_DESTINATION_CHANGE', user.id, {
      changed,
      from: { orange: maskPhone(profile.orangeMoneyPhone), iban: maskIban(profile.bankIban) },
      to: { orange: maskPhone(updated.orangeMoneyPhone), iban: maskIban(updated.bankIban) },
    });

    const cooldown = payoutCooldown(now, settings.payoutCooldownHours, now);
    const u = await this.prisma.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, firstName: true } });
    if (u) {
      await this.notifier.notifyUser(u, {
        kind: 'DESTINATION_CHANGED',
        title: 'Destination de vos retraits modifiée',
        body:
          `Vos retraits iront désormais vers ${changed.includes('ORANGE_MONEY') ? `l'Orange Money ${maskPhone(updated.orangeMoneyPhone)}` : 'votre compte bancaire'}.` +
          (cooldown.active ? ` Par sécurité, le prochain retrait sera possible dans ${settings.payoutCooldownHours} h.` : '') +
          " Ce n'était pas vous ? Contactez immédiatement le service client.",
        actionUrl: '/merchant/settings',
        actionLabel: 'Espace marchand',
        type: 'WARNING',
        email: true,
      });
    }
    return this.getMine(user);
  }

  // ── Alertes du marchand ────────────────────────────────

  /** Seuil de « solde bas » (devise du compte ; vide = pas d'alerte) et alerte « échecs de paiement » (activée par défaut). */
  async updateAlerts(user: AuthUserPayload, dto: UpdateAlertsDto) {
    const { profile } = await this.assertActiveMerchant(user.id);
    const data: Prisma.MerchantProfileUpdateInput = {};
    if (dto.lowBalanceThreshold !== undefined) {
      if (dto.lowBalanceThreshold === null) {
        data.lowBalanceThreshold = null;
        data.lowBalanceNotifiedAt = null;
      } else {
        const owner = await this.prisma.user.findUnique({ where: { id: user.id }, select: { primaryCurrency: true } });
        data.lowBalanceThreshold = assertValidAmount(dto.lowBalanceThreshold, String(owner?.primaryCurrency ?? 'XOF'));
        data.lowBalanceNotifiedAt = null; // le nouveau seuil est évalué à neuf au prochain mouvement
      }
    }
    if (dto.failureAlertsEnabled !== undefined) data.failureAlertsEnabled = !!dto.failureAlertsEnabled;
    if (Object.keys(data).length === 0) return this.getMine(user);
    await this.prisma.merchantProfile.update({ where: { id: profile.id }, data });
    await this.audit(user.id, profile.clientId, 'MERCHANT_UPDATE', user.id, { fields: Object.keys(data) });
    return this.getMine(user);
  }

  // ── QR permanent du commerce ───────────────────────────

  private async qrView(profile: ProfileRow, token: string, ownerId: string) {
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId }, select: { primaryCurrency: true } });
    return {
      payload: buildQrPayload(token),
      shopId: profile.id,
      businessName: profile.businessName,
      city: profile.city,
      currency: owner?.primaryCurrency ? String(owner.primaryCurrency) : null,
      logoVersion: profile.logo?.sha256 ?? null,
    };
  }

  /** QR permanent à afficher ou imprimer en caisse (créé à la première demande). Le propriétaire et ses caissiers peuvent l'afficher. */
  async getStaticQr(user: AuthUserPayload, merchantId?: string) {
    const a = await this.resolveActing(user, merchantId);
    let token = a.profile.staticQrToken;
    if (!token) {
      const fresh = generateQrToken();
      const claimed = await this.prisma.merchantProfile.updateMany({ where: { id: a.profile.id, staticQrToken: null }, data: { staticQrToken: fresh } });
      token = fresh;
      if (claimed.count === 0) token = (await this.prisma.merchantProfile.findUnique({ where: { id: a.profile.id }, select: { staticQrToken: true } }))?.staticQrToken ?? fresh;
    }
    return this.qrView(a.profile, token, a.ownerId);
  }

  /** Remplace le QR permanent (affiche volée, photo partagée…) : l'ancien cesse immédiatement de fonctionner. Code secret exigé. */
  async rotateStaticQr(user: AuthUserPayload, pin: string) {
    const { profile } = await this.assertActiveMerchant(user.id);
    await this.pins.assertPin(user.id, pin);
    const token = generateQrToken();
    await this.prisma.merchantProfile.update({ where: { id: profile.id }, data: { staticQrToken: token } });
    await this.audit(user.id, profile.clientId, 'MERCHANT_QR_ROTATE', user.id, {});
    const u = await this.prisma.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, firstName: true } });
    if (u) {
      await this.notifier.notifyUser(u, {
        kind: 'QR_ROTATED',
        title: 'QR code de caisse renouvelé',
        body: "L'ancien QR code ne fonctionne plus. Imprimez ou affichez le nouveau. Ce n'était pas vous ? Contactez le service client.",
        actionUrl: '/merchant/qr',
        actionLabel: 'QR de caisse',
        type: 'WARNING',
      });
    }
    return this.qrView({ ...profile, staticQrToken: token }, token, user.id);
  }

  // ── Administrateur de la société ───────────────────────

  private adminScope(actor: AuthUserPayload, clientId?: number): number {
    if (actor.role === 'SUPER_ADMIN') {
      if (!clientId) throw new BadRequestException('Précisez la société (clientId).');
      return clientId;
    }
    return this.companyOf(actor);
  }

  async listAdmin(actor: AuthUserPayload, q: MerchantListQueryDto) {
    const clientId = this.adminScope(actor, q.clientId);
    const page = q.page ?? 1;
    const limit = Math.min(q.limit ?? 20, 100);
    const search = q.search?.trim();
    const where: Prisma.MerchantProfileWhereInput = {
      clientId,
      ...(q.status ? { status: q.status } : {}),
      ...(search
        ? {
            OR: [
              { businessName: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
              { user: { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }, { email: { contains: search, mode: 'insensitive' } }] } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.merchantProfile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, kycLevel: true } } },
      }),
      this.prisma.merchantProfile.count({ where }),
    ]);
    const ids = rows.map((r) => r.userId);
    const [sales, pendingPayouts] = await Promise.all([
      this.prisma.paymentRequest.groupBy({ by: ['payeeId', 'currency'], where: { payeeId: { in: ids }, status: 'PAID', refundedAt: null }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.merchantPayout.groupBy({ by: ['userId'], where: { userId: { in: ids }, status: 'PENDING' }, _count: { _all: true } }),
    ]);
    return {
      data: rows.map((r) => ({
        userId: r.userId,
        businessName: r.businessName,
        category: r.category,
        city: r.city,
        status: r.status,
        owner: { firstName: r.user.firstName, lastName: r.user.lastName, email: r.user.email, phone: r.user.phone, kycLevel: r.user.kycLevel },
        orangeMoneyMasked: maskPhone(r.orangeMoneyPhone),
        hasBank: !!r.bankIban,
        sales: sales.filter((s) => s.payeeId === r.userId).map((s) => ({ currency: s.currency, count: s._count._all, gross: Number(s._sum.amount ?? 0) })),
        pendingPayouts: pendingPayouts.find((p) => p.userId === r.userId)?._count._all ?? 0,
        createdAt: r.createdAt.toISOString(),
      })),
      meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async getAdmin(actor: AuthUserPayload, userId: string, clientIdParam?: number) {
    const clientId = this.adminScope(actor, clientIdParam);
    const p = await this.prisma.merchantProfile.findFirst({
      where: { userId, clientId },
      include: { ...WITH_LOGO, user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, kycLevel: true, isSuspended: true } } },
    });
    if (!p) throw new NotFoundException('Marchand introuvable.');
    const settings = await this.settingsFor(clientId);
    const [recent, payouts] = await Promise.all([
      this.prisma.paymentRequest.findMany({ where: { payeeId: userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
      this.prisma.merchantPayout.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);
    return {
      ...this.profileView(p, settings),
      userId,
      owner: p.user,
      recentPayments: recent.map((r) => ({ id: r.id, reference: r.reference, method: r.method, status: r.status, amount: Number(r.amount), fee: Number(r.fee), currency: r.currency, refunded: !!r.refundedAt, createdAt: r.createdAt.toISOString() })),
      recentPayouts: payouts.map((r) => ({ id: r.id, reference: r.reference, method: r.method, status: r.status, amount: Number(r.amount), currency: r.currency, createdAt: r.createdAt.toISOString() })),
    };
  }

  async setSuspended(actor: AuthUserPayload, userId: string, suspended: boolean, reason?: string, clientIdParam?: number) {
    const clientId = this.adminScope(actor, clientIdParam);
    const p = await this.prisma.merchantProfile.findFirst({ where: { userId, clientId } });
    if (!p) throw new NotFoundException('Marchand introuvable.');
    const why = clean(reason);
    if (suspended && !why) throw new BadRequestException('Indiquez le motif de la suspension.');
    if ((p.status === 'SUSPENDED') === suspended) throw new ConflictException(suspended ? 'Ce marchand est déjà suspendu.' : "Ce marchand n'est pas suspendu.");

    await this.prisma.merchantProfile.update({
      where: { id: p.id },
      data: suspended ? { status: 'SUSPENDED', suspendedReason: why, suspendedAt: new Date() } : { status: 'ACTIVE', suspendedReason: null, suspendedAt: null },
    });
    // Les QR code affichés ne doivent plus pouvoir être payés.
    if (suspended) {
      await this.prisma.paymentRequest.updateMany({
        where: { payeeId: userId, status: 'PENDING' },
        data: { status: 'CANCELLED', cancelledAt: new Date(), failureReason: 'Compte marchand suspendu' },
      });
    }
    await this.audit(actor.id, clientId, suspended ? 'MERCHANT_SUSPEND' : 'MERCHANT_UPDATE', userId, { suspended, reason: why });
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, firstName: true } });
    if (u) {
      await this.notifier.notifyUser(u, {
        kind: suspended ? 'MERCHANT_SUSPENDED' : 'MERCHANT_REACTIVATED',
        title: suspended ? 'Compte marchand suspendu' : 'Compte marchand réactivé',
        body: suspended ? `Les encaissements et les retraits sont suspendus. Motif : ${why}.` : 'Vous pouvez de nouveau encaisser et retirer.',
        actionUrl: '/merchant',
        actionLabel: 'Espace marchand',
        type: suspended ? 'ERROR' : 'SUCCESS',
        email: true,
      });
    }
    return this.getAdmin(actor, userId, clientIdParam);
  }
}
