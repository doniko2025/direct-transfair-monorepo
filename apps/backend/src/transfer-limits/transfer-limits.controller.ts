// apps/backend/src/transfer-limits/transfer-limits.controller.ts
// =========================================================
// TRANSFER LIMITS CONTROLLER v1.0 — plafonds d'envoi par niveau KYC et par devise
//   GET    /transfer-limits                              SUPER_ADMIN (?clientId), COMPANY_ADMIN : 4 niveaux × devises
//   GET    /transfer-limits/history                      SUPER_ADMIN (?clientId), COMPANY_ADMIN : journal
//   PUT    /transfer-limits/:level/:currency             COMPANY_ADMIN : { perTransaction, daily, monthly, yearly } (null = sans plafond)
//   DELETE /transfer-limits/:level/:currency             COMPANY_ADMIN : retour aux plafonds par défaut
//   PATCH  /transfer-limits/users/:userId/kyc-level      COMPANY_ADMIN : { kycLevel } d'un de ses clients
//
// Les plafonds sont la politique de la société : le super admin les consulte, il ne les fixe pas.
// =========================================================

import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { LimitsHistoryQueryDto, LimitsQueryDto, SetKycLevelDto, SetLimitsDto } from './dto/transfer-limit.dto';
import { TransferLimitsService } from './transfer-limits.service';

type AuthRequest = Request & { user?: AuthUserPayload };

function currentUser(req: AuthRequest): AuthUserPayload {
  if (!req.user) throw new ForbiddenException('Non authentifié');
  return req.user;
}

@ApiTags('Transfer limits')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('transfer-limits')
export class TransferLimitsController {
  constructor(private readonly limits: TransferLimitsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: "Plafonds d'envoi par niveau KYC et par devise" })
  get(@Req() req: AuthRequest, @Query() query: LimitsQueryDto) {
    return this.limits.get(currentUser(req), query.clientId);
  }

  @Get('history')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Journal des modifications de plafonds' })
  history(@Req() req: AuthRequest, @Query() query: LimitsHistoryQueryDto) {
    return this.limits.history(currentUser(req), query.clientId, query.limit);
  }

  // Déclaré avant les routes à paramètres pour ne pas être confondu avec :level/:currency.
  @Patch('users/:userId/kyc-level')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: "Fixe le niveau KYC d'un client de la société" })
  setKycLevel(@Req() req: AuthRequest, @Param('userId') userId: string, @Body() body: SetKycLevelDto) {
    return this.limits.setUserKycLevel(currentUser(req), userId, body.kycLevel);
  }

  @Put(':level/:currency')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: "Fixe les plafonds d'un niveau KYC dans une devise" })
  set(@Req() req: AuthRequest, @Param('level') level: string, @Param('currency') currency: string, @Body() body: SetLimitsDto) {
    return this.limits.set(currentUser(req), level, currency, body);
  }

  @Delete(':level/:currency')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Rétablit les plafonds par défaut' })
  reset(@Req() req: AuthRequest, @Param('level') level: string, @Param('currency') currency: string) {
    return this.limits.reset(currentUser(req), level, currency);
  }
}
