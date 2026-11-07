// apps/backend/src/merchants/merchants.controller.ts
// =========================================================
// CÔTÉ MARCHAND / CLIENT (application mobile)
//   GET   /merchants/options         catalogue pour le formulaire d'inscription / d'activation
//   GET   /merchants/me              mon compte marchand (fiche, destination masquée, réglages, moyens de retrait ouverts)
//   POST  /merchants/activate        devenir marchand (code secret)
//   PATCH /merchants/me              nom, catégorie, adresse, ville
//   PUT   /merchants/me/destination  numéro Orange Money / compte bancaire des retraits (code secret)
//   GET   /merchants/me/summary      encaissements du jour et totaux
//   POST  /merchants/payouts         demander un retrait (code secret)
//   GET   /merchants/payouts         mes retraits
// =========================================================

import { Body, Controller, ForbiddenException, Get, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { ActivateMerchantDto, ChangeDestinationDto, RequestPayoutDto, UpdateMerchantProfileDto } from './dto/merchants.dto';
import { MerchantPayoutsService } from './merchant-payouts.service';
import { MerchantsService } from './merchants.service';

type AuthRequest = Request & { user?: AuthUserPayload };
const me = (req: AuthRequest): AuthUserPayload => {
  if (!req.user) throw new ForbiddenException('Non authentifié');
  return req.user;
};
const num = (v?: string): number | undefined => (v ? Number(v) || undefined : undefined);

@ApiTags('Marchand')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER)
@Controller('merchants')
export class MerchantsController {
  constructor(
    private readonly merchants: MerchantsService,
    private readonly payouts: MerchantPayoutsService,
  ) {}

  @Get('options')
  options(@Req() req: AuthRequest) {
    return this.merchants.publicOptions(me(req).clientId ?? 0);
  }

  @Get('me')
  mine(@Req() req: AuthRequest) {
    return this.merchants.getMine(me(req));
  }

  @Post('activate')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  activate(@Req() req: AuthRequest, @Body() body: ActivateMerchantDto) {
    return this.merchants.activate(me(req), body);
  }

  @Patch('me')
  update(@Req() req: AuthRequest, @Body() body: UpdateMerchantProfileDto) {
    return this.merchants.updateProfile(me(req), body);
  }

  @Put('me/destination')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  destination(@Req() req: AuthRequest, @Body() body: ChangeDestinationDto) {
    return this.merchants.changeDestination(me(req), body);
  }

  @Get('me/summary')
  summary(@Req() req: AuthRequest) {
    return this.merchants.summary(me(req));
  }

  @Post('payouts')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  requestPayout(@Req() req: AuthRequest, @Body() body: RequestPayoutDto) {
    return this.payouts.request(me(req), body);
  }

  @Get('payouts')
  listPayouts(@Req() req: AuthRequest, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.payouts.listMine(me(req), { page: num(page), limit: num(limit) });
  }
}
