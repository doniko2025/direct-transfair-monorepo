// apps/backend/src/growth/growth.controller.ts
// =========================================================
// GROWTH CONTROLLER v1.0 (lot 16)
//   Client (USER) :
//     POST  /rate-locks                    taux garanti quelques minutes (id à joindre à l'envoi : rateLockId)
//     POST  /money-requests                demander de l'argent à un autre client
//     GET   /money-requests                demandes reçues / envoyées (rapprochement automatique)
//     PATCH /money-requests/:id/decline    refuser (payeur)      PATCH /money-requests/:id/cancel   annuler (demandeur)
//     GET   /referrals/me                  code, filleuls, envois sans frais restants
//   Administrateur de société :
//     GET   /referrals-admin/config        PUT /referrals-admin/config      réglages du programme
//     GET   /referrals-admin/stats         filleuls, récompenses, meilleurs parrains
// =========================================================

import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateMoneyRequestDto, QuoteRateLockDto, UpdateReferralConfigDto } from './dto/growth.dto';
import { GrowthService } from './growth.service';

type AuthRequest = Request & { user?: AuthUserPayload };

function currentUser(req: AuthRequest): AuthUserPayload {
  if (!req.user) throw new ForbiddenException('Non authentifié');
  return req.user;
}

@ApiTags('Croissance')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class GrowthController {
  constructor(private readonly growth: GrowthService) {}

  @Get('rate-locks/config')
  @Roles(Role.USER, Role.AGENT)
  rateLockConfig() {
    return this.growth.rateLockConfig();
  }

  @Post('rate-locks')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.USER, Role.AGENT)
  quote(@Req() req: AuthRequest, @Body() dto: QuoteRateLockDto) {
    return this.growth.quoteRate(currentUser(req), dto);
  }

  @Post('money-requests')
  @Roles(Role.USER)
  createRequest(@Req() req: AuthRequest, @Body() dto: CreateMoneyRequestDto) {
    return this.growth.createRequest(currentUser(req), dto);
  }

  @Get('money-requests')
  @Roles(Role.USER)
  listRequests(@Req() req: AuthRequest) {
    return this.growth.listRequests(currentUser(req));
  }

  @Patch('money-requests/:id/decline')
  @Roles(Role.USER)
  decline(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.growth.closeRequest(currentUser(req), id, 'DECLINE');
  }

  @Patch('money-requests/:id/cancel')
  @Roles(Role.USER)
  cancel(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.growth.closeRequest(currentUser(req), id, 'CANCEL');
  }

  @Get('referrals/me')
  @Roles(Role.USER)
  myReferral(@Req() req: AuthRequest) {
    return this.growth.myReferral(currentUser(req));
  }

  @Get('referrals-admin/config')
  @Roles(Role.COMPANY_ADMIN)
  getConfig(@Req() req: AuthRequest) {
    return this.growth.getReferralConfig(currentUser(req));
  }

  @Put('referrals-admin/config')
  @Roles(Role.COMPANY_ADMIN)
  putConfig(@Req() req: AuthRequest, @Body() dto: UpdateReferralConfigDto) {
    return this.growth.updateReferralConfig(currentUser(req), dto);
  }

  @Get('referrals-admin/stats')
  @Roles(Role.COMPANY_ADMIN)
  stats(@Req() req: AuthRequest) {
    return this.growth.referralStats(currentUser(req));
  }
}
