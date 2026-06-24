// apps/backend/src/auth/v2-auth.controller.ts
// =========================================================
// V2 AUTH CONTROLLER v1.1
// ✅ v1.0 : routes /auth/v2/*
// ✅ v1.1 : @Throttle par endpoint (ThrottlerModule v4.5)
//   — login-password    : 5 req/min  (throttler 'auth')
//   — request-otp-*     : 10 req/h   (throttler 'otp')
//   — verify-otp-login  : 10 req/min (throttler 'auth' × 2)
//   — send-verification : 10 req/h   (throttler 'otp')
//   — verify-contact    : 10 req/min (throttler 'auth' × 2)
//   — verification-status : défaut   (@SkipThrottle impossible,
//                           mais usage légitime = très rare)
// =========================================================

import {
  Body, Controller, Get, Param, Post, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler'; // ✅ v1.1

import { V2AuthService }          from './v2-auth.service';
import { Public }                 from '../common/decorators/public.decorator';
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

  // ── ✅ 5 tentatives/min par IP — protection brute-force
  @Post('login-password')
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Connexion par email + mot de passe (v2 avec verification gate)' })
  loginPassword(@Body() dto: LoginPasswordV2Dto) {
    return this.v2Auth.loginWithPassword(dto.identifier, dto.password);
  }

  // ── ✅ 10 envois/heure par IP (+ 3/h par user côté service)
  @Post('request-otp-email')
  @Throttle({ otp: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Demande OTP connexion par email' })
  requestOtpEmail(@Body() dto: RequestOtpEmailDto) {
    return this.v2Auth.requestOtpEmail(dto.email);
  }

  // ── ✅ 10 envois/heure par IP
  @Post('request-otp-phone')
  @Throttle({ otp: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Demande OTP connexion par téléphone' })
  requestOtpPhone(@Body() dto: RequestOtpPhoneDto) {
    return this.v2Auth.requestOtpPhone(dto.phone);
  }

  // ── ✅ 10 tentatives/min par IP — empêche le brute-force du code
  @Post('verify-otp-login')
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Vérification OTP + émission JWT' })
  verifyOtpLogin(@Body() dto: VerifyOtpLoginV2Dto) {
    return this.v2Auth.verifyOtpLogin(dto.userId, dto.code, dto.channel);
  }

  // ── ✅ 10 envois/heure par IP (+ 3/h par user côté service)
  @Post('send-verification')
  @Throttle({ otp: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Envoie un OTP de vérification email ou téléphone' })
  sendVerification(@Body() dto: SendVerificationOtpDto) {
    return this.v2Auth.sendVerificationOtp(dto.userId, dto.channel);
  }

  // ── ✅ 10 tentatives/min par IP
  @Post('verify-contact')
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Vérifie le code et marque email/téléphone comme vérifié' })
  verifyContact(@Body() dto: VerifyContactDto) {
    return this.v2Auth.verifyContact(dto.userId, dto.code, dto.channel);
  }

  // ── Consultation statut — peu d'abus attendu, défaut ThrottlerGuard
  @Get('verification-status/:userId')
  @ApiOperation({ summary: 'Statut de vérification email + téléphone' })
  getVerificationStatus(@Param('userId') userId: string) {
    return this.v2Auth.getVerificationStatus(userId);
  }
}