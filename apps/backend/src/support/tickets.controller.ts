// apps/backend/src/support/tickets.controller.ts
// =========================================================
// CÔTÉ CLIENT (application mobile) — mes demandes d'assistance et mes litiges.
//   POST /support/tickets             ouvre une demande (transactionId optionnel → litige)
//   GET  /support/tickets             mes demandes
//   GET  /support/tickets/:id         une demande + réponses (sans notes internes)
//   POST /support/tickets/:id/reply   je réponds
// =========================================================

import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateTicketDto, TicketReplyDto } from './dto/tickets.dto';
import { TicketsService } from './tickets.service';

type AuthRequest = Request & { user?: AuthUserPayload };
const me = (req: AuthRequest): AuthUserPayload => {
  if (!req.user) throw new ForbiddenException('Non authentifié');
  return req.user;
};

@ApiTags('Assistance')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER)
@Controller('support/tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post()
  create(@Req() req: AuthRequest, @Body() body: CreateTicketDto) {
    return this.tickets.create(me(req), body);
  }

  @Get()
  list(@Req() req: AuthRequest) {
    return this.tickets.listMine(me(req));
  }

  @Get(':id')
  one(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.tickets.getMine(me(req), id);
  }

  @Post(':id/reply')
  reply(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: TicketReplyDto) {
    // Un client ne pose jamais de note interne.
    return this.tickets.replyMine(me(req), id, { ...body, internal: false });
  }
}
