// apps/backend/src/rates-admin/rates-admin.controller.ts
// =========================================================
// RATES ADMIN CONTROLLER v1.0
//   GET /rates-admin                    SUPER_ADMIN, COMPANY_ADMIN : taux appliqués (lecture seule pour la société)
//   GET /rates-admin/:pair/history      SUPER_ADMIN, COMPANY_ADMIN
//   PATCH /rates-admin/:pair              SUPER_ADMIN uniquement : { rate, confirmLargeChange? }
// =========================================================

import { Body, Controller, ForbiddenException, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { RateHistoryQueryDto, SetRateDto } from './dto/rates-admin.dto';
import { RatesAdminService } from './rates-admin.service';

type AuthRequest = Request & { user?: AuthUserPayload };

@ApiTags('Rates admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rates-admin')
export class RatesAdminController {
  constructor(private readonly admin: RatesAdminService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Taux de change appliqués, par couple de devises' })
  list() {
    return this.admin.list();
  }

  @Get(':pair/history')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Historique d’une paire' })
  history(@Param('pair') pair: string, @Query() query: RateHistoryQueryDto) {
    return this.admin.history(pair, query.limit);
  }

  @Patch(':pair')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Enregistre un taux (le sens inverse se déduit)' })
  set(@Req() req: AuthRequest, @Param('pair') pair: string, @Body() body: SetRateDto) {
    if (!req.user) throw new ForbiddenException('Non authentifié');
    return this.admin.set(req.user, pair, body);
  }
}
