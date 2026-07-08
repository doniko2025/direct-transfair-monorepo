// apps/backend/src/auth/v2-auth.service.ts
// =========================================================
// AUTH SERVICE v2.3 — Sécurité production
//
// ✅ v2.0 : Toutes les corrections de sécurité originales conservées
// ✅ v2.1 : CORRECTIFS RATE LIMIT
//
//   FIX 1 — dispatchVerificationOtps : guard OTP récent
//     AVANT : un OTP était renvoyé à chaque tentative de
//     connexion bloquée → 3 tentatives épuisaient le quota.
//     Exemple : user non vérifié tente 3x loginPassword() →
//     3 OTP envoyés → 4ème appel (verify-contact auto-send) → 429.
//     APRÈS : on vérifie si un OTP valide < 9 min existe déjà.
//     Si oui → pas de renvoi, le code précédent est encore valable.
//
//   FIX 2 — sendVerificationOtp : idempotence sur OTP récent
//     AVANT : chaque appel à /auth/v2/send-verification
//     envoyait un nouveau code et incrémentait le compteur.
//     Cas typique : inscription → verify-contact auto-send =
//     2 OTPs. Si le user recharge la page = 3 OTPs → 429.
//     APRÈS : si OTP valide < 9 min existe (ex: créé par
//     register() en v1), on retourne success sans renvoyer.
//     Le user utilise le code qu'il a déjà reçu dans sa boîte.
//     Si OTP > 9 min (proche expiration), on en génère un nouveau.
//
// ✅ v2.2 : FIX 3 — 🚨 normalisation téléphone centralisée (sécurité)
//     La fonction normalizePhone() locale de ce fichier gérait les
//     espaces/tirets/parenthèses/points mais pas la conversion
//     "00" → "+", ce qui a permis à deux comptes de stocker le même
//     numéro réel sous deux formats différents et à un dépôt de
//     50 000 € d'être crédité sur le mauvais compte. Détail complet
//     dans common/utils/phone.util.ts et transactions.service.ts
//     (v4.18). Remplacée ici par normalizePhoneE164() dans
//     requestOtpPhone().
//
// ✅ v2.3 : 🚨 FIX — allVerified incohérent avec le bypass DEV téléphone
//     PROBLÈME RÉSOLU (juillet 2026) :
//     buildVerificationNeeded() (plus bas dans ce même fichier) bypass
//     déjà la vérification téléphone en DEV — hasPhone forcé à false,
//     phoneOk forcé à true. Mais verifyContact() calculait allVerified
//     séparément, avec la vraie règle non bypassée :
//       isEmailVerified && (!phone || isPhoneVerified)
//     Comme l'inscription (register()) exige un téléphone, la quasi-
//     totalité des comptes en ont un. Résultat : après vérification de
//     l'email, allVerified revenait systématiquement false — alors que
//     verify-contact.tsx (mobile) ne propose JAMAIS l'étape téléphone
//     en DEV. Le frontend passait alors à l'étape suivante inexistante,
//     atterrissait sur un état local "done" sans jamais recevoir
//     allVerified=true, et restait bloqué indéfiniment sur l'écran
//     "Connexion en cours…" (voir verify-contact.tsx v1.4).
//     CORRECTIF : même bascule DEV/PROD que buildVerificationNeeded(),
//     pour que les deux logiques de vérification restent synchronisées
//     et basculent ensemble vers la prod le jour venu.
// =========================================================

