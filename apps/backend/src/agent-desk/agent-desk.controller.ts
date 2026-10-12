// apps/backend/src/agent-desk/agent-desk.controller.ts
// =========================================================
// AGENT DESK CONTROLLER v1.0 — AGENT uniquement, lecture seule
//   GET /agent-desk/me              agence, caisse (par devise), opérations du jour  (?since=ISO)
//   GET /agent-desk/clients/lookup  client wallet par téléphone (?phone=)
//   GET /agent-desk/send-preview    frais, taux, montant reçu d'un envoi cash (?amount&receiveCountry)
// =========================================================

import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { AgentDeskService } from './agent-desk.service';
import { DeskQueryDto, LookupClientQueryDto, SendPreviewQueryDto } from './dto/agent-desk.dto';

type AuthRequest = Request & { user?: AuthUserPayload };

function agentId(req: AuthRequest): string {
  if (!req.user?.id) throw new ForbiddenException('Non authentifié');
  return req.user.id;
}

@ApiTags('Agent desk')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.AGENT)
@Controller('agent-desk')
export class AgentDeskController {
  constructor(private readonly desk: AgentDeskService) {}

  @Get('me')
  @ApiOperation({ summary: 'Mon agence, ma caisse et mes opérations du jour' })
  me(@Req() req: AuthRequest, @Query() q: DeskQueryDto) {
    return this.desk.me(agentId(req), q.since);
  }

  @Get('clients/lookup')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Client wallet de ma société, par téléphone' })
  lookup(@Req() req: AuthRequest, @Query() q: LookupClientQueryDto) {
    return this.desk.lookupClient(agentId(req), q.phone);
  }

  @Get('send-preview')
  @ApiOperation({ summary: "Frais, taux et montant reçu d'un envoi cash" })
  preview(@Req() req: AuthRequest, @Query() q: SendPreviewQueryDto) {
    return this.desk.sendPreview(agentId(req), q.amount, q.receiveCountry);
  }
}
