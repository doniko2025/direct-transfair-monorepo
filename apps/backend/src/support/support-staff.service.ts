// apps/backend/src/support/support-staff.service.ts
// =========================================================
// SERVICE CLIENT — comptes du personnel et délégations (lot 9)
//   Réservé à l'administrateur de la société (COMPANY_ADMIN) ; le super administrateur peut tout consulter.
//   list / catalog / create (mot de passe temporaire) / setPermissions (interrupteurs) / update / setActive / resetPassword
//
// Les interrupteurs sont lus en base à chaque requête (JwtAuthGuard) : couper une délégation retire l'accès immédiatement, sans reconnexion
// du support. Chaque changement de délégation est tracé (SUPPORT_PERMISSIONS_UPDATE : avant / après).
// =========================================================

import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { KycLevel, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { platform } from '../common/platform.config';
import { normalizePhoneE164 } from '../common/utils/phone.util';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSupportStaffDto, SetSupportPermissionsDto, UpdateSupportStaffDto } from './dto/support-staff.dto';
import { expandPermissions, sanitizePermissions, SUPPORT_PERMISSION_META } from './support-permissions';

const MAX_LISTED = 500;

const STAFF_SELECT = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  isActive: true,
  isSuspended: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  clientId: true,
  supportPermissions: true,
} as const;

export interface SupportStaffView {
  id: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  /** Compte utilisable (ni suspendu ni désactivé). */
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  /** Interrupteurs posés par l'administrateur. */
  permissions: string[];
  /** Droits réellement exercés (interrupteurs + délégations impliquées). */
  effectivePermissions: string[];
}

function viewOf(u: any): SupportStaffView {
  const permissions = sanitizePermissions(u.supportPermissions);
  return {
    id: u.id,
    email: u.email,
    phone: u.phone ?? null,
    firstName: u.firstName ?? null,
    lastName: u.lastName ?? null,
    active: Boolean(u.isActive) && !u.isSuspended,
    mustChangePassword: Boolean(u.mustChangePassword),
    lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
    createdAt: new Date(u.createdAt).toISOString(),
    permissions,
    effectivePermissions: expandPermissions(permissions),
  };
}

const tempPassword = (): string => crypto.randomBytes(12).toString('hex');
const referralCode = (f: string, l: string): string => `${f.slice(0, 1)}${l.slice(0, 1)}`.toUpperCase() + crypto.randomBytes(3).toString('hex').toUpperCase();

