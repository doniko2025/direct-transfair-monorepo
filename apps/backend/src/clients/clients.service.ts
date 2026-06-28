// apps/backend/src/clients/clients.service.ts
// =========================================================
// CLIENTS SERVICE v4.6
// ✅ v4.5 conservé intégralement
// ✅ v4.6 : Email de bienvenue automatique après création
//   → sendWelcomeCompanyAdmin() déclenché après la transaction
//   → Non-bloquant : un échec mail ne casse jamais la création
//   → Logger NestJS pour traçabilité des erreurs mail
//   → Logger + CompanyMailService injectés
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
};

// ─── Sélection Prisma partagée ────────────────────────────
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
    };
  }

  // ========================================================
  // CRÉATION
  // ✅ v4.6 : email de bienvenue envoyé après la transaction
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

    // ✅ v4.6 : on garde le mot de passe en clair AVANT le hachage
    // pour pouvoir l'inclure dans l'email de bienvenue
    const plainPassword   = String(dto.adminPassword);
    const hashedPassword  = await bcrypt.hash(plainPassword, 10);
    const ownerCountryCode = dto.ownerCountry?.toUpperCase().substring(0, 2);
    const primaryCurrency: CurrencyCode = getCurrencyFromCountry(ownerCountryCode);

    // ─── Transaction Prisma ─────────────────────────────
    const result = await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          code:               dto.code.toUpperCase(),
          name:               dto.name,

          // ─── Branding ──────────────────────────────────
          primaryColor:       dto.primaryColor   ?? '#059669',
          secondaryColor:     dto.secondaryColor ?? '#10B981',
          logoUrl:            dto.logoUrl        ?? null,
          tagline:            dto.tagline        ?? null,
          fontFamily:         dto.fontFamily     ?? null,
          splashBgColor:      dto.splashBgColor  ?? null,
          welcomeMessage:     dto.welcomeMessage ?? null,

          // ─── Portail web dédié ─────────────────────────
          subdomain:    dto.subdomain?.toLowerCase().trim()    ?? null,
          customDomain: dto.customDomain?.toLowerCase().trim() ?? null,

          // ─── Abonnement ────────────────────────────────
          subscriptionType:   dto.subscriptionType ?? 'RENTAL',
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          defaultCurrency:    primaryCurrency,

          // ─── Coordonnées ───────────────────────────────
          country:            ownerCountryCode   ?? null,
          email:              String(dto.adminEmail),
          phone:              dto.contactPhone   ?? null,
          address:            dto.ownerAddress   ?? null,

          // ─── Propriétaire légal ────────────────────────
          ownerFirstName:     String(dto.adminFirstName),
          ownerLastName:      String(dto.adminLastName),
          ownerBirthDate:     dto.ownerBirthDate  ?? null,
          ownerBirthPlace:    dto.ownerBirthPlace ?? null,
          ownerCountry:       dto.ownerCountry    ?? null,
          ownerAddress:       dto.ownerAddress    ?? null,

          // ─── Contact opérationnel ──────────────────────
          contactEmail:       dto.contactEmail   ?? dto.adminEmail,
          contactPhone:       dto.contactPhone   ?? null,
          activitySector:     dto.activitySector ?? null,

          // ─── Devises & features ────────────────────────
          allowedCurrencies:         SUPPORTED_CURRENCIES,
          featureScheduledTransfers: true,
          featureRateAlerts:         true,
          featureLoyaltyPoints:      false,
        },
      });

      // Wallets société (un par devise supportée)
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

      // Admin COMPANY_ADMIN
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
          phone:           dto.contactPhone    ?? null,
          addressStreet:   dto.ownerAddress    ?? null,
          kycLevel:        KycLevel.LEVEL_1,
          isEmailVerified: true,
          referralCode:    generateReferralCode(dto.adminFirstName, dto.adminLastName),
        },
      });

      // Wallet personnel de l'admin
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

    // ─── Email de bienvenue ─────────────────────────────
    // ✅ v4.6 : exécuté APRÈS la transaction, non-bloquant.
    // Un échec d'envoi ne rollback jamais la création.
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
    return this.prisma.client.findUnique({
      where: { code: code.toUpperCase() },
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
  // MISE À JOUR
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

  async updateStatus(id: number, status: SubscriptionStatus) {
    return this.prisma.client.update({
      where: { id },
      data:  { subscriptionStatus: status },
    });
  }

  // ========================================================
  // SUPPRESSION
  // ========================================================

  async remove(id: number) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException('Société introuvable');
    if (client.code === 'DONIKO') {
      throw new ConflictException(
        'Impossible de supprimer la société système DONIKO.',
      );
    }
    await this.prisma.user.deleteMany({ where: { clientId: id } });
    await this.prisma.wallet.deleteMany({ where: { clientId: id } });
    return this.prisma.client.delete({ where: { id } });
  }
}