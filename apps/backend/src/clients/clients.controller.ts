// apps/backend/src/clients/clients.service.ts
// =========================================================
// CLIENTS SERVICE v4.1
// ✅ findAll() exclut le client système DONIKO
//    (la plateforme ne doit pas apparaître dans la liste des sociétés)
// ✅ Reste identique à v4.0
// =========================================================

import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import * as bcrypt from 'bcryptjs';
import { KycLevel, Role, SubscriptionStatus } from '@prisma/client';
import * as crypto from 'crypto';

const SUPPORTED_CURRENCIES = ['XOF', 'EUR', 'USD', 'GNF', 'GBP'];

// Code du client système — ne jamais l'afficher dans la liste des sociétés clientes
const PLATFORM_CLIENT_CODE = 'DONIKO';

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  FR: 'EUR', DE: 'EUR', IT: 'EUR', ES: 'EUR', BE: 'EUR', PT: 'EUR',
  NL: 'EUR', AT: 'EUR', FI: 'EUR', IE: 'EUR', LU: 'EUR', GR: 'EUR',
  GB: 'GBP', GG: 'GBP', JE: 'GBP', IM: 'GBP',
  US: 'USD', SV: 'USD', PA: 'USD', EC: 'USD',
  GN: 'GNF',
  SN: 'XOF', CI: 'XOF', ML: 'XOF', BF: 'XOF', BJ: 'XOF',
  TG: 'XOF', NE: 'XOF', GW: 'XOF',
};

function getCurrencyFromCountry(country?: string | null): string {
  if (!country) return 'XOF';
  const code = country.toUpperCase().trim().substring(0, 2);
  return COUNTRY_TO_CURRENCY[code] ?? 'XOF';
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

    const hashedPassword = await bcrypt.hash(dto.adminPassword, 10);

    const ownerCountryCode = dto.ownerCountry?.toUpperCase().substring(0, 2);
    const primaryCurrency = getCurrencyFromCountry(ownerCountryCode);

    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          code: dto.code.toUpperCase(),
          name: dto.name,
          primaryColor: dto.primaryColor ?? '#F7931E',
          subscriptionType: dto.subscriptionType,
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          defaultCurrency: primaryCurrency,
          country: ownerCountryCode ?? null,
          logoUrl: dto.logoUrl ?? null,
          email: dto.adminEmail,
          phone: dto.contactPhone ?? null,
          address: dto.ownerAddress ?? null,
          ownerFirstName: dto.adminFirstName,
          ownerLastName: dto.adminLastName,
          ownerBirthDate: dto.ownerBirthDate ?? null,
          ownerBirthPlace: dto.ownerBirthPlace ?? null,
          ownerCountry: dto.ownerCountry ?? null,
          ownerAddress: dto.ownerAddress ?? null,
          contactEmail: dto.contactEmail ?? dto.adminEmail,
          contactPhone: dto.contactPhone ?? null,
          activitySector: dto.activitySector ?? null,
          allowedCurrencies: SUPPORTED_CURRENCIES,
          featureScheduledTransfers: true,
          featureRateAlerts: true,
          featureLoyaltyPoints: false,
        },
      });

      // 5 wallets pour la société
      for (const currency of SUPPORTED_CURRENCIES) {
        await tx.wallet.create({
          data: {
            clientId: client.id,
            currency,
            balance: 0,
            isDefault: currency === primaryCurrency,
            isActive: true,
          },
        });
      }

      const admin = await tx.user.create({
        data: {
          email: dto.adminEmail,
          password: hashedPassword,
          firstName: dto.adminFirstName,
          lastName: dto.adminLastName,
          role: Role.COMPANY_ADMIN,
          clientId: client.id,
          country: ownerCountryCode ?? null,
          primaryCurrency,
          phone: dto.contactPhone ?? null,
          addressStreet: dto.ownerAddress ?? null,
          kycLevel: KycLevel.LEVEL_1,
          isEmailVerified: true,
          referralCode: generateReferralCode(dto.adminFirstName, dto.adminLastName),
        },
      });

      await tx.wallet.create({
        data: {
          userId: admin.id,
          currency: primaryCurrency,
          balance: 0,
          isDefault: true,
          isActive: true,
        },
      });

      return { client, admin };
    });
  }

  // ========================================================
  // LECTURE
  // ========================================================

  async findAll() {
    // ✅ FIX v4.1 — exclut DONIKO (client système plateforme)
    // DONIKO est le compte de la plateforme elle-même, pas une société cliente.
    // Il ne doit jamais apparaître dans la liste des sociétés gérées.
    return this.prisma.client.findMany({
      where: {
        code: { not: PLATFORM_CLIENT_CODE },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { users: true, agencies: true } },
        wallets: { where: { isActive: true } },
      },
    });
  }

  async findOne(id: number) {
    return this.prisma.client.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true, firstName: true, lastName: true, email: true, role: true },
        },
        wallets: { where: { isActive: true } },
      },
    });
  }

  async findByCode(code: string) {
    return this.prisma.client.findUnique({ where: { code: code.toUpperCase() } });
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

    return this.prisma.client.update({
      where: { id },
      data: updateData,
    });
  }

  async updateStatus(id: number, status: SubscriptionStatus) {
    return this.prisma.client.update({
      where: { id },
      data: { subscriptionStatus: status },
    });
  }

  // ========================================================
  // SUPPRESSION
  // ========================================================

  async remove(id: number) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException('Société introuvable');
    if (client.code === PLATFORM_CLIENT_CODE) {
      throw new ConflictException('Impossible de supprimer la société système DONIKO.');
    }

    await this.prisma.user.deleteMany({ where: { clientId: id } });
    await this.prisma.wallet.deleteMany({ where: { clientId: id } });
    return this.prisma.client.delete({ where: { id } });
  }
}