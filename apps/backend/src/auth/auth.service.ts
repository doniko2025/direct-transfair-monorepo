// apps/backend/src/auth/auth.service.ts
// =========================================================
// AUTH SERVICE v5.0 — Direct Transf'air
// ✅ v4.7 conservé intégralement
// ✅ v5.0 : BÉTON — 6 correctifs critiques
//
//   FIX 1 — Verification gate sur /auth/login (v1)
//     La route v1 était contournable : un user non vérifié
//     pouvait obtenir un JWT sans passer par verify-contact.
//     → Même gate qu'en v2 : HttpException VERIFICATION_REQUIRED
//     si isEmailVerified=false OU (phone && !isPhoneVerified).
//
//   FIX 2 — Refresh token hashé (SHA-256) en base
//     Avant : token clair en DB → compromis DB = tous les
//     refresh tokens exploitables immédiatement.
//     Après : SHA-256 hex stocké, token brut transmis au client.
//     Lookup par hash(token) au lieu du token brut.
//     ⚠️  MIGRATION : sessions existantes invalidées au déploiement
//     (hash ne match plus) → tous les users déconnectés une fois.
//
//   FIX 3 — Access token TTL 7j → 1h
//     Aligne le v1 sur le v2 et les standards industrie.
//
//   FIX 4 — lockedUntil vérifié dans validateUser()
//     failedLoginAttempts incrémenté mais compte jamais verrouillé.
//     Maintenant : ≥5 échecs → lockedUntil = now + 30 min.
//
//   FIX 5 — SMS réel via SmsService (Twilio)
//     sendOtpInternal() appelait logger.log('[SMS STUB]...')
//     → maintenant délègue à smsService.sendOtp().
//     SmsService gère automatiquement le fallback stub si
//     TWILIO_* non configuré en .env.
//
//   FIX 6 — verifyLoginOtp() marque email vérifié si canal EMAIL
//     La vérification d'OTP via EMAIL prouve la possession de
//     l'email → on marque isEmailVerified=true si besoin.
// =========================================================

import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AuditAction,
  CommsType,
  CurrencyCode,
  KycLevel,
  OtpPurpose,
  Role,
  User,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { UsersService }  from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService }   from '../mail/mail.service';
import { SmsService }    from '../sms/sms.service';   // ✅ v5.0 : SMS réel

import { RegisterDto }                      from './dto/register.dto';
import { LoginDto, VerifyLoginOtpDto }      from './dto/login.dto';

// =========================================================
// CURRENCY MAP
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

// =========================================================
// CONSTANTES SÉCURITÉ ✅ v5.0
// =========================================================

const OTP_EXPIRY_MINUTES  = 10;
const REFRESH_TOKEN_DAYS  = 30;
const MAX_FAILED_LOGINS   = 5;    // ✅ v5.0 : lock après 5 échecs
const LOCK_DURATION_MIN   = 30;   // ✅ v5.0 : verrouillage 30 min

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
  const raw = country.trim();
  if (raw.length <= 3) {
    const found = COUNTRY_TO_CURRENCY[raw.toUpperCase()];
    if (found) return found;
  }
  const u = raw.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (u.includes('GUIN') && !u.includes('BISS') && !u.includes('EQUAT')) return CurrencyCode.GNF;
  if (u.includes('GUIN') && u.includes('BISS')) return CurrencyCode.XOF;
  if (['FRANCE','ALLEMAGNE','BELGIQUE','PORTUGAL','ESPAGNE','ITALIE',
       'PAYS-BAS','LUXEMBOURG','AUTRICHE','FINLANDE','IRLANDE','GRECE',
       'SLOVENIE','SLOVAQUIE','ESTONIE','LITUANIE','LETTONIE','MALTE','CHYPRE']
      .some((k) => u.includes(k))) return CurrencyCode.EUR;
  if (u.includes('ROYAUME') || u === 'UK' || u === 'ANGLETERRE') return CurrencyCode.GBP;
  if ((u.includes('ETATS') && u.includes('UNIS')) || u === 'USA') return CurrencyCode.USD;
  if (['SENEGAL','MALI','BENIN','TOGO','IVOIRE','BURKINA','BISSAU']
      .some((k) => u.includes(k))) return CurrencyCode.XOF;
  if (u.includes('NIGER') && !u.includes('NIGERIA')) return CurrencyCode.XOF;
  return COUNTRY_TO_CURRENCY[raw.toUpperCase().substring(0, 2)] ?? CurrencyCode.XOF;
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

