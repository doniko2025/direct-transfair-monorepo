// apps/backend/src/agents-admin/agents-admin.controller.ts
// =========================================================
// AGENTS ADMIN CONTROLLER v1.0
//   GET   /agents-admin                       SUPER_ADMIN (tous, lecture seule), COMPANY_ADMIN (sa société)
//   POST  /agents-admin                       COMPANY_ADMIN : crée un agent dans une agence
//   PATCH /agents-admin/:id/agency            COMPANY_ADMIN : change l'agence de l'agent
//   PATCH /agents-admin/:id/manager           COMPANY_ADMIN : en fait le responsable de son agence
//   POST  /agents-admin/:id/reset-password    COMPANY_ADMIN : nouveau mot de passe temporaire
// =========================================================

import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { AgentsAdminService } from './agents-admin.service';
import { AssignAgencyDto, CreateAgentDto } from './dto/agents-admin.dto';

type AuthRequest = Request & { user?: AuthUserPayload };

function currentUser(req: AuthRequest): AuthUserPayload {
  if (!req.user) throw new ForbiddenException('Non authentifié');
  return req.user;
}

@ApiTags('Agents admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('agents-admin')
export class AgentsAdminController {
  constructor(private readonly agents: AgentsAdminService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Agents, avec leur agence' })
  list(@Req() req: AuthRequest) {
    return this.agents.list(currentUser(req));
  }

  @Post()
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Crée un agent dans une agence de ma société' })
  create(@Req() req: AuthRequest, @Body() body: CreateAgentDto) {
    return this.agents.create(currentUser(req), body);
  }

  @Patch(':id/agency')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: "Change l'agence d'un agent" })
  assignAgency(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: AssignAgencyDto) {
    return this.agents.assignAgency(currentUser(req), id, body);
  }

  @Patch(':id/manager')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: "Désigne l'agent comme responsable de son agence" })
  setManager(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.agents.setManager(currentUser(req), id);
  }

  @Post(':id/reset-password')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Génère un nouveau mot de passe temporaire pour un agent' })
  resetPassword(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.agents.resetPassword(currentUser(req), id);
  }
}
