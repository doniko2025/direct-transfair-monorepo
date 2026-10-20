// apps/backend/src/auth/auth.controller.ts
// =========================================================
// AUTH CONTROLLER v4.4
// ✅ v4.4 : SÉCURITÉ — limitation de débit (par IP) sur TOUTES les routes publiques v1, comme déjà fait sur la v2 :
//   register 10/min, login 5/min, login/verify-otp 10/min, login-by-phone et send-otp 10/h (coût SMS/e-mail),
//   find-account 10/min, verify-otp 10/min, reset-password 5/min. Avant, elles n'étaient limitées qu'à 100 req/min
//   (force brute du mot de passe et du code OTP possible). `refresh` reste au régime général.
// ✅ v4.3 (phase 6, passe 2) : POST /auth/devices — un jeton push appartient à UN seul compte. Avant, si deux comptes
//   se connectaient sur le même téléphone, l'ancien gardait le jeton : ses notifications (montants, codes de retrait)
//   continuaient d'arriver sur un appareil utilisé par quelqu'un d'autre. Le jeton est maintenant retiré aux autres
//   comptes à l'enregistrement. Plateforme et longueurs des champs contrôlées (avant : erreur 500 sur une valeur inconnue).
// ✅ v4.1 conservé intégralement
// ✅ v4.2 : POST /auth/login-by-phone
//   → connexion sans mot de passe par numéro de téléphone
//   → délègue à authService.loginByPhone()
//   → retourne { userId, maskedPhone }
//   → la vérification OTP reste sur POST /auth/login/verify-otp
// =========================================================

import {
  Body,
  Controller,
  Post,
  Req,
  BadRequestException,
  Get,
  Patch,
  Delete,
  UseGuards,
  Headers,
  Param,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { DevicePlatform } from '@prisma/client';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, VerifyLoginOtpDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthUserPayload } from './types/auth-user-payload.type';
