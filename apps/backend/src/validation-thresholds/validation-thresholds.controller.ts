// apps/backend/src/validation-thresholds/validation-thresholds.controller.ts
// =========================================================
// VALIDATION THRESHOLDS CONTROLLER v1.0 — seuil de validation d'un envoi cash
//   GET    /validation-thresholds             SUPER_ADMIN (?clientId), COMPANY_ADMIN : un seuil par devise
//   GET    /validation-thresholds/history     SUPER_ADMIN (?clientId), COMPANY_ADMIN : journal
//   PUT    /validation-thresholds/:currency   COMPANY_ADMIN : { amount }
//   DELETE /validation-thresholds/:currency   COMPANY_ADMIN : revient à la valeur par défaut
//
// Le seuil est la politique de la société : le super admin le consulte, il ne le fixe pas.
// =========================================================

import { Body, Controller, Delete, ForbiddenException, Get, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { SetThresholdDto, ThresholdHistoryQueryDto, ThresholdQueryDto } from './dto/validation-threshold.dto';
import { ValidationThresholdsService } from './validation-thresholds.service';

type AuthRequest = Request & { user?: AuthUserPayload };

function currentUser(req: AuthRequest): AuthUserPayload {
  if (!req.user) throw new ForbiddenException('Non authentifié');
  return req.user;
}

@ApiTags('Validation thresholds')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('validation-thresholds')
export class ValidationThresholdsController {
  constructor(private readonly thresholds: ValidationThresholdsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Seuils de validation des envois cash (par devise)' })
  get(@Req() req: AuthRequest, @Query() query: ThresholdQueryDto) {
    return this.thresholds.get(currentUser(req), query.clientId);
  }

  @Get('history')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Journal des modifications du seuil de validation' })
  history(@Req() req: AuthRequest, @Query() query: ThresholdHistoryQueryDto) {
    return this.thresholds.history(currentUser(req), query.clientId, query.limit);
  }

  @Put(':currency')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Fixe le seuil de validation d’une devise' })
  set(@Req() req: AuthRequest, @Param('currency') currency: string, @Body() body: SetThresholdDto) {
    return this.thresholds.set(currentUser(req), currency, body);
  }

  @Delete(':currency')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Rétablit le seuil par défaut d’une devise' })
  reset(@Req() req: AuthRequest, @Param('currency') currency: string) {
    return this.thresholds.reset(currentUser(req), currency);
  }
}
