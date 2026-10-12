// apps/backend/src/commission-rules/commission-rules.controller.ts
// =========================================================
// COMMISSION RULES CONTROLLER v1.0 — répartition des frais d'un retrait payé
//   GET /commission-rules                       SUPER_ADMIN (?clientId), COMPANY_ADMIN : les 6 combinaisons
//   GET /commission-rules/history               SUPER_ADMIN (?clientId), COMPANY_ADMIN : journal
//   PUT /commission-rules/:source/:dest         COMPANY_ADMIN : { senderShare, payerShare }
//
// La répartition est la politique de la société : le super admin la consulte, il ne la fixe pas.
// =========================================================

import { Body, Controller, ForbiddenException, Get, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { CommissionRulesService } from './commission-rules.service';
import { SetSplitDto, SplitHistoryQueryDto, SplitQueryDto } from './dto/commission-rule.dto';

type AuthRequest = Request & { user?: AuthUserPayload };

function currentUser(req: AuthRequest): AuthUserPayload {
  if (!req.user) throw new ForbiddenException('Non authentifié');
  return req.user;
}

@ApiTags('Commission rules')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('commission-rules')
export class CommissionRulesController {
  constructor(private readonly rules: CommissionRulesService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Répartition des frais entre agences et société' })
  get(@Req() req: AuthRequest, @Query() query: SplitQueryDto) {
    return this.rules.get(currentUser(req), query.clientId);
  }

  @Get('history')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Journal des modifications de répartition' })
  history(@Req() req: AuthRequest, @Query() query: SplitHistoryQueryDto) {
    return this.rules.history(currentUser(req), query.clientId, query.limit);
  }

  @Put(':source/:dest')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Modifie la répartition d’une combinaison expéditeur / agence payeuse' })
  set(@Req() req: AuthRequest, @Param('source') source: string, @Param('dest') dest: string, @Body() body: SetSplitDto) {
    return this.rules.set(currentUser(req), source, dest, body);
  }
}