import {
  BadRequestException,
  ForbiddenException,
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
  DeviceStatus,
  OtpPurpose,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { normalizePhoneE164 } from '../common/utils/phone.util'; // ✅ v2.2

import type {
  LoginPasswordV2Dto,
  RequestOtpEmailDto,
  RequestOtpPhoneDto,
  SendVerificationOtpDto,
  VerifyContactDto,
  VerifyOtpLoginV2Dto,
} from './dto/v2-auth.dto';

// =========================================================
// CONSTANTES SÉCURITÉ
// =========================================================

const OTP_LENGTH             = 6;
const OTP_EXPIRY_MINUTES     = 10;
const OTP_MAX_ATTEMPTS       = 5;
const OTP_MAX_SENDS_PER_HOUR = 3;
const LOCK_DURATION_MINUTES  = 30;
const MAX_FAILED_LOGINS      = 5;
const ACCESS_TOKEN_TTL       = '1h';
const REFRESH_TOKEN_DAYS     = 30;

// ✅ v2.1 : fenêtre de réutilisation d'un OTP récent (9 min < TTL 10 min)
const OTP_RECENT_WINDOW_MS = 9 * 60 * 1000;

// =========================================================
// TYPES
// =========================================================

export type OtpRequestResult = {
  userId:          string;
  maskedRecipient: string;
  channel:         'EMAIL' | 'SMS';
};

export type LoginResult = {
  access_token:  string;
  refresh_token: string;
  user:          Record<string, unknown>;
};

export type VerificationNeededResult = {
  requiresVerification: true;
  userId:               string;
  emailVerified:        boolean;
  phoneVerified:        boolean;
  hasPhone:             boolean;
  message:              string;
};

export type VerifyContactResult = {
  success:       true;
  emailVerified: boolean;
  phoneVerified: boolean;
  hasPhone:      boolean;
  allVerified:   boolean;
};

export type VerificationStatus = {
  emailVerified:   boolean;
  phoneVerified:   boolean;
  hasPhone:        boolean;
  maskedEmail:     string;
  maskedPhone:     string | null;
  allVerified:     boolean;
};

// =========================================================
// HELPERS
// =========================================================

function generateOtp(length: number = OTP_LENGTH): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length);
  return String(crypto.randomInt(min, max));
}

function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

function normalizeEmail(email: string): string {
  return (email ?? '').trim().toLowerCase();
}

// ✅ v2.2 : normalizePhone() locale SUPPRIMÉE — remplacée par
// normalizePhoneE164() importée de ../common/utils/phone.util.
// Cette version locale gérait les espaces/tirets/parenthèses/points
// mais pas la conversion "00" → "+" (voir phone.util.ts pour le
// détail complet du bug de collision de téléphone corrigé).