@Injectable()
export class SupportStaffService {
  private readonly logger = new Logger(SupportStaffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Catalogue des délégations (source unique pour l'écran admin). */
  catalog() {
    return { permissions: SUPPORT_PERMISSION_META };
  }

  private companyOf(user: AuthUserPayload): number {
    if (!user.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    return user.clientId;
  }

  private async staffOf(clientId: number, id: string) {
    const row = await this.prisma.user.findFirst({ where: { id, clientId, role: Role.SUPPORT, deletedAt: null }, select: STAFF_SELECT });
    if (!row) throw new NotFoundException('Compte service client introuvable.');
    return row;
  }

  private async audit(user: AuthUserPayload, clientId: number, action: 'SUPPORT_STAFF_CREATE' | 'SUPPORT_PERMISSIONS_UPDATE' | 'USER_UPDATE' | 'PASSWORD_CHANGE', entityId: string, details: Record<string, unknown>) {
    try {
      await this.prisma.auditLog.create({ data: { userId: user.id, clientId, action, entity: 'SupportStaff', entityId, details: details as any, successful: true } });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (${action}, ${entityId}) : ${(err as Error).message}`);
    }
  }

  private sendPassword(email: string, firstName: string | null, password: string, subject: string, intro: string) {
    this.mail
      .sendEmail(
        email,
        subject,
        `<p>Bonjour ${firstName ?? ''},</p><p>${intro}</p><p>Mot de passe temporaire :</p>` +
          `<p style="font-size:22px;font-weight:700;letter-spacing:3px;font-family:monospace;background:#F0FDF4;color:#059669;padding:14px;border-radius:8px;text-align:center;">${password}</p>` +
          `<p>Vous devrez le remplacer dès votre première connexion sur le portail web.</p>`,
      )
      .catch((err) => this.logger.warn(`Email mot de passe temporaire non envoyé : ${err?.message}`));
  }

  async list(user: AuthUserPayload): Promise<{ data: SupportStaffView[] }> {
    const where = user.role === Role.SUPER_ADMIN ? { role: Role.SUPPORT, deletedAt: null } : { role: Role.SUPPORT, deletedAt: null, clientId: this.companyOf(user) };
    const rows = await this.prisma.user.findMany({ where, select: STAFF_SELECT, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: MAX_LISTED });
    return { data: rows.map(viewOf) };
  }

  async create(user: AuthUserPayload, dto: CreateSupportStaffDto) {
    const clientId = this.companyOf(user);
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) throw new ConflictException(`L'email « ${email} » est déjà utilisé.`);

    const rawPhone = (dto.phone ?? '').trim();
    const phone = rawPhone ? normalizePhoneE164(rawPhone) : null;
    if (rawPhone && !phone) throw new BadRequestException('Numéro de téléphone invalide.');
    if (phone && (await this.prisma.user.findFirst({ where: { phone }, select: { id: true } }))) throw new ConflictException('Ce numéro de téléphone est déjà associé à un autre compte.');

    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    if (!firstName || !lastName) throw new BadRequestException('Prénom et nom requis.');

    const permissions = sanitizePermissions(dto.permissions);
    const password = tempPassword();
    const hash = await bcrypt.hash(password, 10);

    let created: { id: string };
    try {
      created = await this.prisma.user.create({
        data: {
          email,
          phone,
          password: hash,
          firstName,
          lastName,
          role: Role.SUPPORT,
          mustChangePassword: true,
          clientId,
          jobTitle: 'Service client',
          kycLevel: KycLevel.LEVEL_1,
          isEmailVerified: true,
          supportPermissions: permissions,
          referralCode: referralCode(firstName, lastName),
        },
        select: { id: true },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Cet email ou ce numéro de téléphone est déjà utilisé.');
      throw e;
    }

    await this.audit(user, clientId, 'SUPPORT_STAFF_CREATE', created.id, { permissions });
    this.sendPassword(email, firstName, password, `Votre compte service client ${platform.name}`, 'Un compte service client a été créé pour vous. Vos droits d\'action sont réglés par votre administrateur.');
    return { staff: viewOf(await this.staffOf(clientId, created.id)), generatedPassword: password };
  }

  async setPermissions(user: AuthUserPayload, id: string, dto: SetSupportPermissionsDto) {
    const clientId = this.companyOf(user);
    const before = await this.staffOf(clientId, id);
    const after = sanitizePermissions(dto.permissions);
    const prev = sanitizePermissions(before.supportPermissions);
    if (prev.join() === after.join()) return viewOf(before);

    await this.prisma.user.update({ where: { id }, data: { supportPermissions: after } });
    await this.audit(user, clientId, 'SUPPORT_PERMISSIONS_UPDATE', id, {
      before: prev,
      after,
      enabled: after.filter((p) => !prev.includes(p)),
      disabled: prev.filter((p) => !after.includes(p)),
    });
    return viewOf(await this.staffOf(clientId, id));
  }

  async update(user: AuthUserPayload, id: string, dto: UpdateSupportStaffDto) {
    const clientId = this.companyOf(user);
    await this.staffOf(clientId, id);
    const data: Record<string, unknown> = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim();
    if (dto.phone !== undefined) {
      const raw = dto.phone.trim();
      if (raw) {
        const phone = normalizePhoneE164(raw);
        if (!phone) throw new BadRequestException('Numéro de téléphone invalide.');
        const other = await this.prisma.user.findFirst({ where: { phone, id: { not: id } }, select: { id: true } });
        if (other) throw new ConflictException('Ce numéro de téléphone est déjà associé à un autre compte.');
        data.phone = phone;
      } else data.phone = null;
    }
    if (Object.keys(data).length) {
      await this.prisma.user.update({ where: { id }, data });
      await this.audit(user, clientId, 'USER_UPDATE', id, { kind: 'SUPPORT_STAFF_PROFILE', fields: Object.keys(data) });
    }
    return viewOf(await this.staffOf(clientId, id));
  }

  /** Suspend / réactive un compte du service client. La suspension ferme aussi ses sessions ouvertes. */
  async setActive(user: AuthUserPayload, id: string, active: boolean) {
    const clientId = this.companyOf(user);
    await this.staffOf(clientId, id);
    if (active) {
      await this.prisma.user.update({ where: { id }, data: { isSuspended: false, suspendedAt: null, suspendedReason: null, isActive: true } });
    } else {
      await this.prisma.$transaction([
        this.prisma.user.update({ where: { id }, data: { isSuspended: true, suspendedAt: new Date(), suspendedReason: 'Suspendu par l\'administrateur' } }),
        this.prisma.userSession.deleteMany({ where: { userId: id } }),
      ]);
    }
    await this.audit(user, clientId, 'USER_UPDATE', id, { kind: active ? 'SUPPORT_STAFF_REACTIVATE' : 'SUPPORT_STAFF_SUSPEND' });
    return viewOf(await this.staffOf(clientId, id));
  }

  async resetPassword(user: AuthUserPayload, id: string) {
    const clientId = this.companyOf(user);
    const staff = await this.staffOf(clientId, id);
    const password = tempPassword();
    const hash = await bcrypt.hash(password, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { password: hash, mustChangePassword: true } }),
      this.prisma.userSession.deleteMany({ where: { userId: id } }),
    ]);
    await this.audit(user, clientId, 'PASSWORD_CHANGE', id, { kind: 'SUPPORT_STAFF_RESET_BY_ADMIN' });
    this.sendPassword(staff.email, staff.firstName, password, `Nouveau mot de passe ${platform.name}`, 'Votre administrateur a réinitialisé votre mot de passe.');
    return { generatedPassword: password };
  }
}
