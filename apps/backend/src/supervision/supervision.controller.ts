// apps/backend/src/supervision/supervision.controller.ts
// =========================================================
// SUPERVISION CONTROLLER v1.0
//   GET   /supervision/overview
//   GET   /supervision/audit-logs
//   GET   /supervision/alerts
//   PATCH /supervision/alerts/:id/resolve
//
// SUPER_ADMIN : toute la plateforme. COMPANY_ADMIN : sa société uniquement
// (périmètre imposé par le service à partir du token).
// =========================================================

import { Controller, ForbiddenException, Get, HttpCode, HttpStatus, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { ListAlertsQueryDto, ListAuditLogsQueryDto } from './dto/supervision.dto';
import { SupervisionService } from './supervision.service';

type AuthRequest = Request & { user?: AuthUserPayload };

function currentUser(req: AuthRequest): AuthUserPayload {
  if (!req.user) throw new ForbiddenException('Non authentifié');
  return req.user;
}

@ApiTags('Supervision')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('supervision')
export class SupervisionController {
  constructor(private readonly supervision: SupervisionService) {}

  @Get('overview')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Santé de la base, activité 24 h, sécurité, sociétés et points d’attention' })
  overview(@Req() req: AuthRequest) {
    return this.supervision.overview(currentUser(req));
  }

  @Get('audit-logs')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Journal d’audit paginé' })
  auditLogs(@Req() req: AuthRequest, @Query() query: ListAuditLogsQueryDto) {
    return this.supervision.auditLogs(currentUser(req), query);
  }

  @Get('alerts')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Alertes paginées (ouvertes par défaut)' })
  alerts(@Req() req: AuthRequest, @Query() query: ListAlertsQueryDto) {
    return this.supervision.alerts(currentUser(req), query);
  }

  @Patch('alerts/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Marque une alerte comme traitée' })
  resolveAlert(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.supervision.resolveAlert(currentUser(req), id);
  }
}
