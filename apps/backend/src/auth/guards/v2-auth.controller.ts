// apps/backend/src/auth/v2-auth.controller.ts
// =========================================================
// AUTH CONTROLLER v2 — Routes sécurité renforcée
// Préfixe : /auth/v2
// Toutes les routes sont PUBLIC (pas de JWT requis à l'entrée)
// Le service gère lui-même l'isolation et les vérifications.
// =========================================================

import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../common/decorators/public.decorator';
import { V2AuthService } from './v2-auth.service';
import {
  LoginPasswordV2Dto,
  RequestOtpEmailDto,
  RequestOtpPhoneDto,
  SendVerificationOtpDto,
  VerifyContactDto,
  VerifyOtpLoginV2Dto,
} from './dto/v2-auth.dto';

@Controller('auth/v2')
@ApiTags('Auth V2 — Sécurité renforcée')
export class V2AuthController {
  constructor(private readonly v2Auth: V2AuthService) {}

  // ── 1. Connexion mot de passe ─────────────────────────
  @Public()
  @Post('login-password')
  @ApiOperation({
    summary: 'Connexion email + mot de passe',
    description:
      'Vérifie les identifiants, applique le gate de vérification, ' +
      'retourne un JWT ou { requiresVerification: true }.',
  })
  loginPassword(
    @Body() dto: LoginPasswordV2Dto,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    return this.v2Auth.loginWithPassword(dto, tenantId ?? null);
  }

  // ── 2. Demande OTP par email ──────────────────────────
  @Public()
  @Post('request-otp-email')
  @ApiOperation({
    summary: 'Envoie un OTP à 6 chiffres par email pour connexion',
    description: 'Rate limit : 3 envois / heure. Retourne { userId, maskedRecipient }.',
  })
  requestOtpEmail(
    @Body() dto: RequestOtpEmailDto,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    return this.v2Auth.requestOtpEmail(dto, tenantId ?? null);
  }

  // ── 3. Demande OTP par SMS ────────────────────────────
  @Public()
  @Post('request-otp-phone')
  @ApiOperation({
    summary: 'Envoie un OTP à 6 chiffres par SMS pour connexion',
    description: 'Rate limit : 3 envois / heure. Retourne { userId, maskedRecipient }.',
  })
  requestOtpPhone(
    @Body() dto: RequestOtpPhoneDto,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    return this.v2Auth.requestOtpPhone(dto, tenantId ?? null);
  }

  // ── 4. Vérification OTP → JWT ─────────────────────────
  @Public()
  @Post('verify-otp-login')
  @ApiOperation({
    summary: 'Vérifie le code OTP (email ou SMS) et retourne le JWT',
    description:
      'Max 5 tentatives par code. Expiration automatique après dépassement.',
  })
  verifyOtpLogin(@Body() dto: VerifyOtpLoginV2Dto) {
    return this.v2Auth.verifyOtpLogin(dto);
  }

  // ── 5. Envoi OTP de vérification (post-inscription) ──
  @Public()
  @Post('send-verification')
  @ApiOperation({
    summary: "Envoie un OTP pour vérifier l'email ou le téléphone",
    description:
      "Appelé depuis l'écran de vérification. Rate limit : 3 envois / heure.",
  })
  sendVerification(@Body() dto: SendVerificationOtpDto) {
    return this.v2Auth.sendVerificationOtp(dto);
  }

  // ── 6. Vérification contact ───────────────────────────
  @Public()
  @Post('verify-contact')
  @ApiOperation({
    summary: "Valide le code OTP et marque l'email ou le téléphone comme vérifié",
    description:
      "Retourne { allVerified } — si true, l'utilisateur peut se connecter.",
  })
  verifyContact(@Body() dto: VerifyContactDto) {
    return this.v2Auth.verifyContact(dto);
  }

  // ── 7. Statut de vérification ─────────────────────────
  @Public()
  @Get('verification-status/:userId')
  @ApiOperation({
    summary: "Retourne l'état de vérification email + téléphone d'un utilisateur",
  })
  getVerificationStatus(@Param('userId') userId: string) {
    return this.v2Auth.getVerificationStatus(userId);
  }
}