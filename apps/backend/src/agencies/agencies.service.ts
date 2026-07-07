// apps/backend/src/agencies/agencies.service.ts
// =========================================================
// AGENCIES SERVICE v4.3
// ✅ v4.2 : FIX CurrencyCode enum cast (migration v4.1)
//
// ✅ v4.3 : 🐛 FIX — modification du responsable sans effet
//
//   PROBLÈME RÉSOLU :
//   "Modifier l'Agence" → section RESPONSABLE (téléphone, prénom,
//   nom) mettait à jour uniquement la table Agency. Le compte User
//   de l'agent lié n'était JAMAIS synchronisé après la création
//   initiale (où les deux étaient bien écrits ensemble dans
//   create()). Résultat : un admin change le téléphone via l'écran
//   "Modifier l'Agence", ça a l'air de marcher (Agency.phone est bien
//   à jour), mais le compte réel de l'agent (login, profil affiché
//   dans l'app, etc.) garde son ancien numéro partout ailleurs.
//
//   CORRECTIF :
//   - Ajout de Agency.managerId (schema.prisma v5.1) : désigne
//     explicitement LE responsable, au lieu de deviner via le
//     "premier agent" d'une liste non triée (même famille de bug que
//     la collision de téléphone : une ambiguïté d'identité qui finit
//     par tromper une logique métier).
//   - update() résout maintenant explicitement ce responsable
//     (auto-résolution + auto-réparation pour les agences créées
//     avant l'introduction de managerId), puis répercute téléphone
//     et nom sur SON compte User via UsersService.update() — réutilise
//     la même normalisation + vérification d'unicité du téléphone que
//     partout ailleurs dans l'app, plutôt que de la dupliquer.
//   - Le tout dans LA MÊME transaction Prisma que la mise à jour de
//     l'agence : si le nouveau téléphone est déjà pris par un autre
//     compte, TOUT est annulé ensemble (rien n'est à moitié appliqué).
//   - Email : ciblait auparavant TOUS les agents (role: AGENT) via
//     updateMany — cassait dès qu'une agence avait 2+ agents, car
//     `email` est @unique sur User (impossible d'assigner la même
//     valeur à 2 lignes). Ciblé maintenant sur le seul responsable
//     résolu ci-dessus.
// =========================================================

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CurrencyCode, KycLevel, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';

// =========================================================
// HELPERS
// =========================================================

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

