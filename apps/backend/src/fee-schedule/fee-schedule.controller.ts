// apps/backend/src/fee-schedule/fee-schedule.controller.ts
// =========================================================
// FEE SCHEDULE CONTROLLER v1.0 — barème de frais
//   GET    /fees-admin/rules            SUPER_ADMIN (?clientId), COMPANY_ADMIN : le barème
//   GET    /fees-admin/rules/history    SUPER_ADMIN (?clientId), COMPANY_ADMIN : journal des modifications
//   POST   /fees-admin/rules            COMPANY_ADMIN : ajoute une règle
//   PATCH  /fees-admin/rules/:id        COMPANY_ADMIN : modifie une règle (remplacement complet des champs)
//   DELETE /fees-admin/rules/:id        COMPANY_ADMIN : supprime une règle
//   GET    /fees-admin/quote            tout compte d'une société : frais exacts d'un envoi
//
// Le barème est le tarif de la société : le super admin le consulte, il ne le fixe pas.
// =========================================================

import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { FeeQuoteQueryDto, FeeRuleBodyDto, FeeRuleHistoryQueryDto, FeeRulesQueryDto } from './dto/fee-rule.dto';
import { FeeScheduleService } from './fee-schedule.service';

type AuthRequest = Request & { user?: AuthUserPayload };

function currentUser(req: AuthRequest): AuthUserPayload {
  if (!req.user) throw new ForbiddenException('Non authentifié');
  return req.user;
}

@ApiTags('Fee schedule')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fees-admin')
export class FeeScheduleController {
  constructor(private readonly schedule: FeeScheduleService) {}

  @Get('rules')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Barème de frais d’une société' })
  list(@Req() req: AuthRequest, @Query() query: FeeRulesQueryDto) {
    return this.schedule.list(currentUser(req), query.clientId);
  }

  @Get('rules/history')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Journal des modifications du barème' })
  history(@Req() req: AuthRequest, @Query() query: FeeRuleHistoryQueryDto) {
    return this.schedule.history(currentUser(req), query.clientId, query.limit);
  }

  @Post('rules')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Ajoute une règle au barème' })
  create(@Req() req: AuthRequest, @Body() body: FeeRuleBodyDto) {
    return this.schedule.create(currentUser(req), body);
  }

  @Patch('rules/:id')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Modifie une règle du barème' })
  update(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: FeeRuleBodyDto) {
    return this.schedule.update(currentUser(req), id, body);
  }

  @Delete('rules/:id')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Supprime une règle du barème' })
  remove(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.schedule.remove(currentUser(req), id);
  }

  @Get('quote')
  @Roles(Role.USER, Role.AGENT, Role.COMPANY_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Frais exacts d’un envoi (même calcul que celui du serveur)' })
  quote(@Req() req: AuthRequest, @Query() q: FeeQuoteQueryDto) {
    const user = currentUser(req);
    const isAdmin = user.role === 'COMPANY_ADMIN' || user.role === 'SUPER_ADMIN';
    const clientId = user.role === 'SUPER_ADMIN' ? q.clientId : user.clientId;
    if (!clientId) throw new ForbiddenException(user.role === 'SUPER_ADMIN' ? 'Précisez la société (clientId).' : 'Compte non rattaché à une société.');
    return this.schedule.quote({
      clientId,
      // Un administrateur simule : son propre pays ne doit pas s'inviter dans le calcul (il précise le pays d'envoi, ou rien).
      senderId: isAdmin ? null : user.id,
      payoutMethod: q.payoutMethod,
      amount: q.amount,
      currency: q.currency,
      receiveCountry: q.receiveCountry ?? null,
      // Seul un administrateur peut simuler un autre pays d'envoi.
      sendCountry: isAdmin && q.sendCountry ? q.sendCountry : undefined,
    });
  }
}
