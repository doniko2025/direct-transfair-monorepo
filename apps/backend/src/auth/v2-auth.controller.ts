// apps/backend/src/auth/v2-auth.controller.ts
// =========================================================
// V2 AUTH CONTROLLER v1.2
// ✅ v1.0 : routes /auth/v2/*
// ✅ v1.1 : @Throttle par endpoint (ThrottlerModule v4.5)
// ✅ v1.2 : FIX TypeScript — toutes les méthodes passent le DTO
//           complet au service (au lieu d'extraire les champs)
//           + @Throttle corrigé pour la syntaxe @nestjs/throttler v5
// =========================================================

import {
  Body, Controller, Get, Param, Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { V2AuthService } from './v2-auth.service';
import { Public }        from '../common/decorators/public.decorator';
import {
  LoginPasswordV2Dto,
  RequestOtpEmailDto,
  RequestOtpPhoneDto,
  VerifyOtpLoginV2Dto,
  SendVerificationOtpDto,
  VerifyContactDto,
} from './dto/v2-auth.dto';

@Public()
@Controller('auth/v2')
@ApiTags('Auth v2')
export class V2AuthController {
  constructor(private readonly v2Auth: V2AuthService) {}

  // ── 5 tentatives/min par IP ──────────────────────────
  @Post('login-password')
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Connexion par email + mot de passe (v2 avec verification gate)' })
  loginPassword(@Body() dto: LoginPasswordV2Dto) {
    return this.v2Auth.loginWithPassword(dto);   // ✅ v1.2 : DTO complet
  }

  // ── 10 envois/heure par IP ───────────────────────────
  @Post('request-otp-email')
  @Throttle({ otp: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Demande OTP connexion par email' })
  requestOtpEmail(@Body() dto: RequestOtpEmailDto) {
    return this.v2Auth.requestOtpEmail(dto);     // ✅ v1.2 : DTO complet
  }

  // ── 10 envois/heure par IP ───────────────────────────
  @Post('request-otp-phone')
  @Throttle({ otp: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Demande OTP connexion par téléphone' })
  requestOtpPhone(@Body() dto: RequestOtpPhoneDto) {
    return this.v2Auth.requestOtpPhone(dto);     // ✅ v1.2 : DTO complet
  }

  // ── 10 tentatives/min par IP ─────────────────────────
  @Post('verify-otp-login')
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Vérification OTP + émission JWT' })
  verifyOtpLogin(@Body() dto: VerifyOtpLoginV2Dto) {
    return this.v2Auth.verifyOtpLogin(dto);      // ✅ v1.2 : DTO complet
  }

  // ── 10 envois/heure par IP ───────────────────────────
  @Post('send-verification')
  @Throttle({ otp: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Envoie un OTP de vérification email ou téléphone' })
  sendVerification(@Body() dto: SendVerificationOtpDto) {
    return this.v2Auth.sendVerificationOtp(dto); // ✅ v1.2 : DTO complet
  }

  // ── 10 tentatives/min par IP ─────────────────────────
  @Post('verify-contact')
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Vérifie le code et marque email/téléphone comme vérifié' })
  verifyContact(@Body() dto: VerifyContactDto) {
    return this.v2Auth.verifyContact(dto);       // ✅ v1.2 : DTO complet
  }

  // ── Statut vérification ──────────────────────────────
  @Get('verification-status/:userId')
  @ApiOperation({ summary: 'Statut de vérification email + téléphone' })
  getVerificationStatus(@Param('userId') userId: string) {
    return this.v2Auth.getVerificationStatus(userId);
  }
}