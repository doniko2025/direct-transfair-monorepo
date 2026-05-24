// apps/backend/src/users/users.service.ts
// =========================================================
// USERS SERVICE v4.1
// ✅ FIX: CurrencyCode enum cast (migration v4.1)
// =========================================================

import { Injectable } from '@nestjs/common';
import { CurrencyCode, KycLevel, Role, User } from '@prisma/client';
import * as crypto from 'crypto';

import { PrismaService } from '../prisma/prisma.service';

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

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

  async create(
    email: string,
    passwordHash: string,
    role: Role,
    clientId: number,
    extra: UserExtraFields = {},
  ): Promise<User> {
    // ✅ FIX: CurrencyCode
    const primaryCurrency: CurrencyCode = getCurrencyFromCountry(extra.country);

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

  // ✅ Après
async update(id: string, data: Partial<UserExtraFields & { primaryCurrency?: CurrencyCode }>) {
  if (data.country) {
    data.primaryCurrency = getCurrencyFromCountry(data.country);
  }
  return this.prisma.user.update({ where: { id }, data });
}
}