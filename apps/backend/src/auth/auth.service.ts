// apps/backend/src/auth/auth.service.ts
// =========================================================
// AUTH SERVICE v4.1 — Direct Transf'air
// ✅ FIX: CurrencyCode enum cast (migration v4.1)
// =========================================================

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  CommsType,
  CurrencyCode,
  KycLevel,
  OtpPurpose,
  Role,
  User,
  AuditAction,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, VerifyLoginOtpDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

// =========================================================
// CURRENCY MAP
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

const OTP_EXPIRY_MINUTES = 10;
const REFRESH_TOKEN_DAYS = 30;

// =========================================================
// TYPES
// =========================================================

export type PublicUser = {
  id: string;
  email: string;
  phone?: string | null;
  role: Role;
  clientId: number | null;
  firstName?: string | null;
  lastName?: string | null;
  agencyId?: string | null;
  primaryCurrency?: string | null;
  loyaltyPoints?: number;
  loyaltyTier?: string | null;
  kycLevel?: KycLevel;
  balance?: number;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  mfaEnabled?: boolean;
  birthDate?: string | null;
  birthPlace?: string | null;
  nationality?: string | null;
  addressStreet?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  client?: any;
  agency?: any;
  wallets?: any[];
};

export type LoginStep1Result = {
  step: 'OTP_REQUIRED';
  userId: string;
  otpSent: boolean;
  otpChannel: CommsType;
  maskedRecipient: string;
};

export type LoginStep2Result = {
  access_token: string;
  refresh_token: string;
  user: PublicUser;
};

// =========================================================
// HELPERS
// =========================================================

function normalizeEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}

function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  return String(phone).replace(/\s+/g, '');
}

function normalizeTenantCode(code?: string | null): string | null {
  const c = String(code ?? '').trim();
  if (!c) return null;
  return c.toUpperCase();
}

function getCurrencyFromCountry(country?: string | null): CurrencyCode {
  if (!country) return CurrencyCode.XOF;
  const code = country.toUpperCase().substring(0, 2);
  return COUNTRY_TO_CURRENCY[code] ?? CurrencyCode.XOF;
}