import { Public } from '../common/decorators/public.decorator';
import { APP_CLIENT_HEADER } from './app-client.policy';
import { PrismaService } from '../prisma/prisma.service';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  // ========================================================
  // INSCRIPTION
  // ========================================================

  @Public()
  @Post('register')
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Inscription — crée le compte + wallet selon le pays de résidence',
  })
  async register(
    @Body() dto: RegisterDto,
    @Headers('x-tenant-id') tenantId: string | undefined,
  ) {
    return this.authService.register(dto, tenantId ?? null);
  }

  // ========================================================
  // CONNEXION (étape 1) — Email / Mot de passe
  // ✅ v4.1 : lit x-tenant-id et le passe au service
  // ========================================================

  @Public()
  @Post('login')
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Connexion avec isolation tenant. ' +
      'Si LOGIN_OTP_REQUIRED=true, retourne {step:OTP_REQUIRED}. Sinon JWT direct.',
  })
  async login(
    @Body() dto: LoginDto,
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers(APP_CLIENT_HEADER) appClient: string | undefined,
  ) {
    return this.authService.login(dto, tenantId ?? null, appClient ?? null);
  }

  // ========================================================
  // CONNEXION PAR TÉLÉPHONE — ✅ v4.2
  // Sans mot de passe : envoie un OTP à 4 chiffres par SMS.
  // La vérification se fait ensuite via POST /auth/login/verify-otp.
  // ========================================================

  @Public()
  @Post('login-by-phone')
  @Throttle({ otp: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({
    summary:
      'Connexion sans mot de passe — envoie un OTP à 4 chiffres par SMS. ' +
      'Retourne { userId, maskedPhone }. ' +
      'Vérifier le code sur POST /auth/login/verify-otp.',
  })
  async loginByPhone(
    @Body() body: { phone: string },
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers(APP_CLIENT_HEADER) appClient: string | undefined,
  ) {
    if (!body.phone?.trim()) {
      throw new BadRequestException('Numéro de téléphone requis');
    }
    return this.authService.loginByPhone(
      body.phone.trim(),
      tenantId ?? null,
      appClient ?? null,
    );
  }

  // ========================================================
  // CONNEXION — Étape 2 : Vérification OTP → JWT
  // Utilisée par : login email OTP + loginByPhone
  // ========================================================

  @Public()
  @Post('login/verify-otp')
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Étape 2 du login : vérifie l'OTP et retourne le JWT" })
  async verifyLoginOtp(
    @Body() dto: VerifyLoginOtpDto,
    @Headers(APP_CLIENT_HEADER) appClient: string | undefined,
  ) {
    return this.authService.verifyLoginOtp(dto, appClient ?? null);
  }

  // ========================================================
  // REFRESH TOKEN
  // ========================================================

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: "Renouveler le JWT à partir d'un refresh token" })
  async refresh(
    @Body() body: { refresh_token: string },
    @Headers(APP_CLIENT_HEADER) appClient: string | undefined,
  ) {
    if (!body.refresh_token)
      throw new BadRequestException('refresh_token requis');
    return this.authService.refreshTokens(body.refresh_token, appClient ?? null);
  }

  // ========================================================
  // LOGOUT
  // ========================================================

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async logout(@Req() req: Request & { user?: AuthUserPayload }) {
    if (!req.user) throw new BadRequestException('User not found');
    const accessToken = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    return this.authService.logout(req.user.id, accessToken);
  }

  // ========================================================
  // FIND ACCOUNT — Récupération mot de passe
  // ========================================================

  @Public()
  @Post('find-account')
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  async findAccount(@Body('identifier') identifier: string) {
    if (!identifier) throw new BadRequestException('Identifiant requis');
    return this.authService.findAccount(identifier);
  }

  @Public()
  @Post('send-otp')
  @Throttle({ otp: { limit: 10, ttl: 3_600_000 } })
  async sendOtp(
    @Body() body: { userId: string; channel: 'EMAIL' | 'PHONE'; purpose?: string },
  ) {
    if (!body.userId || !body.channel)
      throw new BadRequestException('Données incomplètes');
    return this.authService.sendOtp(body.userId, body.channel, body.purpose);
  }

  @Public()
  @Post('verify-otp')
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  async verifyOtp(
    @Body() body: { userId: string; code: string; type?: string },
  ) {
    if (!body.userId || !body.code)
      throw new BadRequestException('Données incomplètes');
    return this.authService.verifyOtp(body.userId, body.code, body.type);
  }

  @Public()
  @Post('reset-password')
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  async resetPassword(
    @Body() body: { userId: string; code: string; newPassword: string },
  ) {
    if (!body.userId || !body.code || !body.newPassword) {
      throw new BadRequestException('Données incomplètes');
    }
    return this.authService.resetPassword(
      body.userId,
      body.code,
      body.newPassword,
    );
  }

  // ========================================================
  // PROFIL — Routes protégées
  // ========================================================

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async me(@Req() req: Request & { user?: AuthUserPayload }) {
    if (!req.user) throw new BadRequestException('User not found');
    return this.authService.getProfile(req.user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async updateMe(
    @Req() req: Request & { user?: AuthUserPayload },
    @Body() body: unknown,
  ) {
    if (!req.user) throw new BadRequestException('User not found');
    return this.authService.updateProfile(req.user.id, body);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async changePassword(
    @Req() req: Request & { user?: AuthUserPayload },
    @Body() body: { oldPass: string; newPass: string },
  ) {
    if (!req.user) throw new BadRequestException('Utilisateur non trouvé');
    if (!body.oldPass || !body.newPass)
      throw new BadRequestException('Champs manquants');

    return this.authService.changePassword(
      req.user.id,
      body.oldPass,
      body.newPass,
    );
  }

  // ========================================================
  // DEVICES (Push FCM/APNS)
  // ========================================================

  @Post('devices')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async registerDevice(
    @Req() req: Request & { user?: AuthUserPayload },
    @Body()
    body: {
      deviceId: string;
      platform: 'IOS' | 'ANDROID' | 'WEB' | 'DESKTOP';
      pushToken?: string;
      deviceName?: string;
      deviceModel?: string;
      osVersion?: string;
      appVersion?: string;
    },
  ) {
    if (!req.user) throw new BadRequestException('User not found');
    if (!body.deviceId || !body.platform)
      throw new BadRequestException('deviceId et platform requis');
    if (!['IOS', 'ANDROID', 'WEB', 'DESKTOP'].includes(String(body.platform))) {
      throw new BadRequestException('platform inconnue (IOS, ANDROID, WEB ou DESKTOP)');
    }
    const tooLong = (v: unknown, max: number) => typeof v === 'string' && v.length > max;
    if (
      typeof body.deviceId !== 'string' || tooLong(body.deviceId, 200) ||
      (body.pushToken !== undefined && (typeof body.pushToken !== 'string' || tooLong(body.pushToken, 500))) ||
      tooLong(body.deviceName, 200) || tooLong(body.deviceModel, 200) ||
      tooLong(body.osVersion, 100) || tooLong(body.appVersion, 100)
    ) {
      throw new BadRequestException('Champ appareil invalide ou trop long.');
    }

    // Un jeton push = un seul compte : on le retire aux autres comptes qui l'auraient encore.
    if (body.pushToken) {
      await this.prisma.userDevice.updateMany({
        where: { pushToken: body.pushToken, userId: { not: req.user.id } },
        data:  { pushToken: null, pushEnabled: false },
      });
    }

    const device = await this.prisma.userDevice.upsert({
      where: {
        userId_deviceId: {
          userId: req.user.id,
          deviceId: body.deviceId,
        },
      },
      update: {
        pushToken: body.pushToken,
        deviceName: body.deviceName,
        deviceModel: body.deviceModel,
        osVersion: body.osVersion,
        appVersion: body.appVersion,
        lastUsedAt: new Date(),
      },
      create: {
        userId: req.user.id,
        deviceId: body.deviceId,
        platform: body.platform as DevicePlatform,
        pushToken: body.pushToken,
        deviceName: body.deviceName,
        deviceModel: body.deviceModel,
        osVersion: body.osVersion,
        appVersion: body.appVersion,
        status: 'PENDING',
        pushEnabled: !!body.pushToken,
      },
    });

    return device;
  }

  @Get('devices')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async getDevices(@Req() req: Request & { user?: AuthUserPayload }) {
    if (!req.user) throw new BadRequestException('User not found');
    return this.prisma.userDevice.findMany({
      where: { userId: req.user.id },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  @Delete('devices/:deviceId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async revokeDevice(
    @Req() req: Request & { user?: AuthUserPayload },
    @Param('deviceId') deviceId: string,
  ) {
    if (!req.user) throw new BadRequestException('User not found');
    await this.prisma.userDevice.updateMany({
      where: { userId: req.user.id, deviceId },
      data: { status: 'REVOKED', revokedAt: new Date(), pushEnabled: false },
    });
    return { success: true };
  }

  // ========================================================
  // SESSIONS
  // ========================================================

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async getSessions(@Req() req: Request & { user?: AuthUserPayload }) {
    if (!req.user) throw new BadRequestException('User not found');
    return this.prisma.userSession.findMany({
      where: { userId: req.user.id, status: 'ACTIVE' },
      select: {
        id: true,
        device: true,
        ipAddress: true,
        userAgent: true,
        country: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async revokeSession(
    @Req() req: Request & { user?: AuthUserPayload },
    @Param('id') id: string,
  ) {
    if (!req.user) throw new BadRequestException('User not found');
    await this.prisma.userSession.updateMany({
      where: { id, userId: req.user.id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    return { success: true };
  }
}