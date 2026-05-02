// apps/backend/src/users/users.service.ts
// =========================================================
// USERS SERVICE v4.0
// ✅ Wallet auto créé selon country à la création d'un user
// ✅ primaryCurrency déduit du pays
// =========================================================

import { Injectable } from '@nestjs/common';
import { KycLevel, Role, User } from '@prisma/client';
import * as crypto from 'crypto';

import { PrismaService } from '../prisma/prisma.service';

// =========================================================
// HELPERS
// =========================================================

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

// =========================================================
// TYPES
// =========================================================

type UserExtraFields = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  gender?: string;
  jobTitle?: string;
  addressStreet?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  nationality?: string;
  birthDate?: string;
  birthPlace?: string;
};

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ========================================================
  // LECTURE
  // ========================================================

  async findAll(whereClause: any) {
    return this.prisma.user.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        country: true,
        primaryCurrency: true,
        kycLevel: true,
        isActive: true,
        isSuspended: true,
        createdAt: true,
        client: { select: { name: true, code: true } },
        agency: { select: { name: true, id: true } },
        wallets: {
          where: { isActive: true },
          select: { currency: true, balance: true, isDefault: true },
        },
      },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        client: true,
        agency: true,
        wallets: { where: { isActive: true } },
      },
    });
  }

  // ========================================================
  // CRÉATION
  // ========================================================

  /**
   * Crée un utilisateur et son wallet principal selon son pays
   */
  async create(
    email: string,
    passwordHash: string,
    role: Role,
    clientId: number,
    extra: UserExtraFields = {},
  ): Promise<User> {
    const primaryCurrency = getCurrencyFromCountry(extra.country);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: email.trim().toLowerCase(),
          password: passwordHash,
          role,
          clientId,
          primaryCurrency,
          kycLevel: KycLevel.LEVEL_0,
          referralCode: generateReferralCode(extra.firstName, extra.lastName),
          ...extra,
        },
      });

      // ✅ Wallet principal selon pays
      await tx.wallet.create({
        data: {
          userId: user.id,
          currency: primaryCurrency,
          balance: 0,
          isDefault: true,
          isActive: true,
        },
      });

      return user;
    });
  }

  // ========================================================
  // MISE À JOUR
  // ========================================================

  async update(id: string, data: Partial<UserExtraFields & { primaryCurrency?: string }>) {
    // Si le pays change, recalcule la devise
    if (data.country) {
      data.primaryCurrency = getCurrencyFromCountry(data.country);
    }
    return this.prisma.user.update({ where: { id }, data });
  }
}