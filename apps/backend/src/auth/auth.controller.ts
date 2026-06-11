// apps/backend/src/auth/auth.controller.ts
// =========================================================
// AUTH CONTROLLER v4.2
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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { DevicePlatform } from '@prisma/client';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, VerifyLoginOtpDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthUserPayload } from './types/auth-user-payload.type';
import { Public } from '../common/decorators/public.decorator';
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
  @ApiOperation({
    summary:
      'Connexion avec isolation tenant. ' +
      'Si LOGIN_OTP_REQUIRED=true, retourne {step:OTP_REQUIRED}. Sinon JWT direct.',
  })
  async login(
    @Body() dto: LoginDto,
    @Headers('x-tenant-id') tenantId: string | undefined,
  ) {
    return this.authService.login(dto, tenantId ?? null);
  }

  // ========================================================
  // CONNEXION PAR TÉLÉPHONE — ✅ v4.2
  // Sans mot de passe : envoie un OTP à 4 chiffres par SMS.
  // La vérification se fait ensuite via POST /auth/login/verify-otp.
  // ========================================================

  @Public()
  @Post('login-by-phone')
  @ApiOperation({
    summary:
      'Connexion sans mot de passe — envoie un OTP à 4 chiffres par SMS. ' +
      'Retourne { userId, maskedPhone }. ' +
      'Vérifier le code sur POST /auth/login/verify-otp.',
  })
  async loginByPhone(
    @Body() body: { phone: string },
    @Headers('x-tenant-id') tenantId: string | undefined,
  ) {
    if (!body.phone?.trim()) {
      throw new BadRequestException('Numéro de téléphone requis');
    }
    return this.authService.loginByPhone(body.phone.trim(), tenantId ?? null);
  }

  // ========================================================
  // CONNEXION — Étape 2 : Vérification OTP → JWT
  // Utilisée par : login email OTP + loginByPhone
  // ========================================================

  @Public()
  @Post('login/verify-otp')
  @ApiOperation({ summary: "Étape 2 du login : vérifie l'OTP et retourne le JWT" })
  async verifyLoginOtp(@Body() dto: VerifyLoginOtpDto) {
    return this.authService.verifyLoginOtp(dto);
  }

  // ========================================================
  // REFRESH TOKEN
  // ========================================================

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: "Renouveler le JWT à partir d'un refresh token" })
  async refresh(@Body() body: { refresh_token: string }) {
    if (!body.refresh_token)
      throw new BadRequestException('refresh_token requis');
    return this.authService.refreshTokens(body.refresh_token);
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
  async findAccount(@Body('identifier') identifier: string) {
    if (!identifier) throw new BadRequestException('Identifiant requis');
    return this.authService.findAccount(identifier);
  }

  @Public()
  @Post('send-otp')
  async sendOtp(
    @Body() body: { userId: string; channel: 'EMAIL' | 'PHONE'; purpose?: string },
  ) {
    if (!body.userId || !body.channel)
      throw new BadRequestException('Données incomplètes');
    return this.authService.sendOtp(body.userId, body.channel, body.purpose);
  }

  @Public()
  @Post('verify-otp')
  async verifyOtp(
    @Body() body: { userId: string; code: string; type?: string },
  ) {
    if (!body.userId || !body.code)
      throw new BadRequestException('Données incomplètes');
    return this.authService.verifyOtp(body.userId, body.code, body.type);
  }

  @Public()
  @Post('reset-password')
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