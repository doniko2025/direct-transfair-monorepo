// apps/backend/src/agents-admin/agents-admin.service.ts
// =========================================================
// ✅ v1.2 (phase 7) : objets des courriels (compte agent, nouveau mot de passe) — nom de marque lu dans la configuration plateforme.
// AGENTS ADMIN v1.2 — les agents d'une société, rattachés à une agence
// ✅ v1.1 (phase 6, passe 2) : resetPassword() ferme aussi les sessions ouvertes de l'agent.
//
//   list           : agents de ma société (admin de société) ou de toutes (super admin, lecture seule)
//   create         : crée un agent dans une agence de MA société, avec un mot de passe temporaire
//   assignAgency   : change l'agence d'un agent (même société uniquement)
//   setManager     : désigne l'agent comme responsable de son agence
//   resetPassword  : génère un nouveau mot de passe temporaire
//
// La suspension, la réactivation et la suppression d'un agent restent sur /users/:id/*
// (UsersController), qui applique les mêmes règles de rôle.
// =========================================================

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { KycLevel, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { normalizePhoneE164 } from '../common/utils/phone.util';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AssignAgencyDto, CreateAgentDto } from './dto/agents-admin.dto';
import { platform } from '../common/platform.config';

const MAX_LISTED = 1000;

const AGENT_SELECT = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  isActive: true,
  isSuspended: true,
  lastLoginAt: true,
  createdAt: true,
  clientId: true,
  agencyId: true,
  agency: { select: { id: true, name: true, city: true, managerId: true, isActive: true } },
  client: { select: { name: true } },
  wallets: { where: { isActive: true }, select: { currency: true, balance: true } },
} as const;

export interface AgentView {
  id: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  isSuspended: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  company: string | null;
  agency: { id: string; name: string; city: string | null; isActive: boolean } | null;
  isManager: boolean;
  wallets: { currency: string; balance: number }[];
}

function viewOf(u: any): AgentView {
  return {
    id: u.id,
    email: u.email,
    phone: u.phone ?? null,
    firstName: u.firstName ?? null,
    lastName: u.lastName ?? null,
    isActive: Boolean(u.isActive),
    isSuspended: Boolean(u.isSuspended),
    lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
    createdAt: new Date(u.createdAt).toISOString(),
    company: u.client?.name ?? null,
    agency: u.agency
      ? { id: u.agency.id, name: u.agency.name, city: u.agency.city ?? null, isActive: Boolean(u.agency.isActive) }
      : null,
    isManager: Boolean(u.agency && u.agency.managerId === u.id),
    wallets: (u.wallets ?? []).map((w: any) => ({ currency: String(w.currency), balance: Number(w.balance ?? 0) })),
  };
}

function generateTempPassword(): string {
  return crypto.randomBytes(12).toString('hex');
}

