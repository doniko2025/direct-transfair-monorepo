// apps/backend/src/clients/clients.service.ts
// =========================================================
// CLIENTS SERVICE v4.11
// ✅ v4.10 conservé intégralement
// ✅ v4.11 : Mentions légales publiques exposées dans le branding
//   PROBLÈME RÉSOLU : terms.tsx et assistance.tsx (mobile) avaient
//   "Direct Transf'air SAS", l'agrément ACPR, le capital social, le
//   siège social et les canaux de contact écrits en dur — n'importe
//   quelle société tenant (ex: FLASH26) voyait ces mêmes valeurs
//   plutôt que les siennes.
//   CORRECTIF : PUBLIC_BRANDING_SELECT / PublicBranding / mapPublicBranding()
//   exposent désormais legalCompanyName, regulatorName/Acronym,
//   regulatoryFrameworkLabel, regulatorLicenseNumber/Type, capitalSocial,
//   supportEmail, whatsappNumber, mediatorName/Url, termsVersion,
//   termsEffectiveDate — plus contactEmail/contactPhone/address
//   (champs déjà existants sur Client mais jamais exposés côté public
//   jusqu'ici). Aucune autre méthode de ce fichier n'est modifiée —
//   branding.controller.ts n'a besoin d'aucun changement, il renvoie
//   déjà tel quel ce que ce service produit.
// ✅ v4.5 conservé intégralement
// ✅ v4.6 : Email de bienvenue automatique après création
// ✅ v4.7 : Ajout updateOwnName() — self-service COMPANY_ADMIN
// ✅ v4.8 : 🚨 3 correctifs — suppression définitive, téléphone admin
//   non normalisé, findByCode() sans garde isActive
// ✅ v4.9 : 🐛 FIX — isSuspended jamais posé lors de la désactivation
//   d'un utilisateur
// ✅ v4.10 : 🐛 FIX — erreur de compilation TS2322 sur remove()
// =========================================================

import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import * as bcrypt from 'bcryptjs';
import { CurrencyCode, KycLevel, Role, SubscriptionStatus } from '@prisma/client';
import * as crypto from 'crypto';

import { CompanyMailService } from '../mail/channels/company-mail.service';
import { normalizePhoneE164 } from '../common/utils/phone.util';

// ─── Constantes ──────────────────────────────────────────
const SUPPORTED_CURRENCIES: CurrencyCode[] = [
  CurrencyCode.XOF,
  CurrencyCode.EUR,
  CurrencyCode.USD,
  CurrencyCode.GNF,
  CurrencyCode.GBP,
];

const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  FR: CurrencyCode.EUR, DE: CurrencyCode.EUR, IT: CurrencyCode.EUR,
  ES: CurrencyCode.EUR, BE: CurrencyCode.EUR, PT: CurrencyCode.EUR,
  NL: CurrencyCode.EUR, AT: CurrencyCode.EUR, FI: CurrencyCode.EUR,
  IE: CurrencyCode.EUR, LU: CurrencyCode.EUR, GR: CurrencyCode.EUR,
  GB: CurrencyCode.GBP, GG: CurrencyCode.GBP, JE: CurrencyCode.GBP, IM: CurrencyCode.GBP,
  US: CurrencyCode.USD, SV: CurrencyCode.USD, PA: CurrencyCode.USD, EC: CurrencyCode.USD,
  GN: CurrencyCode.GNF,
  SN: CurrencyCode.XOF, CI: CurrencyCode.XOF, ML: CurrencyCode.XOF, BF: CurrencyCode.XOF,
  BJ: CurrencyCode.XOF, TG: CurrencyCode.XOF, NE: CurrencyCode.XOF, GW: CurrencyCode.XOF,
};

// ─── Helpers ─────────────────────────────────────────────
function getCurrencyFromCountry(country?: string | null): CurrencyCode {
  if (!country) return CurrencyCode.XOF;
  const code = country.toUpperCase().trim().substring(0, 2);
  return COUNTRY_TO_CURRENCY[code] ?? CurrencyCode.XOF;
}