function generateOtpCode4(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

function generateReferralCode(firstName?: string, lastName?: string): string {
  const prefix = `${(firstName ?? 'U').slice(0, 1)}${(lastName ?? 'X').slice(0, 1)}`.toUpperCase();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}${suffix}`;
}

// ✅ v5.0 : Hash SHA-256 déterministe pour les refresh tokens
// SHA-256 d'un token 48 octets = 2^384 combinaisons → brute-force impossible
// Avantage vs bcrypt : déterministe → lookup direct en DB
function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users:      UsersService,
    private readonly jwt:        JwtService,
    private readonly prisma:     PrismaService,
    private readonly mail:       MailService,
    private readonly smsService: SmsService,   // ✅ v5.0
  ) {}

  // ========================================================
  // LOGIN — Étape 1 ✅ v4.7 + v5.0 (verification gate)
  // ========================================================

  async login(
    dto: LoginDto,
    tenantCode?: string | null,
  ): Promise<LoginStep2Result | LoginStep1Result> {
    const otpRequired = process.env.LOGIN_OTP_REQUIRED === 'true';

    const identifier = (dto.identifier ?? dto.email ?? '').trim();
    if (!identifier) throw new BadRequestException('Identifiant requis');

    let tenantClientId: number | null = null;
    const normalizedTenantCode = normalizeTenantCode(tenantCode);
    if (normalizedTenantCode && normalizedTenantCode !== 'DONIKO') {
      const tenantClient = await this.prisma.client.findUnique({
        where: { code: normalizedTenantCode },
        select: { id: true, isActive: true },
      });
      if (tenantClient?.isActive) tenantClientId = tenantClient.id;
    }

    const user = await this.validateUser(identifier, dto.password, tenantClientId);
    if (!user) throw new UnauthorizedException('Identifiants incorrects');
    if (user.isSuspended) throw new UnauthorizedException('Compte suspendu');

    // ── v4.7 : Isolation portail ─────────────────────────
    const isDefaultPortal = !normalizedTenantCode || normalizedTenantCode === 'DONIKO';

    if (isDefaultPortal && user.role !== Role.SUPER_ADMIN) {
      throw new HttpException(
        {
          statusCode: 403, code: 'USE_COMPANY_PORTAL',
          clientCode:   user.client?.code        ?? null,
          subdomain:    user.client?.subdomain    ?? null,
          customDomain: user.client?.customDomain ?? null,
          message: user.client?.code
            ? `Ce compte appartient à l'espace "${user.client.code}".`
            : `Connectez-vous via le portail de votre société.`,
        },
        403,
      );
    }
    if (!isDefaultPortal && user.role === Role.SUPER_ADMIN) {
      throw new HttpException(
        {
          statusCode: 403, code: 'USE_DEFAULT_PORTAL',
          message: `Le Super Admin doit se connecter via le portail principal.`,
        },
        403,
      );
    }

    // ── ✅ v5.0 : Gate vérification — ferme le contournement v1 ──
    if (!user.isEmailVerified) {
      throw new HttpException(
        {
          statusCode:           403,
          code:                 'VERIFICATION_REQUIRED',
          requiresVerification: true,
          userId:               user.id,
          emailVerified:        false,
          phoneVerified:        user.isPhoneVerified ?? false,
          hasPhone:             !!user.phone,
          message:              'Email non vérifié. Vérifiez votre adresse avant de vous connecter.',
        },
        403,
      );
    }
    if (user.phone && !user.isPhoneVerified) {
      throw new HttpException(
        {
          statusCode:           403,
          code:                 'VERIFICATION_REQUIRED',
          requiresVerification: true,
          userId:               user.id,
          emailVerified:        true,
          phoneVerified:        false,
          hasPhone:             true,
          message:              'Téléphone non vérifié. Vérifiez votre numéro avant de vous connecter.',
        },
        403,
      );
    }

    if (otpRequired) {
      const isPhone = isPhoneIdentifier(identifier);
      const channel: CommsType = isPhone && user.phone ? CommsType.SMS : CommsType.EMAIL;
      const recipient = channel === CommsType.EMAIL ? user.email : (user.phone ?? user.email);
      if (!recipient) throw new BadRequestException('Aucun canal de contact disponible');
      await this.sendOtpInternal(user.id, channel, OtpPurpose.LOGIN, recipient);
      return {
        step:            'OTP_REQUIRED',
        userId:          user.id,
        otpSent:         true,
        otpChannel:      channel,
        maskedRecipient: channel === CommsType.EMAIL ? maskEmail(recipient) : maskPhone(recipient),
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
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      user:          this.toPublicUser(user),
    };
  }

  // ========================================================
  // LOGIN — Étape 2 ✅ v5.0 (marque email vérifié si canal EMAIL)
  // ========================================================

  async verifyLoginOtp(dto: VerifyLoginOtpDto): Promise<LoginStep2Result> {
    const otpLog = await this.prisma.otpLog.findFirst({
      where: {
        userId:    dto.userId,
        code:      dto.code,
        purpose:   OtpPurpose.LOGIN,
        isUsed:    false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpLog) {
      await this.prisma.otpLog.updateMany({
        where: {
          userId: dto.userId, purpose: OtpPurpose.LOGIN,
          isUsed: false, expiresAt: { gte: new Date() },
        },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Code OTP invalide ou expiré');
    }

    await this.prisma.otpLog.update({
      where: { id: otpLog.id },
      data:  { isUsed: true, usedAt: new Date() },
    });

    // ✅ v5.0 : Vérification contact automatique lors de la validation OTP
    const verificationUpdate: any = {};
    if (otpLog.channel === CommsType.EMAIL)
      verificationUpdate.isEmailVerified = true;
    if (otpLog.channel === CommsType.SMS)
      verificationUpdate.isPhoneVerified = true;

    if (Object.keys(verificationUpdate).length > 0) {
      await this.prisma.user.update({
        where: { id: dto.userId },
        data:  verificationUpdate,
      });
    }

    const user = await this.prisma.user.findUnique({
      where:   { id: dto.userId },
      include: { client: true, agency: true, wallets: { where: { isActive: true } } },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (dto.trustDevice && dto.deviceId) {
      await this.prisma.userDevice.updateMany({
        where: { userId: user.id, deviceId: dto.deviceId },
        data:  { status: 'TRUSTED', trustedAt: new Date() },
      });
    }

    const tokens = await this.generateTokens(user);
    await this.createSession(user.id, tokens, dto.deviceId ?? null);
    await this.audit(
      user.id, user.clientId,
      otpLog.channel === CommsType.SMS ? AuditAction.LOGIN_PHONE : AuditAction.LOGIN,
    );
    await this.prisma.user.update({
      where: { id: user.id },
      data:  { lastLoginAt: new Date(), failedLoginAttempts: 0 },
    });

    return {
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      user:          this.toPublicUser(user),
    };
  }

  // ========================================================
  // VALIDATE USER ✅ v5.0 (lockedUntil + locking après 5 échecs)
  // ========================================================

  async validateUser(
    identifier:    string,
    pass:          string,
    tenantClientId?: number | null,
  ): Promise<any | null> {
    const isEmail = identifier.includes('@');
    let user: any = null;

    if (isEmail) {
      user = await this.prisma.user.findUnique({
        where:   { email: normalizeEmail(identifier) },
        include: { client: true, agency: true, wallets: { where: { isActive: true } } },
      });
    } else {
      const phone = normalizePhone(identifier);
      if (phone) {
        user = await this.prisma.user.findFirst({
          where:   { phone },
          include: { client: true, agency: true, wallets: { where: { isActive: true } } },
        });
      }
    }

    if (!user) return null;

    // ── v4.5 : isolation cross-tenant ─────────────────────
    if (typeof tenantClientId === 'number' && tenantClientId > 0 && user.role !== Role.SUPER_ADMIN) {
      if (user.clientId !== tenantClientId) {
        this.logger.warn(`[validateUser] Cross-tenant blocked: user.clientId=${user.clientId} vs tenant=${tenantClientId}`);
        await this.prisma.user.update({
          where: { id: user.id },
          data:  { failedLoginAttempts: { increment: 1 }, lastFailedLoginAt: new Date() },
        }).catch(() => {});
        return null;
      }
    }

    // ── ✅ v5.0 : Vérification verrouillage ──────────────
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(
        `Compte verrouillé. Réessayez dans ${minutesLeft} minute(s).`,
      );
    }

    if (await bcrypt.compare(pass, user.password)) {
      // Réinitialiser le compteur en cas de succès
      if ((user.failedLoginAttempts ?? 0) > 0) {
        await this.prisma.user.update({
          where: { id: user.id },
          data:  { failedLoginAttempts: 0, lockedUntil: null },
        }).catch(() => {});
      }
      return user;
    }

    // ── ✅ v5.0 : Incrémenter + verrouiller si seuil atteint
    const newCount  = (user.failedLoginAttempts ?? 0) + 1;
    const shouldLock = newCount >= MAX_FAILED_LOGINS;
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: newCount,
        lastFailedLoginAt:   new Date(),
        ...(shouldLock && {
          lockedUntil: new Date(Date.now() + LOCK_DURATION_MIN * 60 * 1000),
        }),
      },
    }).catch(() => {});

    if (shouldLock) {
      throw new UnauthorizedException(
        `Trop de tentatives échouées. Compte verrouillé ${LOCK_DURATION_MIN} minutes.`,
      );
    }

    return null;
  }

  // ========================================================
  // LOGIN BY PHONE — v4.7 + v5.0 (SMS réel)
  // ========================================================

  async loginByPhone(
    phone:      string,
    tenantCode?: string | null,
  ): Promise<{ userId: string; maskedPhone: string }> {
    const normalized = normalizePhone(phone);
    if (!normalized) throw new BadRequestException('Numéro de téléphone invalide');

    let tenantClientId: number | null = null;
    const normalizedTenantCode = normalizeTenantCode(tenantCode);
    if (normalizedTenantCode && normalizedTenantCode !== 'DONIKO') {
      const tenantClient = await this.prisma.client.findUnique({
        where: { code: normalizedTenantCode },
        select: { id: true, isActive: true },
      });
      if (tenantClient?.isActive) tenantClientId = tenantClient.id;
    }

    const userWhere: any = { phone: normalized };
    if (tenantClientId) userWhere.clientId = tenantClientId;

    const user = await this.prisma.user.findFirst({
      where: userWhere,
      select: {
        id: true, phone: true, isSuspended: true,
        clientId: true, role: true,
        client: { select: { code: true, subdomain: true, customDomain: true } },
      },
    });

    if (!user)       throw new NotFoundException('Numéro de téléphone non reconnu.');
    if (user.isSuspended) throw new UnauthorizedException('Compte suspendu');

    const isDefaultPortal = !normalizedTenantCode || normalizedTenantCode === 'DONIKO';
    if (isDefaultPortal && user.role !== Role.SUPER_ADMIN) {
      throw new HttpException(
        {
          statusCode: 403, code: 'USE_COMPANY_PORTAL',
          clientCode:   user.client?.code        ?? null,
          subdomain:    user.client?.subdomain    ?? null,
          customDomain: user.client?.customDomain ?? null,
        },
        403,
      );
    }
    if (!isDefaultPortal && user.role === Role.SUPER_ADMIN) {
      throw new HttpException(
        { statusCode: 403, code: 'USE_DEFAULT_PORTAL', message: 'Portail incorrect pour le Super Admin.' },
        403,
      );
    }

    await this.sendOtpInternal(user.id, CommsType.SMS, OtpPurpose.LOGIN, normalized, 4);
    await this.audit(user.id, user.clientId, AuditAction.OTP_REQUEST, {
      purpose: OtpPurpose.LOGIN, channel: CommsType.SMS, source: 'loginByPhone',
    });

    return { userId: user.id, maskedPhone: maskPhone(normalized) };
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
      normalizeTenantCode(tenantFromHeader) ?? normalizeTenantCode(dto.tenantCode) ?? 'DONIKO';

    const client = await this.prisma.client.findUnique({ where: { code: resolvedTenantCode } });
    if (!client) throw new BadRequestException(`Société introuvable (${resolvedTenantCode}).`);

    const primaryCurrency: CurrencyCode = getCurrencyFromCountry(dto.country);

    const user = await this.prisma.user.create({
      data: {
        email, phone, password: hashedPassword,
        role:            dto.role === 'AGENT' ? Role.AGENT : Role.USER,
        clientId:        client.id,
        firstName:       dto.firstName,
        lastName:        dto.lastName,
        country:         dto.country,
        city:            dto.city,
        primaryCurrency,
        addressStreet:   dto.addressStreet,
        postalCode:      dto.postalCode,
        nationality:     dto.nationality,
        birthDate:       dto.birthDate,
        birthCountry:    dto.birthCountry,
        birthCity:       dto.birthCity,
        birthPlace:      dto.birthPlace,
        kycLevel:        KycLevel.LEVEL_0,
        referralCode:    generateReferralCode(dto.firstName, dto.lastName),
      },
    });

    await this.prisma.wallet.create({
      data: { userId: user.id, currency: primaryCurrency, balance: 0, isDefault: true, isActive: true },
    });
    await this.audit(user.id, client.id, AuditAction.USER_CREATE, { country: dto.country, currency: primaryCurrency });

    this.mail.sendEmail(
      email,
      "Bienvenue sur Direct Transf'air 🎉",
      `<p>Bonjour ${dto.firstName},</p>
       <p>Votre compte a bien été créé. Pour l'activer, vérifiez votre adresse email.</p>`,
    ).catch((e) => { this.logger.warn('Échec email bienvenue', e); });

    this.sendOtpInternal(user.id, CommsType.EMAIL, OtpPurpose.EMAIL_VERIFICATION, email)
      .catch((e) => { this.logger.warn(`OTP email non envoyé pour ${email} : ${e?.message}`); });

    const freshUser = await this.prisma.user.findUnique({
      where:   { id: user.id },
      include: { client: true, agency: true, wallets: { where: { isActive: true } } },
    });
    if (!freshUser) throw new NotFoundException('Utilisateur introuvable après création');

    const tokens = await this.generateTokens(freshUser);
    await this.createSession(freshUser.id, tokens);
    await this.audit(freshUser.id, client.id, AuditAction.LOGIN);
    await this.prisma.user.update({
      where: { id: freshUser.id },
      data:  { lastLoginAt: new Date(), failedLoginAttempts: 0 },
    });

    return {
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      user:          this.toPublicUser(freshUser),
    };
  }

  // ========================================================
  // FIND ACCOUNT
  // ========================================================

  async findAccount(identifier: string) {
    const isEmail = identifier.includes('@');
    let user: User | null = null;
    if (isEmail) {
      user = await this.prisma.user.findUnique({ where: { email: normalizeEmail(identifier) } });
    } else {
      const phone = normalizePhone(identifier);
      if (phone) user = await this.prisma.user.findFirst({ where: { phone } });
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
    const otpChannel: CommsType = channel === 'PHONE' ? CommsType.SMS : CommsType.EMAIL;
    const recipient = otpChannel === CommsType.EMAIL ? user.email : user.phone;
    if (!recipient) throw new BadRequestException('Canal indisponible');
    const otpPurpose = (OtpPurpose as any)[purpose] ?? OtpPurpose.PASSWORD_RESET;
    await this.sendOtpInternal(userId, otpChannel, otpPurpose, recipient);
    return { success: true };
  }

  // ========================================================
  // OTP — Interne ✅ v5.0 : SMS via SmsService (Twilio/stub)
  // ========================================================

  private async sendOtpInternal(
    userId:     string,
    channel:    CommsType,
    purpose:    OtpPurpose,
    recipient:  string,
    codeLength: 4 | 6 = 6,
  ): Promise<void> {
    const code      = codeLength === 4 ? generateOtpCode4() : generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.otpLog.updateMany({
      where: { userId, purpose, isUsed: false },
      data:  { isExpired: true },
    });
    await this.prisma.otpLog.create({
      data: { userId, code, purpose, channel, recipient, expiresAt },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data:  { otpCode: code, otpExpiresAt: expiresAt, otpPurpose: purpose, otpChannel: channel },
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
      // ✅ v5.0 : SMS réel via SmsService (Twilio si configuré, stub sinon)
      try {
        await this.smsService.sendOtp(recipient, code, userId);
      } catch (e) {
        // Non-bloquant — l'OTP est sauvegardé en base, retry possible
        this.logger.error(`Erreur envoi SMS OTP → ${recipient}`, e);
      }
    }

    await this.audit(userId, null, AuditAction.OTP_REQUEST, { purpose, channel });
  }

  // ========================================================
  // VERIFY OTP (générique)
  // ========================================================

  async verifyOtp(userId: string, code: string, type?: string) {
    const purpose = type ? ((OtpPurpose as any)[type] ?? null) : null;
    const where: any = { userId, code, isUsed: false, expiresAt: { gte: new Date() } };
    if (purpose) where.purpose = purpose;

    const otpLog = await this.prisma.otpLog.findFirst({ where, orderBy: { createdAt: 'desc' } });
    if (!otpLog) throw new BadRequestException('Code invalide ou expiré');

    await this.prisma.otpLog.update({
      where: { id: otpLog.id },
      data:  { isUsed: true, usedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        otpCode:      null,
        otpExpiresAt: null,
        isEmailVerified: otpLog.purpose === OtpPurpose.EMAIL_VERIFICATION ? true : user.isEmailVerified,
        isPhoneVerified: otpLog.purpose === OtpPurpose.PHONE_VERIFICATION ? true : user.isPhoneVerified,
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
      where: { userId, code, purpose: OtpPurpose.PASSWORD_RESET, isUsed: false, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otpLog) throw new BadRequestException('Code invalide ou expiré');

    const hashedPassword = await bcrypt.hash(newPass, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });
    await this.prisma.otpLog.update({ where: { id: otpLog.id }, data: { isUsed: true, usedAt: new Date() } });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) await this.audit(userId, user.clientId, AuditAction.PASSWORD_CHANGE);

    return { success: true };
  }

  // ========================================================
  // REFRESH TOKEN ✅ v5.0 : lookup et stockage par hash SHA-256
  // ========================================================

  async refreshTokens(refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('Refresh token manquant');

    // ✅ v5.0 : Le token en DB est hashé → on hash l'input pour le lookup
    const hashedInput = hashRefreshToken(refreshToken);

    const session = await this.prisma.userSession.findUnique({
      where:   { refreshToken: hashedInput },
      include: {
        user: { include: { client: true, agency: true, wallets: { where: { isActive: true } } } },
      },
    });

    if (!session || session.status !== 'ACTIVE') {
      throw new UnauthorizedException('Session invalide');
    }
    if (session.refreshTokenExpiresAt && session.refreshTokenExpiresAt < new Date()) {
      await this.prisma.userSession.update({ where: { id: session.id }, data: { status: 'EXPIRED' } });
      throw new UnauthorizedException('Refresh token expiré');
    }

    const tokens = await this.generateTokens(session.user as any);

    // ✅ v5.0 : Stocker le hash du nouveau refresh token
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        token:                 tokens.access_token,
        refreshToken:          hashRefreshToken(tokens.refresh_token), // ← hash
        refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    return { access_token: tokens.access_token, refresh_token: tokens.refresh_token };
  }

  // ========================================================
  // LOGOUT
  // ========================================================

  async logout(userId: string, accessToken?: string) {
    const where: any = { userId, status: 'ACTIVE' };
    if (accessToken) where.token = accessToken;
    await this.prisma.userSession.updateMany({ where, data: { status: 'REVOKED', revokedAt: new Date() } });
    await this.audit(userId, null, AuditAction.LOGOUT);
    return { success: true };
  }

  // ========================================================
  // PROFIL
  // ========================================================

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where:   { id: userId },
      include: { client: true, agency: true, wallets: { where: { isActive: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toPublicUser(user);
  }

  async updateProfile(userId: string, data: any) {
    const updateData: any = { ...data };
    ['id','role','password','email','balance','clientId','kycLevel',
     'loyaltyPoints','loyaltyTier','referralCode','wallets','client','agency']
      .forEach((k) => delete updateData[k]);

    if (updateData.phone) updateData.phone = normalizePhone(updateData.phone);
    if (updateData.country) {
      const newCurrency: CurrencyCode = getCurrencyFromCountry(updateData.country);
      updateData.primaryCurrency = newCurrency;
      const existing = await this.prisma.wallet.findUnique({
        where: { userId_currency: { userId, currency: newCurrency } },
      });
      if (!existing) {
        await this.prisma.wallet.create({ data: { userId, currency: newCurrency, balance: 0, isActive: true } });
      }
    }

    try {
      await this.prisma.user.update({ where: { id: userId }, data: updateData });
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException('Ce numéro de téléphone est déjà utilisé.');
      throw new BadRequestException('Erreur lors de la mise à jour du profil.');
    }

    await this.audit(userId, null, AuditAction.USER_UPDATE);
    return this.getProfile(userId);
  }

  // ========================================================
  // CHANGE PASSWORD
  // ========================================================

  async changePassword(userId: string, oldPass: string, newPass: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const isMatch = await bcrypt.compare(oldPass, user.password);
    if (!isMatch) throw new BadRequestException('Ancien code secret incorrect.');
    if (newPass.length < 6) throw new BadRequestException('Le nouveau code doit faire au moins 6 caractères.');
    if (oldPass === newPass) throw new BadRequestException("Le nouveau code doit être différent de l'ancien.");

    await this.prisma.user.update({
      where: { id: userId },
      data:  { password: await bcrypt.hash(newPass, 10) },
    });
    await this.audit(userId, user.clientId, AuditAction.PASSWORD_CHANGE);

    if (user.email) {
      this.mail.sendEmail(
        user.email, 'Mot de passe modifié',
        `<p>Votre mot de passe a été modifié avec succès.</p>
         <p style="color:#DC2626;">Si vous n'êtes pas à l'origine de cette modification, contactez-nous immédiatement.</p>`,
      ).catch((e) => { this.logger.warn('Échec email confirmation password', e); });
    }

    return { success: true, message: 'Mot de passe mis à jour avec succès' };
  }

  // ========================================================
  // HELPERS PRIVÉS
  // ========================================================

  // ✅ v5.0 : TTL 1h (vs 7j en v4.x)
  private async generateTokens(user: any): Promise<{
    access_token:  string;
    refresh_token: string;
  }> {
    const payload = { sub: user.id, email: user.email, role: user.role, clientId: user.clientId };
    const access_token  = this.jwt.sign(payload, { expiresIn: '1h' }); // ✅ 7d → 1h
    const refresh_token = generateRefreshToken();
    return { access_token, refresh_token };
  }

  // ✅ v5.0 : refresh token hashé (SHA-256) avant stockage en DB
  private async createSession(
    userId:   string,
    tokens:   { access_token: string; refresh_token: string },
    deviceId?: string | null,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
    try {
      await this.prisma.userSession.deleteMany({ where: { userId } });
      await this.prisma.userSession.create({
        data: {
          userId,
          token:                 tokens.access_token,
          refreshToken:          hashRefreshToken(tokens.refresh_token), // ← hash stocké
          refreshTokenExpiresAt: expiresAt,
          expiresAt,
          deviceId:              deviceId ?? null,
          status:                'ACTIVE',
        },
      });
    } catch (e) {
      this.logger.warn('Session create error (non-bloquant)', e);
    }
  }

  private toPublicUser(user: any): PublicUser {
    return {
      id: user.id, email: user.email, phone: user.phone,
      role: user.role, clientId: user.clientId,
      firstName: user.firstName, lastName: user.lastName,
      agencyId: user.agencyId, primaryCurrency: user.primaryCurrency,
      kycLevel: user.kycLevel, balance: 0,
      isEmailVerified: user.isEmailVerified, isPhoneVerified: user.isPhoneVerified,
      mfaEnabled: user.mfaEnabled, birthDate: user.birthDate,
      birthPlace: user.birthPlace, nationality: user.nationality,
      addressStreet: user.addressStreet, postalCode: user.postalCode,
      city: user.city, country: user.country,
      client: user.client, agency: user.agency, wallets: user.wallets,
    };
  }

  private async audit(
    userId: string, clientId: number | null,
    action: AuditAction, details?: any,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: { userId, clientId, action, details: details ?? undefined, successful: true },
      });
    } catch (e) {
      this.logger.warn('Audit log error (non-bloquant)', e);
    }
  }
}