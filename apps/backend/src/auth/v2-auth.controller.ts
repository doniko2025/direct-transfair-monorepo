// apps/backend/src/auth/v2-auth.controller.ts
// =========================================================
// V2 AUTH CONTROLLER v1.3
// ✅ v1.2 : DTOs complets passés au service
// ✅ v1.3 : FIX CRITIQUE — x-tenant-id transmis au service
//   PROBLÈME : le header x-tenant-id n'était pas lu par le
//   controller → tenantCode=undefined dans le service →
//   assertPortalIsolation traitait tout comme portail DONIKO
//   → USE_COMPANY_PORTAL pour tous les users société.
//   CORRECTIF : @Headers('x-tenant-id') ajouté sur les 3
//   endpoints de connexion et passé en 2e paramètre au service.
// =========================================================

import {
  Body, Controller, Get, Headers, Param, Post,
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

  // ✅ v1.3 : tenantId lu et transmis au service
  @Post('login-password')
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Connexion par email + mot de passe (v2)' })
  loginPassword(
    @Body() dto: LoginPasswordV2Dto,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    return this.v2Auth.loginWithPassword(dto, tenantId ?? null);
  }

  // ✅ v1.3 : tenantId transmis
  @Post('request-otp-email')
  @Throttle({ otp: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Demande OTP connexion par email' })
  requestOtpEmail(
    @Body() dto: RequestOtpEmailDto,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    return this.v2Auth.requestOtpEmail(dto, tenantId ?? null);
  }

  // ✅ v1.3 : tenantId transmis
  @Post('request-otp-phone')
  @Throttle({ otp: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Demande OTP connexion par téléphone' })
  requestOtpPhone(
    @Body() dto: RequestOtpPhoneDto,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    return this.v2Auth.requestOtpPhone(dto, tenantId ?? null);
  }

  // verify-otp-login — pas de tenant nécessaire (userId suffit)
  @Post('verify-otp-login')
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Vérification OTP + émission JWT' })
  verifyOtpLogin(@Body() dto: VerifyOtpLoginV2Dto) {
    return this.v2Auth.verifyOtpLogin(dto);
  }

  // send-verification — pas de tenant (userId connu)
  @Post('send-verification')
  @Throttle({ otp: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Envoie un OTP de vérification email ou téléphone' })
  sendVerification(@Body() dto: SendVerificationOtpDto) {
    return this.v2Auth.sendVerificationOtp(dto);
  }

  // verify-contact — pas de tenant (userId connu)
  @Post('verify-contact')
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Vérifie le code et marque email/téléphone comme vérifié' })
  verifyContact(@Body() dto: VerifyContactDto) {
    return this.v2Auth.verifyContact(dto);
  }

  @Get('verification-status/:userId')
  @ApiOperation({ summary: 'Statut de vérification email + téléphone' })
  getVerificationStatus(@Param('userId') userId: string) {
    return this.v2Auth.getVerificationStatus(userId);
  }
}