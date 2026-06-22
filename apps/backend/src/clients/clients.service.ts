// apps/backend/src/clients/clients.service.ts
// =========================================================
// CLIENTS SERVICE v4.5
// ✅ v4.4 conservé intégralement
// ✅ v4.5 — Portail web dédié par société :
//   1. mapPublicBranding() : helper privé partagé entre
//      findPublicByCode() et findPublicByHost()
//      → supprime la duplication, garantit la cohérence
//      → retourne désormais subdomain + customDomain
//   2. findPublicByCode() : refactorisé via mapPublicBranding()
//      → sélectionne subdomain + customDomain en plus
//   3. findPublicByHost(host) : NOUVEAU
//      → recherche par customDomain exact (domaine custom)
//      → puis par subdomain (ex: "flash" dans flash.direct-transfer.com)
//      → puis par code comme fallback (ex: "FLASH")
//      → appelé par GET /branding/by-host?host=flash.direct-transfer.com
//   4. create() : persiste subdomain + customDomain depuis le DTO
//      → normalisation : lowercase + trim sur les deux champs
// =========================================================

import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import * as bcrypt from 'bcryptjs';
import { CurrencyCode, KycLevel, Role, SubscriptionStatus } from '@prisma/client';
import * as crypto from 'crypto';

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
  subdomain:      string | null;  // ✅ v4.5
  customDomain:   string | null;  // ✅ v4.5
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
  subdomain:      true,  // ✅ v4.5
  customDomain:   true,  // ✅ v4.5
  isActive:       true,
} as const;

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  // ========================================================
  // HELPER PRIVÉ — mapping branding public ✅ v4.5
  // Centralisé pour garantir la cohérence entre findPublicByCode()
  // et findPublicByHost() (plus de duplication, plus de divergence)
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
      subdomain:      client.subdomain      ?? null,  // ✅ v4.5
      customDomain:   client.customDomain   ?? null,  // ✅ v4.5
      isActive:       client.isActive,
    };
  }

  // ========================================================
  // CRÉATION
  // ✅ v4.5 : subdomain + customDomain persistés depuis le DTO
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

    // ✅ v4.5 — Vérification unicité subdomain/customDomain avant transaction
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

    const hashedPassword = await bcrypt.hash(String(dto.adminPassword), 10);
    const ownerCountryCode = dto.ownerCountry?.toUpperCase().substring(0, 2);
    const primaryCurrency: CurrencyCode = getCurrencyFromCountry(ownerCountryCode);

    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          code:               dto.code.toUpperCase(),
          name:               dto.name,

          // ─── Branding ────────────────────────────────────
          primaryColor:       dto.primaryColor   ?? '#059669',
          secondaryColor:     dto.secondaryColor ?? '#10B981',
          logoUrl:            dto.logoUrl        ?? null,
          tagline:            dto.tagline        ?? null,
          fontFamily:         dto.fontFamily     ?? null,
          splashBgColor:      dto.splashBgColor  ?? null,
          welcomeMessage:     dto.welcomeMessage ?? null,

          // ─── Portail web dédié ✅ v4.5 ───────────────────
          subdomain:    dto.subdomain?.toLowerCase().trim()    ?? null,
          customDomain: dto.customDomain?.toLowerCase().trim() ?? null,

          // ─── Abonnement ──────────────────────────────────
          subscriptionType:   dto.subscriptionType ?? 'RENTAL',
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          defaultCurrency:    primaryCurrency,

          // ─── Coordonnées ─────────────────────────────────
          country:            ownerCountryCode   ?? null,
          email:              String(dto.adminEmail),
          phone:              dto.contactPhone   ?? null,
          address:            dto.ownerAddress   ?? null,

          // ─── Propriétaire légal ──────────────────────────
          ownerFirstName:     String(dto.adminFirstName),
          ownerLastName:      String(dto.adminLastName),
          ownerBirthDate:     dto.ownerBirthDate  ?? null,
          ownerBirthPlace:    dto.ownerBirthPlace ?? null,
          ownerCountry:       dto.ownerCountry    ?? null,
          ownerAddress:       dto.ownerAddress    ?? null,

          // ─── Contact opérationnel ────────────────────────
          contactEmail:       dto.contactEmail   ?? dto.adminEmail,
          contactPhone:       dto.contactPhone   ?? null,
          activitySector:     dto.activitySector ?? null,

          // ─── Devises & features ──────────────────────────
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
  // ✅ v4.5 : refactorisé via mapPublicBranding() + subdomain/customDomain
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
  // BRANDING PUBLIC PAR HOSTNAME — ✅ v4.5 NOUVEAU
  // Appelé par GET /branding/by-host?host=flash.direct-transfer.com
  //
  // Stratégie de résolution (dans l'ordre) :
  //   1. customDomain exact  → "www.flash-transfer.com"
  //   2. subdomain extrait   → "flash" de "flash.direct-transfer.com"
  //   3. code = subdomain    → fallback si subdomain non renseigné mais code = sous-domaine
  //
  // Sécurité : isActive: true → sociétés suspendues bloquées à la source
  // ========================================================

  async findPublicByHost(host: string): Promise<PublicBranding | null> {
    const normalizedHost = host.toLowerCase().trim();

    // Extraire le sous-domaine potentiel : "flash" depuis "flash.direct-transfer.com"
    const parts = normalizedHost.split('.');
    // Un sous-domaine valide = premier segment si le host a ≥ 3 parties et le premier n'est pas "www"
    const extractedSub =
      parts.length >= 3 && parts[0] !== 'www' ? parts[0] : null;

    const orConditions: any[] = [
      // Priorité 1 : domaine custom exact
      { customDomain: normalizedHost },
    ];

    if (extractedSub) {
      // Priorité 2 : sous-domaine Prisma
      orConditions.push({ subdomain: extractedSub });
      // Priorité 3 : code société = sous-domaine (fallback rétrocompat)
      orConditions.push({ code: extractedSub.toUpperCase() });
    }

    const client = await this.prisma.client.findFirst({
      where: {
        isActive: true,
        OR: orConditions,
      },
      // Priorité customDomain > subdomain > code : ordonné par pertinence
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

    // ✅ v4.5 : normaliser subdomain/customDomain si fournis
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