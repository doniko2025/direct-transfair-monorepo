// apps/backend/src/agencies/agencies.service.ts
// =========================================================
// AGENCIES SERVICE v4.0
// ✅ Plus de agency.balance / agency.cash / agency.currency (supprimés schéma v4)
// ✅ Wallets créés automatiquement selon country
// ✅ primaryCurrency déduit du pays
// =========================================================

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KycLevel, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';

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

function safeTrim(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function generateReferralCode(firstName?: string, lastName?: string): string {
  const prefix = `${(firstName ?? 'A').slice(0, 1)}${(lastName ?? 'G').slice(0, 1)}`.toUpperCase();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}${suffix}`;
}

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class AgenciesService {
  constructor(private readonly prisma: PrismaService) {}

  // ========================================================
  // CRÉATION
  // ========================================================

  async create(clientId: number, dto: CreateAgencyDto) {
    if (!clientId || !Number.isFinite(clientId)) {
      throw new BadRequestException('clientId invalide');
    }

    const email = safeTrim(dto.email).toLowerCase();
    if (!email) throw new BadRequestException('Email requis');

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser)
      throw new ConflictException(`L'email "${email}" est déjà utilisé.`);

    if (dto.code) {
      const existingCode = await this.prisma.agency.findUnique({
        where: { code: dto.code },
      });
      if (existingCode)
        throw new ConflictException(`Le code "${dto.code}" est déjà utilisé.`);
    }

    const hashedPassword = await bcrypt.hash(
      safeTrim(dto.adminPassword) || '123456',
      10,
    );

    // ✅ Devise déduite du pays
    const primaryCurrency = getCurrencyFromCountry(dto.country);

    return this.prisma.$transaction(async (tx) => {
      // 1. Crée l'agence
      const agency = await tx.agency.create({
        data: {
          name: safeTrim(dto.name),
          city: safeTrim(dto.city),
          address: safeTrim(dto.address),
          phone: safeTrim(dto.phone) || null,
          code: dto.code || null,
          email: email,
          country: dto.country || null,
          primaryCurrency, // ✅ v4 — remplace currency
          isActive: true,
          clientId,
        },
      });

      // ✅ 2. Wallet de l'agence dans sa devise principale
      await tx.wallet.create({
        data: {
          agencyId: agency.id,
          currency: primaryCurrency,
          balance: 0,
          isDefault: true,
          isActive: true,
        },
      });

      // 3. Crée l'agent responsable
      const agent = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName: safeTrim(dto.adminFirstName) || 'Agent',
          lastName: safeTrim(dto.adminLastName) || 'Agence',
          role: Role.AGENT,
          clientId,
          agencyId: agency.id,
          phone: safeTrim(dto.phone) || null,
          city: safeTrim(dto.city) || null,
          country: dto.country || null,
          primaryCurrency, // ✅ v4
          jobTitle: 'Responsable Agence',
          kycLevel: KycLevel.LEVEL_1,
          isEmailVerified: true,
          referralCode: generateReferralCode(dto.adminFirstName, dto.adminLastName),
        },
      });

      // ✅ 4. Wallet de l'agent dans sa devise
      await tx.wallet.create({
        data: {
          userId: agent.id,
          currency: primaryCurrency,
          balance: 0,
          isDefault: true,
          isActive: true,
        },
      });

      return { agency: this.serializeAgency(agency), agent: this.serializeUser(agent) };
    });
  }

  // ========================================================
  // MISE À JOUR
  // ========================================================

  async update(id: string, clientId: number, dto: UpdateAgencyDto) {
    const agency = await this.prisma.agency.findFirst({ where: { id, clientId } });
    if (!agency) throw new NotFoundException('Agence introuvable');

    return this.prisma.$transaction(async (tx) => {
      // Recalcule primaryCurrency si le pays change
      const updateData: any = {
        name: dto.name,
        city: dto.city,
        address: dto.address,
        phone: dto.phone,
        code: dto.code,
      };

      if (dto.country) {
        updateData.country = dto.country;
        updateData.primaryCurrency = getCurrencyFromCountry(dto.country);
      }

      if ('isActive' in dto) {
        updateData.isActive = (dto as any).isActive;
      }

      // Retire les undefined pour ne pas écraser les valeurs existantes
      Object.keys(updateData).forEach((k) => {
        if (updateData[k] === undefined) delete updateData[k];
      });

      const updatedAgency = await tx.agency.update({
        where: { id },
        data: updateData,
      });

      // Met à jour l'email de l'agent si changé
      if (dto.email && dto.email !== agency.email) {
        const newEmail = safeTrim(dto.email).toLowerCase();
        const exists = await tx.user.findUnique({ where: { email: newEmail } });
        if (exists) throw new ConflictException('Cet email est déjà pris.');

        await tx.user.updateMany({
          where: { agencyId: id, role: Role.AGENT },
          data: { email: newEmail },
        });

        await tx.agency.update({ where: { id }, data: { email: newEmail } });
      }

      return this.serializeAgency(updatedAgency);
    });
  }

  // ========================================================
  // SUPPRESSION
  // ========================================================

  async remove(id: string, clientId: number) {
    const agency = await this.prisma.agency.findFirst({ where: { id, clientId } });
    if (!agency) throw new NotFoundException('Agence introuvable');

    return this.prisma.$transaction(async (tx) => {
      const agents = await tx.user.findMany({
        where: { agencyId: id },
        select: { id: true },
      });
      const agentIds = agents.map((a) => a.id);

      if (agentIds.length > 0) {
        // Suppression en cascade
        try {
          await tx.otpLog.deleteMany({ where: { userId: { in: agentIds } } });
        } catch (_) {}
        try {
          await tx.userDevice.deleteMany({ where: { userId: { in: agentIds } } });
        } catch (_) {}
        try {
          await tx.userSession.deleteMany({ where: { userId: { in: agentIds } } });
        } catch (_) {}
        try {
          await tx.withdrawal.deleteMany({
            where: { transaction: { senderId: { in: agentIds } } },
          });
        } catch (_) {}
        await tx.transaction.deleteMany({
          where: { senderId: { in: agentIds } },
        });
        await tx.wallet.deleteMany({ where: { userId: { in: agentIds } } });
      }

      await tx.wallet.deleteMany({ where: { agencyId: id } });
      await tx.user.deleteMany({ where: { agencyId: id } });
      return tx.agency.delete({ where: { id } });
    });
  }

  // ========================================================
  // LECTURE
  // ========================================================

  async findAllByClient(clientId: number) {
    const agencies = await this.prisma.agency.findMany({
      where: { clientId },
      include: {
        agents: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
          },
        },
        wallets: { where: { isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return agencies.map(this.serializeAgency);
  }

  async findOne(id: string, clientId: number) {
    const agency = await this.prisma.agency.findFirst({
      where: { id, clientId },
      include: {
        agents: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
          },
        },
        wallets: { where: { isActive: true } },
      },
    });

    if (!agency) throw new NotFoundException('Agence introuvable');
    return this.serializeAgency(agency);
  }

  // ========================================================
  // SÉRIALISATION (wallets en number, plus de legacy fields)
  // ========================================================

  private serializeAgency(a: any) {
    return {
      id: a.id,
      name: a.name,
      city: a.city,
      address: a.address,
      phone: a.phone,
      email: a.email,
      code: a.code,
      country: a.country,
      primaryCurrency: a.primaryCurrency,
      isActive: a.isActive,
      isCertified: a.isCertified ?? false,
      clientId: a.clientId,
      type: a.type,
      wallets: Array.isArray(a.wallets)
        ? a.wallets.map((w: any) => ({
            id: w.id,
            currency: w.currency,
            balance: Number(w.balance),
            reservedBalance: Number(w.reservedBalance ?? 0),
            availableBalance: Number(w.balance) - Number(w.reservedBalance ?? 0),
            isDefault: w.isDefault,
          }))
        : undefined,
      agents: a.agents ?? undefined,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }

  private serializeUser(u: any) {
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      primaryCurrency: u.primaryCurrency,
      clientId: u.clientId,
      agencyId: u.agencyId,
    };
  }
}