function referralCode(firstName: string, lastName: string): string {
  const prefix = `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toUpperCase();
  return `${prefix}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

@Injectable()
export class AgentsAdminService {
  private readonly logger = new Logger(AgentsAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private companyOf(user: AuthUserPayload): number {
    if (!user.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    return user.clientId;
  }

  private async agentOf(clientId: number, id: string) {
    const agent = await this.prisma.user.findFirst({
      where: { id, clientId, role: Role.AGENT, deletedAt: null },
      select: AGENT_SELECT,
    });
    if (!agent) throw new NotFoundException('Agent introuvable.');
    return agent;
  }

  private async activeAgency(clientId: number, agencyId: string) {
    const agency = await this.prisma.agency.findFirst({
      where: { id: agencyId, clientId, deletedAt: null },
      select: { id: true, name: true, primaryCurrency: true, managerId: true, isActive: true },
    });
    if (!agency) throw new NotFoundException('Agence introuvable dans votre société.');
    if (!agency.isActive) throw new BadRequestException(`L'agence « ${agency.name} » est désactivée.`);
    return agency;
  }

  private async audit(user: AuthUserPayload, clientId: number, action: 'USER_CREATE' | 'USER_UPDATE' | 'PASSWORD_CHANGE', entityId: string, details: Record<string, unknown>) {
    // L'opération est faite : un échec d'écriture du journal ne doit pas la faire passer pour un échec.
    try {
      await this.prisma.auditLog.create({
        data: { userId: user.id, clientId, action, entity: 'Agent', entityId, details: details as any, successful: true },
      });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (${action}, agent ${entityId}) : ${(err as Error).message}`);
    }
  }

  private sendPassword(email: string, firstName: string | null, password: string, subject: string, intro: string) {
    this.mail
      .sendEmail(
        email,
        subject,
        `<p>Bonjour ${firstName ?? ''},</p>
         <p>${intro}</p>
         <p>Mot de passe temporaire :</p>
         <p style="font-size:22px;font-weight:700;letter-spacing:3px;font-family:monospace;background:#F0FDF4;color:#059669;padding:14px;border-radius:8px;text-align:center;">${password}</p>
         <p>Nous vous recommandons de le changer dès votre première connexion.</p>`,
      )
      .catch((err) => this.logger.warn(`Email mot de passe temporaire non envoyé : ${err?.message}`));
  }

  async list(user: AuthUserPayload): Promise<{ data: AgentView[] }> {
    const isSuper = user.role === Role.SUPER_ADMIN;
    const where = isSuper
      ? { role: Role.AGENT, deletedAt: null }
      : { role: Role.AGENT, deletedAt: null, clientId: this.companyOf(user) };
    const rows = await this.prisma.user.findMany({
      where,
      select: AGENT_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: MAX_LISTED,
    });
    return { data: rows.map(viewOf) };
  }

  async create(user: AuthUserPayload, dto: CreateAgentDto) {
    const clientId = this.companyOf(user);
    const agency = await this.activeAgency(clientId, dto.agencyId);

    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ConflictException(`L'email « ${email} » est déjà utilisé.`);
    }

    const rawPhone = (dto.phone ?? '').trim();
    const phone = rawPhone ? normalizePhoneE164(rawPhone) : null;
    if (rawPhone && !phone) throw new BadRequestException('Numéro de téléphone invalide.');
    if (phone && (await this.prisma.user.findFirst({ where: { phone }, select: { id: true } }))) {
      throw new ConflictException('Ce numéro de téléphone est déjà associé à un autre compte.');
    }

    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    if (!firstName || !lastName) throw new BadRequestException('Prénom et nom requis.');

    const password = generateTempPassword();
    const hash = await bcrypt.hash(password, 10);

    let created: { id: string };
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const agent = await tx.user.create({
          data: {
            email,
            phone,
            password: hash,
            firstName,
            lastName,
            role: Role.AGENT,
            clientId,
            agencyId: agency.id,
            primaryCurrency: agency.primaryCurrency,
            jobTitle: dto.makeManager ? 'Responsable Agence' : 'Agent',
            kycLevel: KycLevel.LEVEL_1,
            isEmailVerified: true,
            referralCode: referralCode(firstName, lastName),
          },
          select: { id: true },
        });
        await tx.wallet.create({
          data: { userId: agent.id, currency: agency.primaryCurrency, balance: 0, isDefault: true, isActive: true },
        });
        if (dto.makeManager) {
          await tx.agency.update({ where: { id: agency.id }, data: { managerId: agent.id } });
        }
        return agent;
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Cet email ou ce numéro de téléphone est déjà utilisé.');
      throw e;
    }

    await this.audit(user, clientId, 'USER_CREATE', created.id, {
      kind: 'AGENT',
      agencyId: agency.id,
      makeManager: Boolean(dto.makeManager),
    });
    this.sendPassword(
      email,
      firstName,
      password,
      `Votre compte agent ${platform.name}`,
      `Votre compte agent a été créé pour l'agence « ${agency.name} ».`,
    );

    const fresh = await this.agentOf(clientId, created.id);
    return { agent: viewOf(fresh), generatedPassword: password };
  }

  async assignAgency(user: AuthUserPayload, id: string, dto: AssignAgencyDto) {
    const clientId = this.companyOf(user);
    const agent = await this.agentOf(clientId, id);
    const target = await this.activeAgency(clientId, dto.agencyId);
    if (agent.agencyId === target.id) return viewOf(agent);

    const wasManagerOf = agent.agency && agent.agency.managerId === agent.id ? agent.agency.id : null;
    await this.prisma.$transaction(async (tx) => {
      if (wasManagerOf) {
        await tx.agency.update({ where: { id: wasManagerOf }, data: { managerId: null } });
      }
      await tx.user.update({ where: { id }, data: { agencyId: target.id } });
    });

    await this.audit(user, clientId, 'USER_UPDATE', id, {
      kind: 'AGENT_AGENCY',
      from: agent.agencyId,
      to: target.id,
      lostManagerRole: Boolean(wasManagerOf),
    });
    return viewOf(await this.agentOf(clientId, id));
  }

  async setManager(user: AuthUserPayload, id: string) {
    const clientId = this.companyOf(user);
    const agent = await this.agentOf(clientId, id);
    if (!agent.agencyId || !agent.agency) {
      throw new BadRequestException("Cet agent n'est rattaché à aucune agence.");
    }
    if (!agent.agency.isActive) throw new BadRequestException(`L'agence « ${agent.agency.name} » est désactivée.`);
    if (agent.isSuspended || !agent.isActive) {
      throw new BadRequestException('Un agent suspendu ne peut pas être responsable.');
    }
    if (agent.agency.managerId === id) return viewOf(agent);

    const agencyId = agent.agencyId;
    await this.prisma.$transaction(async (tx) => {
      // managerId est unique : on libère d'abord toute autre agence que cet agent aurait gardée.
      await tx.agency.updateMany({ where: { managerId: id }, data: { managerId: null } });
      await tx.agency.update({ where: { id: agencyId }, data: { managerId: id } });
    });

    await this.audit(user, clientId, 'USER_UPDATE', id, {
      kind: 'AGENT_MANAGER',
      agencyId,
      previousManagerId: agent.agency.managerId,
    });
    return viewOf(await this.agentOf(clientId, id));
  }

  async resetPassword(user: AuthUserPayload, id: string) {
    const clientId = this.companyOf(user);
    const agent = await this.agentOf(clientId, id);

    const password = generateTempPassword();
    const hash = await bcrypt.hash(password, 10);
    // Passe 2 (phase 6) : les sessions ouvertes avec l'ancien mot de passe sont fermées (sinon elles se renouvellent
    // tant que le refresh token n'expire pas) ; l'agent se reconnecte avec le mot de passe temporaire.
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { password: hash } }),
      this.prisma.userSession.deleteMany({ where: { userId: id } }),
    ]);

    await this.audit(user, clientId, 'PASSWORD_CHANGE', id, { kind: 'AGENT_RESET_BY_ADMIN' });
    this.sendPassword(
      agent.email,
      agent.firstName,
      password,
      `Nouveau mot de passe ${platform.name}`,
      'Votre administrateur a réinitialisé votre mot de passe.',
    );
    return { generatedPassword: password };
  }
}
