// apps/backend/src/reconciliation/reconciliation.controller.ts
//   GET  /reconciliation          — dernier rapport + historique (SUPER_ADMIN : tout ; COMPANY_ADMIN : sa société)
//   POST /reconciliation/run      — relance le contrôle maintenant (SUPER_ADMIN)
import { Controller, ForbiddenException, Get, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { ReconciliationService } from './reconciliation.service';

type AuthRequest = Request & { user?: AuthUserPayload };

@ApiTags('Reconciliation')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reconciliation')
export class ReconciliationController {
  constructor(private readonly service: ReconciliationService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Réconciliation des portefeuilles : dernier rapport par devise et historique' })
  overview(@Req() req: AuthRequest, @Query('days') days?: string) {
    if (!req.user) throw new ForbiddenException('Non authentifié');
    return this.service.overview(req.user, Number(days) || 14);
  }

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Relance la réconciliation maintenant' })
  async run() {
    const res = await this.service.run();
    return { runDate: res.runDate, lines: res.rows.length, alerts: res.alerts, status: res.rows.some((r) => r.status === 'ALERT') ? 'ALERT' : 'OK' };
  }
}
