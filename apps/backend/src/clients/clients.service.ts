// apps/backend/src/clients/clients.service.ts
// =========================================================
// CLIENTS SERVICE v4.4
// ✅ v4.3 conservé intégralement
// ✅ v4.4 — FIXES BRANDING ISOLATION :
//   1. create() : tagline / fontFamily / splashBgColor /
//      welcomeMessage ajoutés dans tx.client.create
//      → étaient dans le DTO mais jamais persistés en base
//   2. findPublicByCode() : ces 4 champs ajoutés dans select
//      + suppression du cast (as any) inutile et fragile
//      → le /branding/:code retournait toujours null pour ces champs
//   3. primaryColor default harmonisé : '#059669' partout
//      (était '#F7931E' dans create, '#059669' dans findPublicByCode)
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

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

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

    const hashedPassword = await bcrypt.hash(String(dto.adminPassword), 10);

    const ownerCountryCode = dto.ownerCountry?.toUpperCase().substring(0, 2);
    const primaryCurrency: CurrencyCode = getCurrencyFromCountry(ownerCountryCode);

    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          code:               dto.code.toUpperCase(),
          name:               dto.name,

          // ─── Branding ────────────────────────────────────
          // ✅ v4.4 : default harmonisé '#059669' (était '#F7931E')
          primaryColor:       dto.primaryColor   ?? '#059669',
          secondaryColor:     dto.secondaryColor ?? '#10B981',
          logoUrl:            dto.logoUrl        ?? null,
          // ✅ v4.4 : 4 champs AJOUTÉS — étaient dans le DTO mais jamais
          //           persistés, donc branding toujours identique entre sociétés
          tagline:            dto.tagline        ?? null,
          fontFamily:         dto.fontFamily     ?? null,
          splashBgColor:      dto.splashBgColor  ?? null,
          welcomeMessage:     dto.welcomeMessage ?? null,

          // ─── Abonnement ──────────────────────────────────
          subscriptionType:   dto.subscriptionType,
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
  // LECTURE
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
  // BRANDING PUBLIC — aucune donnée sensible exposée
  // ✅ Appelé sans auth depuis GET /branding/:code
  // ✅ v4.4 : tous les champs branding sélectionnés
  //           + suppression du cast (as any) fragile
  // ========================================================

  async findPublicByCode(code: string) {
    const client = await this.prisma.client.findFirst({
      where: { code: code.toUpperCase(), isActive: true },
      select: {
        code:           true,
        name:           true,
        logoUrl:        true,
        primaryColor:   true,
        secondaryColor: true,
        // ✅ v4.4 : champs branding ajoutés — existaient dans le schéma
        //           mais n'étaient pas sélectionnés → toujours null côté frontend
        tagline:        true,
        fontFamily:     true,
        splashBgColor:  true,
        welcomeMessage: true,
        isActive:       true,
      },
    });

    if (!client) return null;

    // ✅ v4.4 : plus de cast (as any) — tous les champs sont typés Prisma
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
      isActive:       client.isActive,
    };
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