function safeTrim(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function generateReferralCode(firstName?: string, lastName?: string): string {
  const prefix = `${(firstName ?? 'A').slice(0, 1)}${(lastName ?? 'G').slice(0, 1)}`.toUpperCase();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}${suffix}`;
}

// ✅ v4.3 — même règle de résolution "responsable" que le frontend
// (edit.tsx / details.tsx) : premier agent AGENT/COMPANY_ADMIN par
// ordre de création, à défaut le tout premier agent restant. Utilisée
// uniquement en filet de secours quand managerId n'est pas encore
// renseigné (agences créées avant l'introduction de ce champ).
function resolveManagerFallback<T extends { role: Role }>(agents: T[]): T | null {
  return (
    agents.find((a) => a.role === Role.COMPANY_ADMIN || a.role === Role.AGENT) ??
    agents[0] ??
    null
  );
}

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class AgenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

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
      const existingCode = await this.prisma.agency.findUnique({ where: { code: dto.code } });
      if (existingCode)
        throw new ConflictException(`Le code "${dto.code}" est déjà utilisé.`);
    }

    const hashedPassword = await bcrypt.hash(safeTrim(dto.adminPassword) || '123456', 10);

    // ✅ FIX: CurrencyCode
    const primaryCurrency: CurrencyCode = getCurrencyFromCountry(dto.country);

    return this.prisma.$transaction(async (tx) => {
      const agency = await tx.agency.create({
        data: {
          name: safeTrim(dto.name),
          city: safeTrim(dto.city),
          address: safeTrim(dto.address),
          phone: safeTrim(dto.phone) || null,
          code: dto.code || null,
          email,
          country: dto.country || null,
          primaryCurrency,
          isActive: true,
          clientId,
          // ✅ FIX: type agence persisté
          type: (dto.type === 'PARTNER' ? 'PARTNER' : 'SUBSIDIARY') as any,
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

      // ✅ v4.3 — Désigne explicitement cet agent comme responsable de
      // l'agence (Agency.managerId). Ordre obligatoire : l'agence doit
      // déjà exister pour créer l'agent (agencyId), et l'agent doit
      // déjà exister pour pointer managerId dessus — d'où cette mise
      // à jour en 3ᵉ étape plutôt qu'un champ direct à la création.
      const updatedAgency = await tx.agency.update({
        where: { id: agency.id },
        data: { managerId: agent.id },
      });

      return {
        agency: this.serializeAgency(updatedAgency),
        agent: this.serializeUser(agent),
      };
    });
  }

  // ========================================================
  // MISE À JOUR
  // ========================================================

  async update(id: string, clientId: number, dto: UpdateAgencyDto) {
    const agency = await this.prisma.agency.findFirst({
      where: { id, clientId },
      include: {
        manager: true,
        agents: {
          where:   { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!agency) throw new NotFoundException('Agence introuvable');

    return this.prisma.$transaction(async (tx) => {
      const updateData: any = {
        name: dto.name,
        city: dto.city,
        address: dto.address,
        phone: dto.phone,
        code: dto.code,
        // ✅ FIX: type agence mis à jour
        ...(dto.type !== undefined && {
          type: dto.type === 'PARTNER' ? 'PARTNER' : 'SUBSIDIARY',
        }),
      };

      if (dto.country) {
        updateData.country = dto.country;
        // ✅ FIX: CurrencyCode
        updateData.primaryCurrency = getCurrencyFromCountry(dto.country);
      }

      if ('isActive' in dto) {
        updateData.isActive = (dto as any).isActive;
      }

      // ✅ v4.3 — Résolution du responsable de l'agence.
      // Si managerId n'est pas encore renseigné (agence créée avant
      // l'introduction de ce champ), on retombe sur la même règle que
      // le frontend utilise déjà pour pré-remplir le formulaire, et on
      // fixe managerId dès maintenant pour ne plus jamais avoir à
      // deviner la prochaine fois (auto-réparation, une seule fois).
      let manager = agency.manager;
      if (!manager) {
        manager = resolveManagerFallback(agency.agents);
        if (manager) {
          updateData.managerId = manager.id;
        }
      }

      Object.keys(updateData).forEach((k) => {
        if (updateData[k] === undefined) delete updateData[k];
      });

      const updatedAgency = await tx.agency.update({ where: { id }, data: updateData });

      // ✅ v4.3 — Synchronisation téléphone + nom du responsable vers
      // son compte User. Réutilise UsersService.update() — même
      // normalisation + vérification d'unicité du téléphone que
      // partout ailleurs (voir le correctif de collision de
      // téléphone) — en lui passant `tx` pour rester dans LA MÊME
      // transaction : si le numéro est déjà pris par un autre compte,
      // tout (y compris les changements sur l'agence) est annulé
      // ensemble plutôt que de laisser un état à moitié appliqué.
      if (manager) {
        const managerUpdate: Record<string, unknown> = {};

        if (dto.phone !== undefined) {
          managerUpdate.phone = dto.phone;
        }

        if (dto.managerName !== undefined) {
          const parts = safeTrim(dto.managerName).split(' ').filter(Boolean);
          if (parts.length > 0) {
            managerUpdate.firstName = parts[0];
            managerUpdate.lastName = parts.slice(1).join(' ') || manager.lastName;
          }
        }

        if (Object.keys(managerUpdate).length > 0) {
          await this.usersService.update(manager.id, managerUpdate, tx);
        }
      }

      // ── Email : login du responsable ────────────────────────
      // ✅ FIX v4.3 : ciblait auparavant TOUS les agents (role: AGENT)
      // via updateMany — cassait dès qu'une agence avait 2+ agents,
      // `email` étant @unique sur User (impossible d'assigner la même
      // valeur à 2 lignes en une seule requête). Ciblé maintenant sur
      // le seul responsable résolu ci-dessus.
      if (dto.email && dto.email !== agency.email && manager) {
        const newEmail = safeTrim(dto.email).toLowerCase();
        const exists = await tx.user.findFirst({
          where: { email: newEmail, id: { not: manager.id } },
        });
        if (exists) throw new ConflictException('Cet email est déjà pris.');

        await tx.user.update({ where: { id: manager.id }, data: { email: newEmail } });
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

      // ✅ v4.3 — Détache managerId AVANT de supprimer les agents,
      // sinon la contrainte de clé étrangère Agency.managerId → User.id
      // empêcherait la suppression du user désigné comme responsable.
      if (agency.managerId) {
        await tx.agency.update({ where: { id }, data: { managerId: null } });
      }

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
  // LECTURE — CompanyAdmin
  // ========================================================

  async findAllByClient(clientId: number) {
    const agencies = await this.prisma.agency.findMany({
      where: { clientId },
      include: {
        agents: {
          select: {
            id: true, firstName: true, lastName: true,
            email: true, phone: true, role: true,
          },
        },
        wallets: { where: { isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return agencies.map(this.serializeAgency.bind(this));
  }

  // ========================================================
  // LECTURE — SuperAdmin (toutes agences)
  // ========================================================

  async findAll() {
    const agencies = await this.prisma.agency.findMany({
      include: {
        agents: {
          select: {
            id: true, firstName: true, lastName: true,
            email: true, phone: true, role: true,
          },
        },
        wallets: { where: { isActive: true } },
        client: { select: { id: true, name: true, code: true } },
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
            id: true, firstName: true, lastName: true,
            email: true, phone: true, role: true,
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
            id: true, firstName: true, lastName: true,
            email: true, phone: true, role: true,
          },
        },
        wallets: { where: { isActive: true } },
        client: { select: { id: true, name: true, code: true } },
      },
    });
    if (!agency) throw new NotFoundException('Agence introuvable');
    return this.serializeAgency(agency);
  }

  async updateAsSuperAdmin(id: string, dto: UpdateAgencyDto) {
    const agency = await this.prisma.agency.findUnique({ where: { id } });
    if (!agency) throw new NotFoundException('Agence introuvable');
    return this.update(id, agency.clientId, dto);
  }

  async removeAsSuperAdmin(id: string) {
    const agency = await this.prisma.agency.findUnique({ where: { id } });
    if (!agency) throw new NotFoundException('Agence introuvable');
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
      clientName: a.client?.name ?? null,
      clientCode: a.client?.code ?? null,
      type: a.type,
      // ✅ v4.3 — expose managerId : source de vérité pour "qui est le
      // responsable", à préférer côté frontend à une déduction locale
      // (premier agent d'une liste non triée).
      managerId: a.managerId ?? null,
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