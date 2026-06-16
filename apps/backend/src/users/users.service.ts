// apps/backend/src/users/users.service.ts
// =========================================================
// USERS SERVICE v4.2 → v4.3
// ✅ v4.0-4.2 : findAll, findByEmail, findById, create, update
//               + CurrencyCode enum cast, getCurrencyFromCountry
// ✅ v4.3 : Ajout des 3 méthodes manquantes pour le controller v4.1 :
//   - suspend(id, reason)   → isSuspended=true + horodatage
//   - reactivate(id)        → isSuspended=false + nettoyage raison
//   - softDelete(id)        → deletedAt + isActive=false (données conservées)
//   - serializeForAdmin(user) → sérialisation complète pour la fiche admin
//
//   AUCUNE modification des méthodes existantes.
// =========================================================

import { Injectable, NotFoundException } from '@nestjs/common';
import { CurrencyCode, KycLevel, Role, User } from '@prisma/client';
import * as crypto from 'crypto';

import { PrismaService } from '../prisma/prisma.service';

// =========================================================
// HELPERS (inchangés depuis v4.2)
// =========================================================

const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  FR: CurrencyCode.EUR, DE: CurrencyCode.EUR, IT: CurrencyCode.EUR,
  ES: CurrencyCode.EUR, BE: CurrencyCode.EUR, PT: CurrencyCode.EUR,
  NL: CurrencyCode.EUR, AT: CurrencyCode.EUR, FI: CurrencyCode.EUR,
  IE: CurrencyCode.EUR, LU: CurrencyCode.EUR, GR: CurrencyCode.EUR,
  SI: CurrencyCode.EUR, SK: CurrencyCode.EUR, EE: CurrencyCode.EUR,
  LT: CurrencyCode.EUR, LV: CurrencyCode.EUR, MT: CurrencyCode.EUR, CY: CurrencyCode.EUR,
  GB: CurrencyCode.GBP, GG: CurrencyCode.GBP, JE: CurrencyCode.GBP, IM: CurrencyCode.GBP,
  US: CurrencyCode.USD, SV: CurrencyCode.USD, PA: CurrencyCode.USD, EC: CurrencyCode.USD,
  GN: CurrencyCode.GNF,
  SN: CurrencyCode.XOF, CI: CurrencyCode.XOF, ML: CurrencyCode.XOF, BF: CurrencyCode.XOF,
  BJ: CurrencyCode.XOF, TG: CurrencyCode.XOF, NE: CurrencyCode.XOF, GW: CurrencyCode.XOF,
};

// ✅ Gère les noms complets en plus des codes ISO (inchangé v4.2)
function getCurrencyFromCountry(country?: string | null): CurrencyCode {
  if (!country) return CurrencyCode.XOF;
  const raw = country.trim();

  if (raw.length <= 3) {
    const found = COUNTRY_TO_CURRENCY[raw.toUpperCase()];
    if (found) return found;
  }

  const u = raw
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (u.includes('GUIN') && !u.includes('BISS') && !u.includes('EQUAT')) return CurrencyCode.GNF;
  if (u.includes('GUIN') && u.includes('BISS')) return CurrencyCode.XOF;

  if (['FRANCE','ALLEMAGNE','BELGIQUE','PORTUGAL','ESPAGNE',
       'ITALIE','PAYS-BAS','LUXEMBOURG','AUTRICHE','FINLANDE',
       'IRLANDE','GRECE','SLOVENIE','SLOVAQUIE','ESTONIE',
       'LITUANIE','LETTONIE','MALTE','CHYPRE'].some((k) => u.includes(k)))
    return CurrencyCode.EUR;

  if (u.includes('ROYAUME') || u === 'UK' || u === 'ANGLETERRE') return CurrencyCode.GBP;
  if ((u.includes('ETATS') && u.includes('UNIS')) || u === 'USA') return CurrencyCode.USD;

  if (['SENEGAL','MALI','BENIN','TOGO','IVOIRE','BURKINA','BISSAU']
    .some((k) => u.includes(k))) return CurrencyCode.XOF;
  if (u.includes('NIGER') && !u.includes('NIGERIA') && !u.includes('NIGERI')) return CurrencyCode.XOF;

  const code = raw.toUpperCase().substring(0, 2);
  return COUNTRY_TO_CURRENCY[code] ?? CurrencyCode.XOF;
}