function normalizeTenantCode(code?: string | null): string | null {
  const c = (code ?? '').trim().toUpperCase();
  return c || null;
}

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return email;
  const visible = user.substring(0, Math.min(2, user.length));
  return `${visible}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return `${phone.substring(0, 4)}${'*'.repeat(Math.max(2, phone.length - 6))}${phone.slice(-2)}`;
}

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class V2AuthService {
  private readonly logger = new Logger(V2AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt:    JwtService,
    private readonly mail:   MailService,
  ) {}

  // ═══════════════════════════════════════════════════════
  // 1. CONNEXION PAR MOT DE PASSE
  // ═══════════════════════════════════════════════════════

  async loginWithPassword(
    dto: LoginPasswordV2Dto,
    tenantCode?: string | null,
  ): Promise<LoginResult | VerificationNeededResult> {
    const email      = normalizeEmail(dto.email);
    const normalized = normalizeTenantCode(tenantCode);

    const user = await this.prisma.user.findUnique({
      where:   { email },
      include: { client: true, agency: true, wallets: { where: { isActive: true } } },
    });

    this.assertUserExists(user);
    this.assertNotDeleted(user!);
    this.assertAccountActive(user!);
    this.assertClientActive(user!);
    this.assertNotLocked(user!);
    this.assertPortalIsolation(user!, normalized);

    const isMatch = await bcrypt.compare(dto.password, user!.password);
    if (!isMatch) {
      await this.handleFailedLogin(user!);
      throw new UnauthorizedException('Identifiants incorrects');
    }

    await this.prisma.user.update({
      where: { id: user!.id },
      data:  { failedLoginAttempts: 0, lastFailedLoginAt: null, lockedUntil: null },
    });

    const pending = this.buildVerificationNeeded(user!);
    if (pending) {
      await this.dispatchVerificationOtps(user!);
      return pending;
    }

    await this.markLastLogin(user!.id);
    await this.audit(user!.id, user!.clientId, AuditAction.LOGIN);
    return this.buildLoginResponse(user!);
  }

  // ═══════════════════════════════════════════════════════
  // 2. DEMANDE OTP PAR EMAIL
  // ═══════════════════════════════════════════════════════

  async requestOtpEmail(
    dto: RequestOtpEmailDto,
    tenantCode?: string | null,
  ): Promise<OtpRequestResult> {
    const email      = normalizeEmail(dto.email);
    const normalized = normalizeTenantCode(tenantCode);

    const user = await this.prisma.user.findUnique({
      where:   { email },
      include: { client: true },
    });

    this.assertUserExists(user, 'Aucun compte associé à cet email');
    this.assertNotDeleted(user!);
    this.assertAccountActive(user!);
    this.assertClientActive(user!);
    this.assertNotLocked(user!);
    this.assertPortalIsolation(user!, normalized);

    const pending = this.buildVerificationNeeded(user!);
    if (pending) {
      await this.dispatchVerificationOtps(user!);
      throw new ForbiddenException({ code: 'VERIFICATION_REQUIRED', ...pending });
    }

    await this.checkOtpRateLimit(user!.id, OtpPurpose.LOGIN, CommsType.EMAIL);
    await this.sendOtpInternal(user!.id, CommsType.EMAIL, OtpPurpose.LOGIN, email);
    await this.audit(user!.id, user!.clientId, AuditAction.OTP_REQUEST, {
      channel: 'EMAIL', purpose: 'LOGIN',
    });

    return { userId: user!.id, maskedRecipient: maskEmail(email), channel: 'EMAIL' };
  }

  // ═══════════════════════════════════════════════════════
  // 3. DEMANDE OTP PAR SMS
  // ═══════════════════════════════════════════════════════

  async requestOtpPhone(
    dto: RequestOtpPhoneDto,
    tenantCode?: string | null,
  ): Promise<OtpRequestResult> {
    const phone      = normalizePhoneE164(dto.phone); // ✅ v2.2
    const normalized = normalizeTenantCode(tenantCode);

    if (!phone) throw new BadRequestException('Numéro de téléphone invalide');

    const user = await this.prisma.user.findFirst({
      where:   { phone },
      include: { client: true },
    });

    this.assertUserExists(user, 'Aucun compte associé à ce numéro');
    this.assertNotDeleted(user!);
    this.assertAccountActive(user!);
    this.assertClientActive(user!);
    this.assertNotLocked(user!);
    this.assertPortalIsolation(user!, normalized);

    const pending = this.buildVerificationNeeded(user!);
    if (pending) {
      await this.dispatchVerificationOtps(user!);
      throw new ForbiddenException({ code: 'VERIFICATION_REQUIRED', ...pending });
    }

    await this.checkOtpRateLimit(user!.id, OtpPurpose.LOGIN, CommsType.SMS);
    await this.sendOtpInternal(user!.id, CommsType.SMS, OtpPurpose.LOGIN, phone);
    await this.audit(user!.id, user!.clientId, AuditAction.OTP_REQUEST, {
      channel: 'SMS', purpose: 'LOGIN',
    });

    return { userId: user!.id, maskedRecipient: maskPhone(phone), channel: 'SMS' };
  }

  // ═══════════════════════════════════════════════════════
  // 4. VÉRIFICATION OTP (connexion)
  // ═══════════════════════════════════════════════════════

  async verifyOtpLogin(dto: VerifyOtpLoginV2Dto): Promise<LoginResult> {
    const channel = dto.channel === 'EMAIL' ? CommsType.EMAIL : CommsType.SMS;

    const otpLog = await this.prisma.otpLog.findFirst({
      where: {
        userId:    dto.userId,
        purpose:   OtpPurpose.LOGIN,
        channel,
        isUsed:    false,
        isExpired: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpLog) {
      throw new BadRequestException(
        'Code OTP invalide ou expiré. Demandez un nouveau code.',
      );
    }

    if (otpLog.attempts >= OTP_MAX_ATTEMPTS) {
      await this.prisma.otpLog.update({
        where: { id: otpLog.id },
        data:  { isExpired: true },
      });
      throw new HttpException(
        'Trop de tentatives incorrectes. Demandez un nouveau code.',
        429,
      );
    }

    if (otpLog.code !== dto.code) {
      await this.prisma.otpLog.update({
        where: { id: otpLog.id },
        data:  { attempts: { increment: 1 } },
      });
      const remaining = OTP_MAX_ATTEMPTS - otpLog.attempts - 1;
      throw new UnauthorizedException(
        remaining > 0
          ? `Code incorrect — ${remaining} tentative(s) restante(s).`
          : 'Code incorrect — aucune tentative restante. Demandez un nouveau code.',
      );
    }

    await this.prisma.otpLog.update({
      where: { id: otpLog.id },
      data:  { isUsed: true, usedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where:   { id: dto.userId },
      include: { client: true, agency: true, wallets: { where: { isActive: true } } },
    });

    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const pending = this.buildVerificationNeeded(user);
    if (pending) {
      throw new ForbiddenException({ code: 'VERIFICATION_REQUIRED', ...pending });
    }

    if (dto.trustDevice && dto.deviceId) {
      await this.prisma.userDevice.updateMany({
        where: { userId: user.id, deviceId: dto.deviceId },
        data:  { status: DeviceStatus.TRUSTED, trustedAt: new Date() },
      }).catch(() => {});
    }

    await this.markLastLogin(user.id);
    await this.audit(
      user.id,
      user.clientId,
      dto.channel === 'SMS' ? AuditAction.LOGIN_PHONE : AuditAction.LOGIN,
    );

    return this.buildLoginResponse(user);
  }

  // ═══════════════════════════════════════════════════════
  // 5. ENVOI OTP DE VÉRIFICATION (après inscription)
  // ✅ v2.1 : IDEMPOTENT — réutilise OTP récent < 9 min
  // ═══════════════════════════════════════════════════════

  async sendVerificationOtp(
    dto: SendVerificationOtpDto,
  ): Promise<{ success: true; maskedRecipient: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (dto.channel === 'EMAIL' && user.isEmailVerified) {
      throw new BadRequestException('Adresse email déjà vérifiée.');
    }
    if (dto.channel === 'PHONE' && user.isPhoneVerified) {
      throw new BadRequestException('Numéro de téléphone déjà vérifié.');
    }

    const channel   = dto.channel === 'EMAIL' ? CommsType.EMAIL : CommsType.SMS;
    const purpose   = dto.channel === 'EMAIL'
      ? OtpPurpose.EMAIL_VERIFICATION
      : OtpPurpose.PHONE_VERIFICATION;
    const recipient = dto.channel === 'EMAIL' ? user.email : user.phone;

    if (!recipient) {
      throw new BadRequestException(
        dto.channel === 'PHONE'
          ? 'Aucun numéro de téléphone associé à ce compte.'
          : 'Aucun email associé à ce compte.',
      );
    }

    // ✅ v2.1 : Si un OTP valide < 9 min existe déjà, on le réutilise.
    // Cas d'usage : inscription (v1 register crée l'OTP) → verify-contact
    // auto-send (v2) → on retourne success sans nouveau code.
    // L'utilisateur peut utiliser le code qu'il a reçu à l'inscription.
    const recentCutoff = new Date(Date.now() - OTP_RECENT_WINDOW_MS);
    const recentOtp = await this.prisma.otpLog.findFirst({
      where: {
        userId:    user.id,
        purpose,
        channel,
        isUsed:    false,
        isExpired: false,
        expiresAt: { gte: new Date() },
        createdAt: { gte: recentCutoff },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentOtp) {
      this.logger.log(
        `[sendVerification] OTP ${purpose}/${channel} récent réutilisé ` +
        `pour ${user.id} (créé il y a < 9 min)`,
      );
      return {
        success:         true,
        maskedRecipient: dto.channel === 'EMAIL'
          ? maskEmail(recipient)
          : maskPhone(recipient),
      };
    }

    // Aucun OTP récent → vérifier le rate limit et envoyer
    await this.checkOtpRateLimit(user.id, purpose, channel);
    await this.sendOtpInternal(user.id, channel, purpose, recipient);

    return {
      success:         true,
      maskedRecipient: dto.channel === 'EMAIL'
        ? maskEmail(recipient)
        : maskPhone(recipient),
    };
  }

  // ═══════════════════════════════════════════════════════
  // 6. VÉRIFICATION CONTACT (email ou téléphone)
  // ═══════════════════════════════════════════════════════

  async verifyContact(dto: VerifyContactDto): Promise<VerifyContactResult> {
    const channel = dto.channel === 'EMAIL' ? CommsType.EMAIL : CommsType.SMS;
    const purpose = dto.channel === 'EMAIL'
      ? OtpPurpose.EMAIL_VERIFICATION
      : OtpPurpose.PHONE_VERIFICATION;

    const otpLog = await this.prisma.otpLog.findFirst({
      where: {
        userId:    dto.userId,
        purpose,
        channel,
        isUsed:    false,
        isExpired: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpLog) {
      throw new BadRequestException(
        'Code invalide ou expiré. Demandez un nouveau code.',
      );
    }

    if (otpLog.attempts >= OTP_MAX_ATTEMPTS) {
      await this.prisma.otpLog.update({
        where: { id: otpLog.id },
        data:  { isExpired: true },
      });
      throw new HttpException(
        'Trop de tentatives incorrectes. Demandez un nouveau code.',
        429,
      );
    }

    if (otpLog.code !== dto.code) {
      await this.prisma.otpLog.update({
        where: { id: otpLog.id },
        data:  { attempts: { increment: 1 } },
      });
      const remaining = OTP_MAX_ATTEMPTS - otpLog.attempts - 1;
      throw new UnauthorizedException(
        remaining > 0
          ? `Code incorrect — ${remaining} tentative(s) restante(s).`
          : 'Code incorrect — demandez un nouveau code.',
      );
    }

    await this.prisma.otpLog.update({
      where: { id: otpLog.id },
      data:  { isUsed: true, usedAt: new Date() },
    });

    const updateData: Record<string, boolean> = {};
    if (dto.channel === 'EMAIL') updateData.isEmailVerified = true;
    if (dto.channel === 'PHONE') updateData.isPhoneVerified = true;

    const updated = await this.prisma.user.update({
      where: { id: dto.userId },
      data:  updateData,
    });

    await this.audit(updated.id, updated.clientId, AuditAction.OTP_VERIFY, {
      channel: dto.channel,
    });

    // ✅ v2.3 — FIX : même bascule DEV/PROD que buildVerificationNeeded()
    // (plus bas dans ce fichier). Avant, allVerified exigeait TOUJOURS
    // isPhoneVerified dès que le compte avait un téléphone, alors que
    // verify-contact.tsx (mobile) ne propose jamais cette étape en DEV.
    // Tout compte avec téléphone (quasi tous, l'inscription en exige un)
    // recevait donc allVerified=false en boucle après avoir vérifié son
    // email, sans qu'aucune étape supplémentaire ne soit jamais proposée
    // côté UI → écran bloqué indéfiniment. Voir verify-contact.tsx v1.4.
    // ── DEV : vérification téléphone commentée — décommenter pour la prod ──
    // const hasPhone    = !!updated.phone;
    // const allVerified = updated.isEmailVerified && (!hasPhone || updated.isPhoneVerified);
    const allVerified = updated.isEmailVerified; // DEV bypass — synchronisé avec buildVerificationNeeded()

    return {
      success:       true,
      emailVerified: updated.isEmailVerified,
      phoneVerified: updated.isPhoneVerified,
      hasPhone:      !!updated.phone,
      allVerified,
    };
  }

  // ═══════════════════════════════════════════════════════
  // 7. STATUT DE VÉRIFICATION
  // ═══════════════════════════════════════════════════════

  async getVerificationStatus(userId: string): Promise<VerificationStatus> {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: {
        id: true, email: true, phone: true,
        isEmailVerified: true, isPhoneVerified: true,
      },
    });

    if (!user) throw new NotFoundException('Utilisateur introuvable');

    // ✅ v2.3 — même bascule DEV/PROD que buildVerificationNeeded() et
    // verifyContact() ci-dessus, pour rester cohérent partout où
    // allVerified est calculé dans ce fichier.
    // ── DEV : vérification téléphone commentée — décommenter pour la prod ──
    // const allVerified = user.isEmailVerified && (!user.phone || user.isPhoneVerified);
    const allVerified = user.isEmailVerified; // DEV bypass

    return {
      emailVerified: user.isEmailVerified,
      phoneVerified: user.isPhoneVerified,
      hasPhone:      !!user.phone,
      maskedEmail:   maskEmail(user.email),
      maskedPhone:   user.phone ? maskPhone(user.phone) : null,
      allVerified,
    };
  }

  // ═══════════════════════════════════════════════════════
  // PRIVÉS — Assertions de sécurité
  // ═══════════════════════════════════════════════════════

  private assertUserExists(user: unknown, message = 'Identifiants incorrects'): void {
    if (!user) throw new UnauthorizedException(message);
  }

  private assertNotDeleted(user: any): void {
    if (user.deletedAt) throw new UnauthorizedException('Compte introuvable');
  }

  private assertAccountActive(user: any): void {
    if (!user.isActive || user.isSuspended) {
      const reason = user.suspendedReason ?? 'Contactez le support.';
      throw new UnauthorizedException(`Compte désactivé. ${reason}`);
    }
  }

  private assertClientActive(user: any): void {
    if (user.client && !user.client.isActive) {
      throw new UnauthorizedException('Cette plateforme est actuellement inactive.');
    }
  }

  private assertNotLocked(user: any): void {
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const minutesLeft = Math.ceil(
        (new Date(user.lockedUntil).getTime() - Date.now()) / 60_000,
      );
      throw new UnauthorizedException(
        `Compte temporairement verrouillé. Réessayez dans ${minutesLeft} minute(s).`,
      );
    }
  }

  private assertPortalIsolation(user: any, tenantCode: string | null): void {
    const isDefaultPortal = !tenantCode || tenantCode === 'DONIKO';

    if (isDefaultPortal && user.role !== Role.SUPER_ADMIN) {
      throw new HttpException(
        {
          statusCode:   403,
          code:         'USE_COMPANY_PORTAL',
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
          statusCode: 403,
          code:       'USE_DEFAULT_PORTAL',
          message:    `Le Super Admin doit se connecter via le portail principal.`,
        },
        403,
      );
    }
  }

  // ═══════════════════════════════════════════════════════
  // PRIVÉS — Logique vérification
  // ═══════════════════════════════════════════════════════

  private buildVerificationNeeded(user: any): VerificationNeededResult | null {
    const emailOk  = user.isEmailVerified;
    // ── DEV : vérification téléphone commentée — décommenter pour la prod ──
    // const hasPhone = !!user.phone;
    // const phoneOk  = !hasPhone || user.isPhoneVerified;
    const hasPhone = false; // DEV bypass
    const phoneOk  = true;  // DEV bypass

    if (emailOk && phoneOk) return null;

    return {
      requiresVerification: true,
      userId:               user.id,
      emailVerified:        emailOk,
      phoneVerified:        user.isPhoneVerified,
      hasPhone,
      message: !emailOk
        ? 'Vérifiez votre adresse email avant de vous connecter.'
        : 'Vérifiez votre numéro de téléphone avant de vous connecter.',
    };
  }

  /**
   * ✅ v2.1 : Guard anti-accumulation
   * Avant d'envoyer un OTP, vérifie si un OTP valide < 9 min existe déjà.
   * Évite d'épuiser le rate limit en 3 tentatives de connexion bloquées.
   */
  private async dispatchVerificationOtps(user: any): Promise<void> {
    const tasks: Promise<void>[] = [];
    const recentCutoff = new Date(Date.now() - OTP_RECENT_WINDOW_MS);

    if (!user.isEmailVerified && user.email) {
      const hasRecent = await this.prisma.otpLog.count({
        where: {
          userId:    user.id,
          purpose:   OtpPurpose.EMAIL_VERIFICATION,
          channel:   CommsType.EMAIL,
          isUsed:    false,
          isExpired: false,
          expiresAt: { gte: new Date() },
          createdAt: { gte: recentCutoff },
        },
      });

      if (!hasRecent) {
        tasks.push(
          this.sendOtpInternal(
            user.id, CommsType.EMAIL, OtpPurpose.EMAIL_VERIFICATION, user.email,
          ).catch((e) => {
            this.logger.warn(`[dispatch] email OTP failed: ${e?.message}`);
          }),
        );
      } else {
        this.logger.log(
          `[dispatch] OTP EMAIL_VERIFICATION récent trouvé pour ${user.id} — renvoi ignoré`,
        );
      }
    }

    // ── DEV : dispatch SMS commenté — décommenter pour la prod ──
    // if (user.phone && !user.isPhoneVerified) {
    //   const hasRecent = await this.prisma.otpLog.count({ ... });
    //   if (!hasRecent) {
    //     tasks.push(
    //       this.sendOtpInternal(
    //         user.id, CommsType.SMS, OtpPurpose.PHONE_VERIFICATION, user.phone,
    //       ).catch((e) => {
    //         this.logger.warn(`[dispatch] SMS OTP failed: ${e?.message}`);
    //       }),
    //     );
    //   }
    // }

    await Promise.allSettled(tasks);
  }

  // ═══════════════════════════════════════════════════════
  // PRIVÉS — Sécurité OTP
  // ═══════════════════════════════════════════════════════

  private async checkOtpRateLimit(
    userId:  string,
    purpose: OtpPurpose,
    channel: CommsType,
  ): Promise<void> {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const count = await this.prisma.otpLog.count({
      where: { userId, purpose, channel, createdAt: { gte: since } },
    });
    if (count >= OTP_MAX_SENDS_PER_HOUR) {
      throw new HttpException(
        `Trop de codes envoyés. Réessayez dans 1 heure.`,
        429,
      );
    }
  }

  private async handleFailedLogin(user: any): Promise<void> {
    const newCount   = (user.failedLoginAttempts ?? 0) + 1;
    const shouldLock = newCount >= MAX_FAILED_LOGINS;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: { increment: 1 },
        lastFailedLoginAt:   new Date(),
        ...(shouldLock && {
          lockedUntil: new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000),
        }),
      },
    });

    if (shouldLock) {
      await this.audit(user.id, user.clientId, AuditAction.ACCOUNT_LOCKED, {
        reason: 'max_failed_logins', attempts: newCount,
      });
      throw new UnauthorizedException(
        `Compte verrouillé ${LOCK_DURATION_MINUTES} min après ${MAX_FAILED_LOGINS} tentatives échouées.`,
      );
    }
  }

  private async sendOtpInternal(
    userId:    string,
    channel:   CommsType,
    purpose:   OtpPurpose,
    recipient: string,
  ): Promise<void> {
    const code      = generateOtp(OTP_LENGTH);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.otpLog.updateMany({
      where: { userId, purpose, channel, isUsed: false, isExpired: false },
      data:  { isExpired: true },
    });

    await this.prisma.otpLog.create({
      data: { userId, code, purpose, channel, recipient, expiresAt },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        otpCode: code, otpExpiresAt: expiresAt,
        otpPurpose: purpose, otpChannel: channel,
      },
    }).catch(() => {});

    // ── Envoi EMAIL ───────────────────────────────────────
    if (channel === CommsType.EMAIL) {
      const isLogin        = purpose === OtpPurpose.LOGIN;
      const isVerification = purpose === OtpPurpose.EMAIL_VERIFICATION;

      const subject    = isLogin ? 'Votre code de connexion'
        : isVerification ? 'Vérifiez votre adresse email'
        : 'Votre code de vérification';

      const actionLabel = isLogin ? 'votre connexion'
        : isVerification ? 'la vérification de votre email'
        : 'votre demande';

      await this.mail.sendEmail(
        recipient,
        subject,
        `<div style="font-family:sans-serif;max-width:500px;margin:auto;padding:20px;">
          <h2 style="color:#059669;margin-bottom:8px;">Direct Transf'air</h2>
          <p>Votre code pour ${actionLabel} :</p>
          <div style="font-size:40px;font-weight:900;letter-spacing:10px;color:#059669;
                      background:#ECFDF5;text-align:center;padding:24px;
                      border-radius:12px;margin:20px 0;font-family:monospace;">
            ${code}
          </div>
          <p style="color:#6B7280;font-size:13px;">
            Ce code expire dans <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.
            Ne le partagez jamais, même avec le support.
          </p>
          <p style="color:#9CA3AF;font-size:11px;margin-top:16px;">
            Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.
          </p>
        </div>`,
      ).catch((e: Error) => {
        this.logger.error(`[OTP EMAIL] Échec envoi ${recipient}: ${e?.message}`);
      });
    }

    // ── Envoi SMS ─────────────────────────────────────────
    if (channel === CommsType.SMS) {
      // TODO: Remplacer le stub par l'appel SmsService réel
      // await this.smsService.sendOtp(recipient, code, userId);
      this.logger.log(`[SMS-STUB] → ${recipient} : Code ${code}`);
    }

    await this.audit(userId, null, AuditAction.OTP_REQUEST, { purpose, channel });
  }

  // ═══════════════════════════════════════════════════════
  // PRIVÉS — Session & JWT
  // ═══════════════════════════════════════════════════════

  private async buildLoginResponse(user: any): Promise<LoginResult> {
    const payload = {
      sub:      user.id,
      email:    user.email,
      role:     user.role,
      clientId: user.clientId,
    };

    const accessToken  = this.jwt.sign(payload, { expiresIn: ACCESS_TOKEN_TTL });
    const refreshToken = generateRefreshToken();
    const expiresAt    = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

    try {
      await this.prisma.userSession.create({
        data: {
          userId:                user.id,
          token:                 accessToken,
          refreshToken,
          refreshTokenExpiresAt: expiresAt,
          expiresAt,
          status:                'ACTIVE',
        },
      });
    } catch (e) {
      this.logger.warn('[buildLoginResponse] session create error', e);
    }

    return {
      access_token:  accessToken,
      refresh_token: refreshToken,
      user:          this.toPublicUser(user),
    };
  }

  private toPublicUser(user: any): Record<string, unknown> {
    return {
      id:              user.id,
      email:           user.email,
      phone:           user.phone,
      role:            user.role,
      clientId:        user.clientId,
      firstName:       user.firstName,
      lastName:        user.lastName,
      agencyId:        user.agencyId,
      primaryCurrency: user.primaryCurrency,
      kycLevel:        user.kycLevel,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      mfaEnabled:      user.mfaEnabled,
      country:         user.country,
      city:            user.city,
      client:          user.client,
      agency:          user.agency,
      wallets:         user.wallets ?? [],
    };
  }

  private async markLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data:  { lastLoginAt: new Date() },
    }).catch(() => {});
  }

  private async audit(
    userId:   string,
    clientId: number | null,
    action:   AuditAction,
    details?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId, clientId, action,
          details: (details ?? undefined) as any,
          successful: true,
        },
      });
    } catch {}
  }
}