function generateReferralCode(firstName?: string, lastName?: string): string {
  const prefix = `${(firstName ?? 'U').slice(0, 1)}${(lastName ?? 'X').slice(0, 1)}`.toUpperCase();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}${suffix}`;
}

// ─── Type retour branding public ─────────────────────────
// ✅ v4.11 — champs mentions légales/contact ajoutés
type PublicBranding = {
  code:           string;
  name:           string;
  logoUrl:        string | null;
  primaryColor:   string;
  secondaryColor: string;
  tagline:        string | null;
  fontFamily:     string | null;
  splashBgColor:  string | null;
  welcomeMessage: string | null;
  subdomain:      string | null;
  customDomain:   string | null;
  isActive:       boolean;
  // ✅ v4.11 (nouveau)
  contactEmail:             string | null;
  contactPhone:             string | null;
  address:                  string | null;
  legalCompanyName:         string | null;
  regulatorName:            string | null;
  regulatorAcronym:         string | null;
  regulatoryFrameworkLabel: string | null;
  regulatorLicenseNumber:   string | null;
  regulatorLicenseType:     string | null;
  capitalSocial:            string | null;
  supportEmail:             string | null;
  whatsappNumber:           string | null;
  mediatorName:             string | null;
  mediatorUrl:              string | null;
  termsVersion:             string | null;
  termsEffectiveDate:       Date | null;
};

// ─── Sélection Prisma partagée ────────────────────────────
// ✅ v4.11 — champs mentions légales/contact ajoutés
const PUBLIC_BRANDING_SELECT = {
  code:           true,
  name:           true,
  logoUrl:        true,
  primaryColor:   true,
  secondaryColor: true,
  tagline:        true,
  fontFamily:     true,
  splashBgColor:  true,
  welcomeMessage: true,
  subdomain:      true,
  customDomain:   true,
  isActive:       true,
  // ✅ v4.11 (nouveau)
  contactEmail:             true,
  contactPhone:             true,
  address:                  true,
  legalCompanyName:         true,
  regulatorName:            true,
  regulatorAcronym:         true,
  regulatoryFrameworkLabel: true,
  regulatorLicenseNumber:   true,
  regulatorLicenseType:     true,
  capitalSocial:            true,
  supportEmail:             true,
  whatsappNumber:           true,
  mediatorName:             true,
  mediatorUrl:              true,
  termsVersion:             true,
  termsEffectiveDate:       true,
} as const;

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    private prisma: PrismaService,
    private readonly companyMailService: CompanyMailService,
  ) {}

  // ========================================================
  // HELPER PRIVÉ — mapping branding public
  // ✅ v4.11 — champs mentions légales/contact ajoutés
  // ========================================================

  private mapPublicBranding(client: any): PublicBranding {
    return {
      code:           client.code,
      name:           client.name,
      logoUrl:        client.logoUrl        ?? null,
      primaryColor:   client.primaryColor   ?? '#059669',
      secondaryColor: client.secondaryColor ?? '#10B981',
      tagline:        client.tagline        ?? null,
      fontFamily:     client.fontFamily     ?? null,
      splashBgColor:  client.splashBgColor  ?? null,
      welcomeMessage: client.welcomeMessage ?? null,
      subdomain:      client.subdomain      ?? null,
      customDomain:   client.customDomain   ?? null,
      isActive:       client.isActive,
      // ✅ v4.11 (nouveau)
      contactEmail:             client.contactEmail             ?? null,
      contactPhone:             client.contactPhone             ?? null,
      address:                  client.address                  ?? null,
      legalCompanyName:         client.legalCompanyName         ?? null,
      regulatorName:            client.regulatorName            ?? null,
      regulatorAcronym:         client.regulatorAcronym         ?? null,
      regulatoryFrameworkLabel: client.regulatoryFrameworkLabel ?? null,
      regulatorLicenseNumber:   client.regulatorLicenseNumber   ?? null,
      regulatorLicenseType:     client.regulatorLicenseType     ?? null,
      capitalSocial:            client.capitalSocial            ?? null,
      supportEmail:             client.supportEmail             ?? null,
      whatsappNumber:           client.whatsappNumber           ?? null,
      mediatorName:             client.mediatorName             ?? null,
      mediatorUrl:              client.mediatorUrl              ?? null,
      termsVersion:             client.termsVersion             ?? null,
      termsEffectiveDate:       client.termsEffectiveDate       ?? null,
    };
  }

  // ========================================================
  // CRÉATION
  // ========================================================

  async create(dto: CreateClientDto) {
    if (!dto.adminEmail?.trim())     throw new BadRequestException('adminEmail requis');
    if (!dto.adminPassword?.trim())  throw new BadRequestException('adminPassword requis');
    if (!dto.adminFirstName?.trim()) throw new BadRequestException('adminFirstName requis');
    if (!dto.adminLastName?.trim())  throw new BadRequestException('adminLastName requis');

    const existingCode = await this.prisma.client.findUnique({
      where: { code: dto.code.toUpperCase() },
    });
    if (existingCode)
      throw new ConflictException(`Le code "${dto.code}" est déjà pris.`);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.adminEmail },
    });
    if (existingUser)
      throw new ConflictException(`L'email "${dto.adminEmail}" est déjà utilisé.`);

    let normalizedAdminPhone: string | null = null;
    if (dto.contactPhone) {
      normalizedAdminPhone = normalizePhoneE164(dto.contactPhone);
      if (!normalizedAdminPhone) {
        throw new BadRequestException('Numéro de téléphone invalide.');
      }
      const existingPhone = await this.prisma.user.findFirst({
        where: { phone: normalizedAdminPhone },
      });
      if (existingPhone) {
        throw new ConflictException(
          'Ce numéro de téléphone est déjà utilisé par un autre compte.',
        );
      }
    }

    if (dto.subdomain) {
      const existingSub = await this.prisma.client.findUnique({
        where: { subdomain: dto.subdomain.toLowerCase().trim() },
      });
      if (existingSub)
        throw new ConflictException(`Le sous-domaine "${dto.subdomain}" est déjà utilisé.`);
    }

    if (dto.customDomain) {
      const existingDomain = await this.prisma.client.findUnique({
        where: { customDomain: dto.customDomain.toLowerCase().trim() },
      });
      if (existingDomain)
        throw new ConflictException(`Le domaine "${dto.customDomain}" est déjà utilisé.`);
    }

    const plainPassword   = String(dto.adminPassword);
    const hashedPassword  = await bcrypt.hash(plainPassword, 10);
    const ownerCountryCode = dto.ownerCountry?.toUpperCase().substring(0, 2);
    const primaryCurrency: CurrencyCode = getCurrencyFromCountry(ownerCountryCode);

    const result = await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          code:               dto.code.toUpperCase(),
          name:               dto.name,

          primaryColor:       dto.primaryColor   ?? '#059669',
          secondaryColor:     dto.secondaryColor ?? '#10B981',
          logoUrl:            dto.logoUrl        ?? null,
          tagline:            dto.tagline        ?? null,
          fontFamily:         dto.fontFamily     ?? null,
          splashBgColor:      dto.splashBgColor  ?? null,
          welcomeMessage:     dto.welcomeMessage ?? null,

          subdomain:    dto.subdomain?.toLowerCase().trim()    ?? null,
          customDomain: dto.customDomain?.toLowerCase().trim() ?? null,

          subscriptionType:   dto.subscriptionType ?? 'RENTAL',
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          defaultCurrency:    primaryCurrency,

          country:            ownerCountryCode   ?? null,
          email:              String(dto.adminEmail),
          phone:              dto.contactPhone   ?? null,
          address:            dto.ownerAddress   ?? null,

          ownerFirstName:     String(dto.adminFirstName),
          ownerLastName:      String(dto.adminLastName),
          ownerBirthDate:     dto.ownerBirthDate  ?? null,
          ownerBirthPlace:    dto.ownerBirthPlace ?? null,
          ownerCountry:       dto.ownerCountry    ?? null,
          ownerAddress:       dto.ownerAddress    ?? null,

          contactEmail:       dto.contactEmail   ?? dto.adminEmail,
          contactPhone:       dto.contactPhone   ?? null,
          activitySector:     dto.activitySector ?? null,

          allowedCurrencies:         SUPPORTED_CURRENCIES,
          featureScheduledTransfers: true,
          featureRateAlerts:         true,
          featureLoyaltyPoints:      false,
        },
      });

      for (const currency of SUPPORTED_CURRENCIES) {
        await tx.wallet.create({
          data: {
            clientId:  client.id,
            currency,
            balance:   0,
            isDefault: currency === primaryCurrency,
            isActive:  true,
          },
        });
      }

      const admin = await tx.user.create({
        data: {
          email:           String(dto.adminEmail),
          password:        hashedPassword,
          firstName:       String(dto.adminFirstName),
          lastName:        String(dto.adminLastName),
          role:            Role.COMPANY_ADMIN,
          clientId:        client.id,
          country:         ownerCountryCode    ?? null,
          primaryCurrency,
          phone:           normalizedAdminPhone,
          addressStreet:   dto.ownerAddress    ?? null,
          kycLevel:        KycLevel.LEVEL_1,
          isEmailVerified: true,
          referralCode:    generateReferralCode(dto.adminFirstName, dto.adminLastName),
        },
      });

      await tx.wallet.create({
        data: {
          userId:    admin.id,
          currency:  primaryCurrency,
          balance:   0,
          isDefault: true,
          isActive:  true,
        },
      });

      return { client, admin };
    });

    void this.companyMailService
      .sendWelcomeCompanyAdmin({
        email:             String(dto.adminEmail),
        firstName:         String(dto.adminFirstName),
        lastName:          String(dto.adminLastName),
        companyName:       dto.name,
        companyCode:       dto.code.toUpperCase(),
        temporaryPassword: plainPassword,
        userId:            result.admin.id,
      })
      .catch((err) => {
        this.logger.warn(
          `⚠️  Email de bienvenue non envoyé à ${dto.adminEmail} — société ${dto.code}`,
          err?.message ?? err,
        );
      });

    return result;
  }

  // ========================================================
  // LECTURE — Liste
  // ========================================================

  async findAll() {
    return this.prisma.client.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        _count:  { select: { users: true, agencies: true } },
        wallets: { where: { isActive: true } },
      },
    });
  }

  async findOne(id: number) {
    return this.prisma.client.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true, firstName: true, lastName: true,
            email: true, role: true,
          },
        },
        wallets: { where: { isActive: true } },
      },
    });
  }

  async findByCode(code: string) {
    return this.prisma.client.findFirst({
      where: { code: code.toUpperCase(), isActive: true },
    });
  }

  // ========================================================
  // BRANDING PUBLIC PAR CODE
  // ========================================================

  async findPublicByCode(code: string): Promise<PublicBranding | null> {
    const client = await this.prisma.client.findFirst({
      where: { code: code.toUpperCase(), isActive: true },
      select: PUBLIC_BRANDING_SELECT,
    });

    if (!client) return null;
    return this.mapPublicBranding(client);
  }

  // ========================================================
  // BRANDING PUBLIC PAR HOSTNAME
  // ========================================================

  async findPublicByHost(host: string): Promise<PublicBranding | null> {
    const normalizedHost = host.toLowerCase().trim();

    const parts = normalizedHost.split('.');
    const extractedSub =
      parts.length >= 3 && parts[0] !== 'www' ? parts[0] : null;

    const orConditions: any[] = [
      { customDomain: normalizedHost },
    ];

    if (extractedSub) {
      orConditions.push({ subdomain: extractedSub });
      orConditions.push({ code: extractedSub.toUpperCase() });
    }

    const client = await this.prisma.client.findFirst({
      where: {
        isActive: true,
        OR: orConditions,
      },
      orderBy: { createdAt: 'asc' },
      select: PUBLIC_BRANDING_SELECT,
    });

    if (!client) return null;
    return this.mapPublicBranding(client);
  }

  // ========================================================
  // MISE À JOUR — SUPER_ADMIN (tous champs, sans restriction)
  // ✅ Les nouveaux champs legalCompanyName/regulatorName/etc. sont
  // déjà utilisables ici sans rien ajouter : update() accepte `data: any`
  // et les passe tels quels à Prisma. PATCH /clients/:id avec
  // { "legalCompanyName": "...", "regulatorName": "...", ... } fonctionne
  // dès maintenant — pas besoin d'écran admin dédié pour commencer.
  // ========================================================

  async update(id: number, data: any) {
    const updateData: any = { ...data };
    delete updateData.adminEmail;
    delete updateData.adminFirstName;
    delete updateData.adminLastName;
    delete updateData.adminPassword;
    delete updateData.id;

    if (updateData.status) {
      updateData.subscriptionStatus = updateData.status;
      delete updateData.status;
    }

    if (updateData.country || updateData.ownerCountry) {
      const countryCode = (updateData.country ?? updateData.ownerCountry)
        ?.toUpperCase()
        .substring(0, 2);
      updateData.defaultCurrency = getCurrencyFromCountry(countryCode);
    }

    if (updateData.subdomain) {
      updateData.subdomain = String(updateData.subdomain).toLowerCase().trim() || null;
    }
    if (updateData.customDomain) {
      updateData.customDomain = String(updateData.customDomain).toLowerCase().trim() || null;
    }

    return this.prisma.client.update({ where: { id }, data: updateData });
  }

  async updateOwnName(clientId: number, name: string) {
    const trimmed = (name ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException('Le nom de la société est requis.');
    }
    if (trimmed.length > 120) {
      throw new BadRequestException('Le nom de la société est trop long (120 caractères max).');
    }

    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Société introuvable');

    return this.prisma.client.update({
      where: { id: clientId },
      data:  { name: trimmed },
    });
  }

  async updateStatus(id: number, status: SubscriptionStatus) {
    return this.prisma.client.update({
      where: { id },
      data:  { subscriptionStatus: status },
    });
  }

  // ========================================================
  // SUPPRESSION (désactivation en cascade)
  // ========================================================

  async remove(id: number) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: { wallets: { where: { isActive: true } } },
    });
    if (!client) throw new NotFoundException('Société introuvable');
    if (client.deletedAt) throw new NotFoundException('Société déjà supprimée');
    if (client.code === 'DONIKO') {
      throw new ConflictException(
        'Impossible de supprimer la société système DONIKO.',
      );
    }

    const users = await this.prisma.user.findMany({
      where: { clientId: id, deletedAt: null },
      select: { id: true, email: true },
    });
    const userIds = users.map((u) => u.id);

    const agencies = await this.prisma.agency.findMany({
      where: { clientId: id, deletedAt: null },
      select: { id: true },
    });
    const agencyIds = agencies.map((a) => a.id);

    const warnings: string[] = [];

    const clientBalance = client.wallets.reduce((sum, w) => sum + Number(w.balance), 0);
    if (clientBalance !== 0) {
      warnings.push(
        `Le wallet de la société conservait un solde de ${clientBalance} au moment de la désactivation — à réconcilier séparément.`,
      );
    }

    if (userIds.length > 0) {
      const userWallets = await this.prisma.wallet.findMany({
        where: { userId: { in: userIds }, isActive: true },
        select: { balance: true },
      });
      const usersBalance = userWallets.reduce((sum, w) => sum + Number(w.balance), 0);
      if (usersBalance !== 0) {
        warnings.push(
          `Les wallets des ${userIds.length} utilisateur(s) conservaient un solde total de ${usersBalance} — à réconcilier séparément.`,
        );
      }
    }

    if (agencyIds.length > 0) {
      const agencyWallets = await this.prisma.wallet.findMany({
        where: { agencyId: { in: agencyIds }, isActive: true },
        select: { balance: true },
      });
      const agenciesBalance = agencyWallets.reduce((sum, w) => sum + Number(w.balance), 0);
      if (agenciesBalance !== 0) {
        warnings.push(
          `Les wallets des ${agencyIds.length} agence(s) conservaient un solde total de ${agenciesBalance} — à réconcilier séparément.`,
        );
      }
    }

    const updatedClient = await this.prisma.$transaction(async (tx) => {
      if (userIds.length > 0) {
        try { await tx.otpLog.deleteMany({ where: { userId: { in: userIds } } }); } catch (_) {}
        try { await tx.userDevice.deleteMany({ where: { userId: { in: userIds } } }); } catch (_) {}
        try { await tx.userSession.deleteMany({ where: { userId: { in: userIds } } }); } catch (_) {}

        await tx.wallet.updateMany({
          where: { userId: { in: userIds }, isActive: true },
          data:  { isActive: false },
        });

        await tx.user.updateMany({
          where: { id: { in: userIds }, deletedAt: null },
          data:  { deletedAt: new Date(), isActive: false, isSuspended: true, phone: null },
        });
        for (const u of users) {
          await tx.user.update({
            where: { id: u.id },
            data:  { email: `deleted_${Date.now()}_${u.email}` },
          });
        }
      }

      if (agencyIds.length > 0) {
        await tx.wallet.updateMany({
          where: { agencyId: { in: agencyIds }, isActive: true },
          data:  { isActive: false },
        });

        await tx.agency.updateMany({
          where: { id: { in: agencyIds }, deletedAt: null },
          data:  { deletedAt: new Date(), isActive: false, code: null },
        });
      }

      await tx.wallet.updateMany({
        where: { clientId: id, isActive: true },
        data:  { isActive: false },
      });

      return tx.client.update({
        where: { id },
        data: {
          deletedAt:    new Date(),
          isActive:     false,
          code:         `DELETED_${Date.now()}_${client.code}`,
          subdomain:    null,
          customDomain: null,
        },
      });
    });

    return { ...updatedClient, warnings };
  }
}