function generateReferralCode(firstName?: string, lastName?: string): string {
  const prefix = `${(firstName ?? 'U').slice(0, 1)}${(lastName ?? 'X').slice(0, 1)}`.toUpperCase();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}${suffix}`;
}

// =========================================================
// TYPES (inchangés)
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
  mobileMoneyOperator?: string;
  mobileMoneyNumber?: string;
};

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────────────
  // findAll (inchangé v4.2)
  // ──────────────────────────────────────────────────────
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
        city: true,
        primaryCurrency: true,
        kycLevel: true,
        complianceStatus: true,
        isActive: true,
        isSuspended: true,
        deletedAt: true,
        createdAt: true,
        client: { select: { name: true, code: true } },
        agency: { select: { name: true, id: true } },
        wallets: {
          where: { isActive: true },
          select: {
            id: true,
            currency: true,
            balance: true,
            reservedBalance: true,
            isDefault: true,
            isFrozen: true,
          },
        },
      },
    });
  }

  // ──────────────────────────────────────────────────────
  // findByEmail (inchangé v4.2)
  // ──────────────────────────────────────────────────────
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
  }

  // ──────────────────────────────────────────────────────
  // findById (inchangé v4.2) — utilisé par le controller v4.1
  // ──────────────────────────────────────────────────────
  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        client: true,
        agency: true,
        wallets: {
          where:   { isActive: true },
          orderBy: { currency: 'asc' },
        },
      },
    });
  }

  // ──────────────────────────────────────────────────────
  // create (inchangé v4.2)
  // ──────────────────────────────────────────────────────
  async create(
    email: string,
    passwordHash: string,
    role: Role,
    clientId: number,
    extra: UserExtraFields = {},
  ): Promise<User> {
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
          userId:    user.id,
          currency:  primaryCurrency,
          balance:   0,
          isDefault: true,
          isActive:  true,
        },
      });

      return user;
    });
  }

  // ──────────────────────────────────────────────────────
  // update (inchangé v4.2)
  // ──────────────────────────────────────────────────────
  async update(
    id: string,
    data: Partial<UserExtraFields & { primaryCurrency?: CurrencyCode }>,
  ) {
    if (data.country) {
      data.primaryCurrency = getCurrencyFromCountry(data.country);
    }
    return this.prisma.user.update({ where: { id }, data });
  }

  // ──────────────────────────────────────────────────────
  // ✅ v4.3 — suspend
  // Marque le compte comme suspendu avec une raison optionnelle.
  // N'affecte pas les wallets ni les transactions existantes.
  // ──────────────────────────────────────────────────────
  async suspend(id: string, reason?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.deletedAt) throw new NotFoundException('Ce compte a été supprimé');

    return this.prisma.user.update({
      where: { id },
      data: {
        isSuspended:     true,
        suspendedAt:     new Date(),
        suspendedReason: reason?.trim() || 'Suspendu par l\'administrateur',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isSuspended: true,
        suspendedAt: true,
        suspendedReason: true,
      },
    });
  }

  // ──────────────────────────────────────────────────────
  // ✅ v4.3 — reactivate
  // Remet le compte en état actif, efface la raison de suspension.
  // ──────────────────────────────────────────────────────
  async reactivate(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, deletedAt: true, isSuspended: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.deletedAt) throw new NotFoundException('Ce compte a été supprimé');

    return this.prisma.user.update({
      where: { id },
      data: {
        isSuspended:     false,
        suspendedAt:     null,
        suspendedReason: null,
        isActive:        true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isSuspended: true,
        isActive: true,
      },
    });
  }

  // ──────────────────────────────────────────────────────
  // ✅ v4.3 — softDelete
  // Soft delete conforme RGPD/fintech :
  //   - deletedAt → horodatage de suppression
  //   - isActive  → false (compte inaccessible)
  // Les données (transactions, wallets) sont conservées pour
  // la traçabilité réglementaire et l'audit financier.
  // ──────────────────────────────────────────────────────
  async softDelete(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    // Idempotent : déjà supprimé → on retourne l'état actuel
    if (user.deletedAt) {
      return {
        id,
        deleted: true,
        deletedAt: user.deletedAt,
        message: 'Ce compte était déjà supprimé',
      };
    }

    const deleted = await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt:   new Date(),
        isActive:    false,
        isSuspended: true, // Empêche toute connexion résiduelle
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        deletedAt: true,
        isActive: true,
      },
    });

    return {
      ...deleted,
      deleted: true,
      message: 'Compte supprimé avec succès (données conservées pour audit)',
    };
  }

  // ──────────────────────────────────────────────────────
  // ✅ v4.3 — serializeForAdmin
  // Prépare la réponse complète pour la fiche admin :
  // balances numériques, champs sensibles exclus (password, otpCode…)
  // ──────────────────────────────────────────────────────
  serializeForAdmin(user: any) {
    const {
      password, otpCode, otpExpiresAt, mfaSecret, mfaBackupCodes,
      ...safe
    } = user;

    return {
      ...safe,
      wallets: (user.wallets ?? []).map((w: any) => ({
        id:               w.id,
        currency:         w.currency,
        balance:          Number(w.balance ?? 0),
        reservedBalance:  Number(w.reservedBalance ?? 0),
        availableBalance: Number(w.balance ?? 0) - Number(w.reservedBalance ?? 0),
        isDefault:        w.isDefault,
        isActive:         w.isActive,
        isFrozen:         w.isFrozen ?? false,
        frozenReason:     w.frozenReason ?? null,
      })),
    };
  }
}