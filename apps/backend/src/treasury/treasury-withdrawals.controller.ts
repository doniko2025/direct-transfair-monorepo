// apps/backend/src/treasury/treasury-withdrawals.controller.ts
//   GET  /treasury/withdrawals?status=PENDING        demandes de retrait (COMPANY_ADMIN : sa société ; SUPER_ADMIN : toutes)
//   POST /treasury/withdrawals/:id/approve           approuve ET exécute (un AUTRE admin de la société, ou le super admin)
//   POST /treasury/withdrawals/:id/reject  { note }  refuse
//   POST /treasury/withdrawals/:id/cancel            le demandeur retire sa demande
import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { TreasuryWithdrawalsService } from './treasury-withdrawals.service';

type AuthRequest = Request & { user?: AuthUserPayload };
const me = (req: AuthRequest): AuthUserPayload => {
  if (!req.user) throw new ForbiddenException('Non authentifié');
  return req.user;
};

@ApiTags('Treasury')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN)
@Controller('treasury/withdrawals')
export class TreasuryWithdrawalsController {
  constructor(private readonly service: TreasuryWithdrawalsService) {}

  @Get()
  @ApiOperation({ summary: 'Demandes de retrait de trésorerie' })
  list(@Req() req: AuthRequest, @Query('status') status?: string) {
    return this.service.list(me(req), status && /^[A-Z]{3,12}$/.test(status) ? status : undefined);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approuve et exécute un retrait (jamais par son demandeur)' })
  approve(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.approve(me(req), id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refuse une demande de retrait' })
  reject(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: { note?: string }) {
    return this.service.reject(me(req), id, typeof body?.note === 'string' ? body.note : null);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Annule sa propre demande de retrait' })
  cancel(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.cancel(me(req), id);
  }
}