function isPhoneIdentifier(s: string): boolean {
  if (s.includes('@')) return false;
  return /^[\d+\s\-()]+$/.test(s);
}

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return email;
  const visible = user.substring(0, Math.min(2, user.length));
  return `${visible}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

function maskPhone(phone: string): string {
  if (phone.length < 4) return phone;
  const last2 = phone.slice(-2);
  return `${phone.substring(0, 4)}${'*'.repeat(Math.max(2, phone.length - 6))}${last2}`;
}

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // ========================================================
  // LOGIN
  // ========================================================

  async login(dto: LoginDto): Promise<LoginStep2Result | LoginStep1Result> {
    const otpRequired = process.env.LOGIN_OTP_REQUIRED === 'true';

    const identifier = (dto.identifier ?? dto.email ?? '').trim();
    if (!identifier) throw new BadRequestException('Identifiant requis');

    const user = await this.validateUser(identifier, dto.password);
    if (!user) throw new UnauthorizedException('Identifiants incorrects');

    if (user.isSuspended) {
      throw new UnauthorizedException('Compte suspendu');
    }

    if (otpRequired) {
      const isPhone = isPhoneIdentifier(identifier);
      const channel: CommsType =
        isPhone && user.phone ? CommsType.SMS : CommsType.EMAIL;

      const recipient =
        channel === CommsType.EMAIL ? user.email : (user.phone ?? user.email);

      if (!recipient) {
        throw new BadRequestException('Aucun canal de contact disponible');
      }

      await this.sendOtpInternal(user.id, channel, OtpPurpose.LOGIN, recipient);

      return {
        step: 'OTP_REQUIRED',
        userId: user.id,
        otpSent: true,
        otpChannel: channel,
        maskedRecipient:
          channel === CommsType.EMAIL ? maskEmail(recipient) : maskPhone(recipient),
      };
    }

    const tokens = await this.generateTokens(user);
    await this.createSession(user.id, tokens);
    await this.audit(user.id, user.clientId, AuditAction.LOGIN);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0 },
    });

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: this.toPublicUser(user),
    };
  }

  // ========================================================
  // LOGIN — Étape 2 : Vérification OTP
  // ========================================================

  async verifyLoginOtp(dto: VerifyLoginOtpDto): Promise<LoginStep2Result> {
    const otpLog = await this.prisma.otpLog.findFirst({
      where: {
        userId: dto.userId,
        code: dto.code,
        purpose: OtpPurpose.LOGIN,
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpLog) {
      await this.prisma.otpLog.updateMany({
        where: {
          userId: dto.userId,
          purpose: OtpPurpose.LOGIN,
          isUsed: false,
          expiresAt: { gte: new Date() },
        },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Code OTP invalide ou expiré');
    }

    await this.prisma.otpLog.update({
      where: { id: otpLog.id },
      data: { isUsed: true, usedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: {
        client: true,
        agency: true,
        wallets: { where: { isActive: true } },
      },
    });

    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (otpLog.channel === CommsType.SMS && !user.isPhoneVerified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isPhoneVerified: true },
      });
    }

    if (dto.trustDevice && dto.deviceId) {
      await this.prisma.userDevice.updateMany({
        where: { userId: user.id, deviceId: dto.deviceId },
        data: { status: 'TRUSTED', trustedAt: new Date() },
      });
    }

    const tokens = await this.generateTokens(user);
    await this.createSession(user.id, tokens, dto.deviceId ?? null);

    await this.audit(
      user.id,
      user.clientId,
      otpLog.channel === CommsType.SMS ? AuditAction.LOGIN_PHONE : AuditAction.LOGIN,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0 },
    });

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: this.toPublicUser(user),
    };
  }

  // ========================================================
  // VALIDATE USER
  // ========================================================

  async validateUser(identifier: string, pass: string): Promise<any | null> {
    const isEmail = identifier.includes('@');
    let user: any = null;

    if (isEmail) {
      user = await this.prisma.user.findUnique({
        where: { email: normalizeEmail(identifier) },
        include: {
          client: true,
          agency: true,
          wallets: { where: { isActive: true } },
        },
      });
    } else {
      const phone = normalizePhone(identifier);
      if (phone) {
        user = await this.prisma.user.findFirst({
          where: { phone },
          include: {
            client: true,
            agency: true,
            wallets: { where: { isActive: true } },
          },
        });
      }
    }

    if (user && (await bcrypt.compare(pass, user.password))) return user;

    if (user) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: { increment: 1 },
          lastFailedLoginAt: new Date(),
        },
      });
    }

    return null;
  }

  // ========================================================
  // REGISTER
  // ========================================================

  async register(dto: RegisterDto, tenantFromHeader?: string | null) {
    const email = normalizeEmail(dto.email);
    const phone = normalizePhone(dto.phone);

    const existingEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingEmail) throw new ConflictException('Cet email est déjà utilisé.');

    if (phone) {
      const existingPhone = await this.prisma.user.findFirst({ where: { phone } });
      if (existingPhone) throw new ConflictException('Ce numéro est déjà utilisé.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const resolvedTenantCode =
      normalizeTenantCode(tenantFromHeader) ??
      normalizeTenantCode(dto.tenantCode) ??
      'DONIKO';

    const client = await this.prisma.client.findUnique({
      where: { code: resolvedTenantCode },
    });

    if (!client)
      throw new BadRequestException(`Société introuvable (${resolvedTenantCode}).`);

    // ✅ FIX: CurrencyCode
    const primaryCurrency: CurrencyCode = getCurrencyFromCountry(dto.country);

    const user = await this.prisma.user.create({
      data: {
        email,
        phone,
        password: hashedPassword,
        role: dto.role === 'AGENT' ? Role.AGENT : Role.USER,
        clientId: client.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        country: dto.country,
        city: dto.city,
        primaryCurrency,
        addressStreet: dto.addressStreet,
        postalCode: dto.postalCode,
        nationality: dto.nationality,
        birthDate: dto.birthDate,
        birthCountry: dto.birthCountry,
        birthCity: dto.birthCity,
        birthPlace: dto.birthPlace,
        kycLevel: KycLevel.LEVEL_0,
        referralCode: this.generateReferralCode(dto.firstName, dto.lastName),
      },
    });

    // ✅ FIX: CurrencyCode
    await this.prisma.wallet.create({
      data: {
        userId: user.id,
        currency: primaryCurrency,
        balance: 0,
        isDefault: true,
        isActive: true,
      },
    });

    await this.audit(user.id, client.id, AuditAction.USER_CREATE, {
      country: dto.country,
      currency: primaryCurrency,
    });

    try {
      await this.mail.sendEmail(
        email,
        "Bienvenue sur Direct Transf'air 🎉",
        `<p>Bonjour ${dto.firstName},</p>
         <p>Votre compte a bien été créé avec la devise <strong>${primaryCurrency}</strong>.</p>
         <p>Pour activer pleinement votre compte, vérifiez votre adresse email.</p>`,
      );
    } catch (e) {
      this.logger.warn('Échec email bienvenue', e);
    }

    await this.sendOtpInternal(
      user.id,
      CommsType.EMAIL,
      OtpPurpose.EMAIL_VERIFICATION,
      email,
    );

    return this.login({ email: dto.email, password: dto.password });
  }

  // ========================================================
  // FIND ACCOUNT
  // ========================================================

  async findAccount(identifier: string) {
    const isEmail = identifier.includes('@');
    let user: User | null = null;

    if (isEmail) {
      user = await this.prisma.user.findUnique({
        where: { email: normalizeEmail(identifier) },
      });
    } else {
      const phone = normalizePhone(identifier);
      if (phone) {
        user = await this.prisma.user.findFirst({ where: { phone } });
      }
    }

    if (!user) throw new NotFoundException('Compte introuvable');

    const channels: string[] = [];
    if (user.email) channels.push('EMAIL');
    if (user.phone) channels.push('PHONE');

    return { userId: user.id, channels };
  }

  // ========================================================
  // OTP — Public
  // ========================================================

  async sendOtp(userId: string, channel: 'EMAIL' | 'PHONE', purpose: string = 'PASSWORD_RESET') {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const otpChannel: CommsType =
      channel === 'PHONE' ? CommsType.SMS : CommsType.EMAIL;

    const recipient =
      otpChannel === CommsType.EMAIL ? user.email : user.phone;

    if (!recipient) throw new BadRequestException('Canal indisponible');

    const otpPurpose = (OtpPurpose as any)[purpose] ?? OtpPurpose.PASSWORD_RESET;

    await this.sendOtpInternal(userId, otpChannel, otpPurpose, recipient);

    return { success: true };
  }

  // ========================================================
  // OTP — Interne
  // ========================================================

  private async sendOtpInternal(
    userId: string,
    channel: CommsType,
    purpose: OtpPurpose,
    recipient: string,
  ): Promise<void> {
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.otpLog.updateMany({
      where: { userId, purpose, isUsed: false },
      data: { isExpired: true },
    });

    await this.prisma.otpLog.create({
      data: { userId, code, purpose, channel, recipient, expiresAt },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        otpCode: code,
        otpExpiresAt: expiresAt,
        otpPurpose: purpose,
        otpChannel: channel,
      },
    });

    if (channel === CommsType.EMAIL) {
      try {
        await this.mail.sendEmail(
          recipient,
          'Votre code de vérification',
          `<p>Votre code de vérification est :</p>
           <p style="font-size:32px;font-weight:500;color:#DC2626;letter-spacing:6px;font-family:monospace;text-align:center;background:#FEE2E2;padding:16px;border-radius:8px;margin:16px 0;">${code}</p>
           <p>Il expire dans ${OTP_EXPIRY_MINUTES} minutes.</p>
           <p style="color:#999;font-size:12px;">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`,
        );
      } catch (e) {
        this.logger.error('Erreur envoi OTP email', e);
      }
    } else if (channel === CommsType.SMS) {
      this.logger.log(`[SMS STUB] Code ${code} → ${recipient}`);
    }

    await this.audit(userId, null, AuditAction.OTP_REQUEST, { purpose, channel });
  }

  // ========================================================
  // VERIFY OTP (générique)
  // ========================================================

  async verifyOtp(userId: string, code: string, type?: string) {
    const purpose = type ? ((OtpPurpose as any)[type] ?? null) : null;

    const where: any = {
      userId,
      code,
      isUsed: false,
      expiresAt: { gte: new Date() },
    };
    if (purpose) where.purpose = purpose;

    const otpLog = await this.prisma.otpLog.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
    });

    if (!otpLog) throw new BadRequestException('Code invalide ou expiré');

    await this.prisma.otpLog.update({
      where: { id: otpLog.id },
      data: { isUsed: true, usedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        otpCode: null,
        otpExpiresAt: null,
        isEmailVerified:
          otpLog.purpose === OtpPurpose.EMAIL_VERIFICATION ? true : user.isEmailVerified,
        isPhoneVerified:
          otpLog.purpose === OtpPurpose.PHONE_VERIFICATION ? true : user.isPhoneVerified,
      },
    });

    await this.audit(userId, user.clientId, AuditAction.OTP_VERIFY);

    return { success: true };
  }

  // ========================================================
  // RESET PASSWORD
  // ========================================================

  async resetPassword(userId: string, code: string, newPass: string) {
    if (newPass.length < 6) throw new BadRequestException('Mot de passe trop court');

    const otpLog = await this.prisma.otpLog.findFirst({
      where: {
        userId,
        code,
        purpose: OtpPurpose.PASSWORD_RESET,
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpLog) throw new BadRequestException('Code invalide ou expiré');

    const hashedPassword = await bcrypt.hash(newPass, 10);

    await this.prisma.$transaction([
      this.prisma.otpLog.update({
        where: { id: otpLog.id },
        data: { isUsed: true, usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          otpCode: null,
          otpExpiresAt: null,
          failedLoginAttempts: 0,
        },
      }),
    ]);

    await this.audit(userId, null, AuditAction.PASSWORD_CHANGE);

    return { success: true };
  }

  // ========================================================
  // CHANGE PASSWORD
  // ========================================================

  async changePassword(userId: string, oldPass: string, newPass: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const isMatch = await bcrypt.compare(oldPass, user.password);
    if (!isMatch) throw new BadRequestException('Ancien code secret incorrect.');

    if (newPass.length < 6)
      throw new BadRequestException('Le nouveau code doit faire au moins 6 caractères.');

    if (oldPass === newPass)
      throw new BadRequestException("Le nouveau code doit être différent de l'ancien.");

    const hashedNewPassword = await bcrypt.hash(newPass, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    await this.audit(userId, user.clientId, AuditAction.PASSWORD_CHANGE);

    if (user.email) {
      try {
        await this.mail.sendEmail(
          user.email,
          'Mot de passe modifié',
          `<p>Votre mot de passe a été modifié avec succès.</p>
           <p style="color:#DC2626;">Si vous n'êtes pas à l'origine de cette modification, contactez-nous immédiatement.</p>`,
        );
      } catch (e) {
        this.logger.warn('Échec email confirmation password', e);
      }
    }

    return { success: true, message: 'Mot de passe mis à jour avec succès' };
  }

  // ========================================================
  // REFRESH TOKEN
  // ========================================================

  async refreshTokens(refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('Refresh token manquant');

    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken },
      include: { user: { include: { client: true, agency: true } } },
    });

    if (!session || session.status !== 'ACTIVE') {
      throw new UnauthorizedException('Session invalide');
    }

    if (session.refreshTokenExpiresAt && session.refreshTokenExpiresAt < new Date()) {
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED' },
      });
      throw new UnauthorizedException('Refresh token expiré');
    }

    const tokens = await this.generateTokens(session.user as any);

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        token: tokens.access_token,
        refreshToken: tokens.refresh_token,
        refreshTokenExpiresAt: new Date(
          Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
        ),
      },
    });

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    };
  }

  // ========================================================
  // LOGOUT
  // ========================================================

  async logout(userId: string, accessToken?: string) {
    const where: any = { userId, status: 'ACTIVE' };
    if (accessToken) where.token = accessToken;

    await this.prisma.userSession.updateMany({
      where,
      data: { status: 'REVOKED', revokedAt: new Date() },
    });

    await this.audit(userId, null, AuditAction.LOGOUT);

    return { success: true };
  }

  // ========================================================
  // PROFILE
  // ========================================================

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        client: true,
        agency: true,
        wallets: { where: { isActive: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toPublicUser(user);
  }

  async updateProfile(userId: string, data: any) {
    const updateData: any = { ...data };

    delete updateData.id;
    delete updateData.role;
    delete updateData.password;
    delete updateData.email;
    delete updateData.balance;
    delete updateData.clientId;
    delete updateData.kycLevel;
    delete updateData.loyaltyPoints;
    delete updateData.loyaltyTier;
    delete updateData.referralCode;
    delete updateData.wallets;
    delete updateData.client;
    delete updateData.agency;

    if (updateData.phone) {
      updateData.phone = normalizePhone(updateData.phone);
    }

    // ✅ FIX: CurrencyCode
    if (updateData.country) {
      const newCurrency: CurrencyCode = getCurrencyFromCountry(updateData.country);
      updateData.primaryCurrency = newCurrency;

      const existingWallet = await this.prisma.wallet.findUnique({
        where: { userId_currency: { userId, currency: newCurrency } },
      });
      if (!existingWallet) {
        await this.prisma.wallet.create({
          data: {
            userId,
            currency: newCurrency,
            balance: 0,
            isActive: true,
          },
        });
      }
    }

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    } catch (e: any) {
      if (e.code === 'P2002')
        throw new ConflictException('Ce numéro de téléphone est déjà utilisé.');
      throw new BadRequestException('Erreur lors de la mise à jour du profil.');
    }

    await this.audit(userId, null, AuditAction.USER_UPDATE);

    return this.getProfile(userId);
  }

  // ========================================================
  // HELPERS PRIVÉS
  // ========================================================

  private async generateTokens(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      clientId: user.clientId,
      agencyId: user.agencyId,
      primaryCurrency: user.primaryCurrency,
    };

    const access_token = await this.jwt.signAsync(payload);
    const refresh_token = generateRefreshToken();

    return { access_token, refresh_token };
  }

  private async createSession(
    userId: string,
    tokens: { access_token: string; refresh_token: string },
    deviceId?: string | null,
  ): Promise<void> {
    await this.prisma.userSession.create({
      data: {
        userId,
        token: tokens.access_token,
        refreshToken: tokens.refresh_token,
        refreshTokenExpiresAt: new Date(
          Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
        ),
        deviceId: deviceId ?? null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'ACTIVE',
      },
    });
  }

  private toPublicUser(user: any): PublicUser {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      clientId: user.clientId,
      firstName: user.firstName,
      lastName: user.lastName,
      agencyId: user.agencyId,
      primaryCurrency: user.primaryCurrency,
      loyaltyPoints: user.loyaltyPoints ?? 0,
      loyaltyTier: user.loyaltyTier,
      kycLevel: user.kycLevel,
      balance: user.balance != null ? Number(user.balance) : 0,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      mfaEnabled: user.mfaEnabled,
      birthDate: user.birthDate,
      birthPlace: user.birthPlace,
      nationality: user.nationality,
      addressStreet: user.addressStreet,
      postalCode: user.postalCode,
      city: user.city,
      country: user.country,
      client: user.client
        ? {
            id: user.client.id,
            code: user.client.code,
            name: user.client.name,
            primaryColor: user.client.primaryColor,
            logoUrl: user.client.logoUrl,
          }
        : undefined,
      agency: user.agency
        ? {
            id: user.agency.id,
            name: user.agency.name,
            country: user.agency.country,
            primaryCurrency: user.agency.primaryCurrency,
          }
        : undefined,
      wallets: Array.isArray(user.wallets)
        ? user.wallets.map((w: any) => ({
            id: w.id,
            currency: w.currency,
            balance: Number(w.balance),
            reservedBalance: Number(w.reservedBalance ?? 0),
            isDefault: w.isDefault,
            isActive: w.isActive,
          }))
        : undefined,
    };
  }

  private generateReferralCode(firstName?: string, lastName?: string): string {
    const prefix = `${(firstName ?? 'U').slice(0, 1)}${(lastName ?? 'X').slice(0, 1)}`.toUpperCase();
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}${suffix}`;
  }

  private async audit(
    userId: string | null,
    clientId: number | null,
    action: AuditAction,
    details?: any,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          clientId,
          action,
          details: details ?? undefined,
          successful: true,
        },
      });
    } catch (e) {
      this.logger.warn('Audit log failed', e);
    }
  }
}