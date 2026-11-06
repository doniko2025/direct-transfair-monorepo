// apps/backend/src/company-settings/company-settings.controller.ts
// =========================================================
// COMPANY SETTINGS CONTROLLER v1.0 — paramètres métier d'une société
//   GET    /company-settings          SUPER_ADMIN (?clientId), COMPANY_ADMIN : valeurs appliquées + défauts + options
//   GET    /company-settings/history  SUPER_ADMIN (?clientId), COMPANY_ADMIN : journal
//   PATCH  /company-settings          COMPANY_ADMIN : modification partielle { fees?, commissions?, pickup?, alerts? }
//   DELETE /company-settings          COMPANY_ADMIN : retour à tous les défauts
//
// Ce sont les règles de la société : le super admin les consulte, il ne les fixe pas.
// =========================================================

import { Body, Controller, Delete, ForbiddenException, Get, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { CompanySettingsService } from './company-settings.service';
import { SettingsHistoryQueryDto, SettingsQueryDto, UpdateCompanySettingsDto } from './dto/company-settings.dto';

type AuthRequest = Request & { user?: AuthUserPayload };

function currentUser(req: AuthRequest): AuthUserPayload {
  if (!req.user) throw new ForbiddenException('Non authentifié');
  return req.user;
}

@ApiTags('Company settings')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('company-settings')
export class CompanySettingsController {
  constructor(private readonly settings: CompanySettingsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Paramètres métier de la société' })
  get(@Req() req: AuthRequest, @Query() query: SettingsQueryDto) {
    return this.settings.get(currentUser(req), query.clientId);
  }

  @Get('history')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Journal des modifications des paramètres' })
  history(@Req() req: AuthRequest, @Query() query: SettingsHistoryQueryDto) {
    return this.settings.history(currentUser(req), query.clientId, query.limit);
  }

  @Patch()
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Modifie les paramètres de la société (partiel)' })
  update(@Req() req: AuthRequest, @Body() body: UpdateCompanySettingsDto) {
    return this.settings.update(currentUser(req), body);
  }

  @Delete()
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Rétablit tous les paramètres par défaut' })
  reset(@Req() req: AuthRequest) {
    return this.settings.reset(currentUser(req));
  }
}
