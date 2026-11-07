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
import { Prisma } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { CompanySettingsService } from '../company-settings/company-settings.service';
import type { MerchantSettings } from '../company-settings/company-settings.logic';
import { PrismaService } from '../prisma/prisma.service';
import type { ActivateMerchantDto, ChangeDestinationDto, MerchantListQueryDto, UpdateMerchantProfileDto } from './dto/merchants.dto';
import { MerchantNotifierService } from './merchant-notifier.service';
import {
  type MerchantProfileInput,
  assertBic,
  assertIban,
  assertOrangePhone,
  assertOrangePhoneForCurrency,
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

type ProfileRow = Prisma.MerchantProfileGetPayload<object>;

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
    const profile = await this.prisma.merchantProfile.findUnique({ where: { userId } });
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
    const profile = await this.prisma.merchantProfile.findUnique({ where: { userId: user.id } });
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

  async summary(user: AuthUserPayload) {
    const { profile } = await this.assertActiveMerchant(user.id);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [today, pending, byCurrency, payoutsPending, merchantWallets] = await Promise.all([
      this.prisma.paymentRequest.groupBy({
        by: ['currency'],
        where: { payeeId: user.id, status: 'PAID', paidAt: { gte: startOfDay } },
        _sum: { netAmount: true, amount: true },
        _count: { _all: true },
      }),
      this.prisma.paymentRequest.count({ where: { payeeId: user.id, status: 'PENDING', expiresAt: { gt: new Date() } } }),
      this.prisma.paymentRequest.groupBy({ by: ['currency'], where: { payeeId: user.id, status: 'PAID' }, _sum: { netAmount: true }, _count: { _all: true } }),
      this.prisma.merchantPayout.count({ where: { userId: user.id, status: 'PENDING' } }),
      // Solde du COMMERCE (jamais celui du portefeuille personnel du client). Aucune ligne = rien encaissé = 0.
      this.prisma.wallet.findMany({ where: { merchantId: profile.id, isActive: true }, orderBy: { currency: 'asc' }, select: { currency: true, balance: true, reservedBalance: true } }),
    ]);
    return {
      wallets: merchantWallets.map((w) => ({ currency: w.currency, balance: Number(w.balance), reserved: Number(w.reservedBalance), available: Number(w.balance) - Number(w.reservedBalance) })),
      today: today.map((r) => ({ currency: r.currency, count: r._count._all, gross: Number(r._sum.amount ?? 0), net: Number(r._sum.netAmount ?? 0) })),
      total: byCurrency.map((r) => ({ currency: r.currency, count: r._count._all, net: Number(r._sum.netAmount ?? 0) })),
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
      this.prisma.paymentRequest.groupBy({ by: ['payeeId', 'currency'], where: { payeeId: { in: ids }, status: 'PAID' }, _sum: { amount: true }, _count: { _all: true } }),
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
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, kycLevel: true, isSuspended: true } } },
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
      recentPayments: recent.map((r) => ({ id: r.id, reference: r.reference, method: r.method, status: r.status, amount: Number(r.amount), fee: Number(r.fee), currency: r.currency, createdAt: r.createdAt.toISOString() })),
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
