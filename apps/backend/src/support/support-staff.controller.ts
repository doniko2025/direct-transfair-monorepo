// apps/backend/src/support/support-staff.controller.ts
// =========================================================
//   GET   /support-staff/catalog                    catalogue des délégations (libellés, groupes, implications)
//   GET   /support-staff                            comptes du service client de la société
//   POST  /support-staff                            crée un compte (mot de passe temporaire)
//   PATCH /support-staff/:id                        prénom / nom / téléphone
//   PUT   /support-staff/:id/permissions            liste complète des interrupteurs actifs
//   PATCH /support-staff/:id/active                 { active } suspend / réactive
//   POST  /support-staff/:id/reset-password         nouveau mot de passe temporaire
// Réservé à l'administrateur de la société (le super administrateur : lecture seule).
// =========================================================

import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsBoolean } from 'class-validator';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateSupportStaffDto, SetSupportPermissionsDto, UpdateSupportStaffDto } from './dto/support-staff.dto';
import { SupportStaffService } from './support-staff.service';

type AuthRequest = Request & { user?: AuthUserPayload };

function currentUser(req: AuthRequest): AuthUserPayload {
  if (!req.user) throw new ForbiddenException('Non authentifié');
  return req.user;
}

class SetActiveDto {
  @IsBoolean()
  active!: boolean;
}

@ApiTags('Service client — personnel')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('support-staff')
export class SupportStaffController {
  constructor(private readonly staff: SupportStaffService) {}

  @Get('catalog')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.SUPPORT) // le support lit les libellés de ses propres délégations
  @ApiOperation({ summary: 'Catalogue des délégations' })
  catalog() {
    return this.staff.catalog();
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Comptes du service client' })
  list(@Req() req: AuthRequest) {
    return this.staff.list(currentUser(req));
  }

  @Post()
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Crée un compte service client' })
  create(@Req() req: AuthRequest, @Body() body: CreateSupportStaffDto) {
    return this.staff.create(currentUser(req), body);
  }

  @Patch(':id')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Modifie le profil' })
  update(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: UpdateSupportStaffDto) {
    return this.staff.update(currentUser(req), id, body);
  }

  @Put(':id/permissions')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Active / désactive les délégations' })
  setPermissions(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: SetSupportPermissionsDto) {
    return this.staff.setPermissions(currentUser(req), id, body);
  }

  @Patch(':id/active')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Suspend ou réactive le compte' })
  setActive(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: SetActiveDto) {
    return this.staff.setActive(currentUser(req), id, body.active);
  }

  @Post(':id/reset-password')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Nouveau mot de passe temporaire' })
  resetPassword(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.staff.resetPassword(currentUser(req), id);
  }
}
