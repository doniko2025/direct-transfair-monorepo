// apps/backend/src/agencies/agencies.service.ts
// =========================================================
// AGENCIES SERVICE v4.1
// ✅ findAll() SuperAdmin : toutes les agences sans filtre clientId
// ✅ findAllByClient() CompanyAdmin : filtré par clientId (inchangé)
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

    const primaryCurrency = getCurrencyFromCountry(dto.country);

    return this.prisma.$transaction(async (tx) => {
      const agency = await tx.agency.create({
        data: {
          name: safeTrim(dto.name),
          city: safeTrim(dto.city),
          address: safeTrim(dto.address),
          phone: safeTrim(dto.phone) || null,
          code: dto.code || null,
          email: email,
          country: dto.country || null,
          primaryCurrency,
          isActive: true,
          clientId,
        },
      });

      await tx.wallet.create({
        data: {
          agencyId: agency.id,
          currency: primaryCurrency,
          balance: 0,
          isDefault: true,
          isActive: true,
        },
      });

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
          primaryCurrency,
          jobTitle: 'Responsable Agence',
          kycLevel: KycLevel.LEVEL_1,
          isEmailVerified: true,
          referralCode: generateReferralCode(dto.adminFirstName, dto.adminLastName),
        },
      });

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

      Object.keys(updateData).forEach((k) => {
        if (updateData[k] === undefined) delete updateData[k];
      });

      const updatedAgency = await tx.agency.update({
        where: { id },
        data: updateData,
      });

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
        try { await tx.otpLog.deleteMany({ where: { userId: { in: agentIds } } }); } catch (_) {}
        try { await tx.userDevice.deleteMany({ where: { userId: { in: agentIds } } }); } catch (_) {}
        try { await tx.userSession.deleteMany({ where: { userId: { in: agentIds } } }); } catch (_) {}
        try {
          await tx.withdrawal.deleteMany({
            where: { transaction: { senderId: { in: agentIds } } },
          });
        } catch (_) {}
        await tx.transaction.deleteMany({ where: { senderId: { in: agentIds } } });
        await tx.wallet.deleteMany({ where: { userId: { in: agentIds } } });
      }

      await tx.wallet.deleteMany({ where: { agencyId: id } });
      await tx.user.deleteMany({ where: { agencyId: id } });
      return tx.agency.delete({ where: { id } });
    });
  }

  // ========================================================
  // LECTURE — CompanyAdmin (filtré par clientId)
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

    return agencies.map(this.serializeAgency.bind(this));
  }

  // ========================================================
  // ✅ NOUVEAU — LECTURE SuperAdmin (toutes les agences)
  // ========================================================

  async findAll() {
    const agencies = await this.prisma.agency.findMany({
      // Pas de filtre clientId → TOUTES les agences de TOUS les clients
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
        // ✅ Inclure le client pour afficher son nom dans le frontend
        client: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return agencies.map(this.serializeAgency.bind(this));
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
  async findOneAsSuperAdmin(id: string) {
  const agency = await this.prisma.agency.findUnique({
    where: { id },
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
      wallets: {
        where: { isActive: true },
      },
      client: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  if (!agency) {
    throw new NotFoundException('Agence introuvable');
  }

  return this.serializeAgency(agency);
}
async updateAsSuperAdmin(
  id: string,
  dto: UpdateAgencyDto,
) {
  const agency = await this.prisma.agency.findUnique({
    where: { id },
  });

  if (!agency) {
    throw new NotFoundException('Agence introuvable');
  }

  return this.update(id, agency.clientId, dto);
}
async removeAsSuperAdmin(id: string) {
  const agency = await this.prisma.agency.findUnique({
    where: { id },
  });

  if (!agency) {
    throw new NotFoundException('Agence introuvable');
  }

  return this.remove(id, agency.clientId);
}

  // ========================================================
  // SÉRIALISATION
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
      // ✅ Nom du client inclus pour le SuperAdmin
      clientName: a.client?.name ?? null,
      clientCode: a.client?.code ?? null,
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