// apps/backend/src/merchants/merchants-admin.controller.ts
// =========================================================
// CÔTÉ ADMINISTRATEUR DE LA SOCIÉTÉ (web)
//   GET   /merchants-admin                         marchands de la société (recherche, statut, pages)
//   GET   /merchants-admin/payouts[?status]        retraits (PENDING d'abord à traiter)
//   POST  /merchants-admin/payouts/:id/paid        { providerRef? }  l'argent a été envoyé
//   POST  /merchants-admin/payouts/:id/reject      { reason }        refus, le marchand est recrédité
//   GET   /merchants-admin/:userId                 fiche + derniers encaissements / retraits
//   PATCH /merchants-admin/:userId/suspend         { reason }
//   PATCH /merchants-admin/:userId/reactivate
// Super admin : ?clientId=… obligatoire. Les réglages (commission, durées, plafonds) sont dans /company-settings.
// =========================================================

import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { MarkPayoutPaidDto, MerchantListQueryDto, RejectPayoutDto, SuspendMerchantDto } from './dto/merchants.dto';
import { MerchantPayoutsService } from './merchant-payouts.service';
import { MerchantsService } from './merchants.service';

type AuthRequest = Request & { user?: AuthUserPayload };
const me = (req: AuthRequest): AuthUserPayload => {
  if (!req.user) throw new ForbiddenException('Non authentifié');
  return req.user;
};
const num = (v?: string): number | undefined => (v ? Number(v) || undefined : undefined);

@ApiTags('Marchands — administration')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
@Controller('merchants-admin')
export class MerchantsAdminController {
  constructor(
    private readonly merchants: MerchantsService,
    private readonly payouts: MerchantPayoutsService,
  ) {}

  @Get()
  list(@Req() req: AuthRequest, @Query() q: MerchantListQueryDto) {
    return this.merchants.listAdmin(me(req), q);
  }

  @Get('payouts')
  listPayouts(@Req() req: AuthRequest, @Query('status') status?: string, @Query('page') page?: string, @Query('limit') limit?: string, @Query('clientId') clientId?: string) {
    return this.payouts.listAdmin(me(req), { status, page: num(page), limit: num(limit), clientId: num(clientId) });
  }

  @Post('payouts/:id/paid')
  markPaid(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: MarkPayoutPaidDto, @Query('clientId') clientId?: string) {
    return this.payouts.markPaid(me(req), id, body, num(clientId));
  }

  @Post('payouts/:id/reject')
  reject(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: RejectPayoutDto, @Query('clientId') clientId?: string) {
    return this.payouts.reject(me(req), id, body, num(clientId));
  }

  @Get(':userId')
  one(@Req() req: AuthRequest, @Param('userId') userId: string, @Query('clientId') clientId?: string) {
    return this.merchants.getAdmin(me(req), userId, num(clientId));
  }

  @Patch(':userId/suspend')
  suspend(@Req() req: AuthRequest, @Param('userId') userId: string, @Body() body: SuspendMerchantDto, @Query('clientId') clientId?: string) {
    return this.merchants.setSuspended(me(req), userId, true, body.reason, num(clientId));
  }

  @Patch(':userId/reactivate')
  reactivate(@Req() req: AuthRequest, @Param('userId') userId: string, @Query('clientId') clientId?: string) {
    return this.merchants.setSuspended(me(req), userId, false, undefined, num(clientId));
  }
}
