// apps/backend/src/agencies/agencies.controller.ts
// =========================================================
// AGENCIES CONTROLLER v4.0
// ✅ Import JwtAuthGuard depuis '../auth/jwt-auth.guard' (pas guards/)
// ✅ RolesGuard inline (pas besoin de fichier séparé)
// =========================================================

import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  Injectable,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { AgenciesService } from './agencies.service';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';
// ✅ CORRECTION : chemin correct
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';

// ✅ RolesGuard inline — évite la dépendance vers auth/guards/roles.guard
const ROLES_KEY = 'roles';
const Roles = (...roles: Role[]) => {
  const { SetMetadata } = require('@nestjs/common');
  return SetMetadata(ROLES_KEY, roles);
};

@Injectable()
class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = context.switchToHttp().getRequest();
    const user: AuthUserPayload = req.user;
    if (!user?.role) return false;
    return required.includes(user.role as Role);
  }
}

// =========================================================
// CONTROLLER
// =========================================================

@ApiTags('Agencies')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('agencies')
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Post()
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN)
  async create(
    @Req() req: { user?: AuthUserPayload },
    @Body() dto: CreateAgencyDto,
  ) {
    const clientId = req.user?.clientId ?? null;
    if (!clientId) throw new BadRequestException('Aucun client associé');
    return this.agenciesService.create(clientId, dto);
  }

  @Patch(':id')
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN)
  async update(
    @Req() req: { user?: AuthUserPayload },
    @Param('id') id: string,
    @Body() dto: UpdateAgencyDto,
  ) {
    const clientId = req.user?.clientId ?? null;
    if (!clientId) throw new BadRequestException('Aucun client associé');
    return this.agenciesService.update(id, clientId, dto);
  }

  @Delete(':id')
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN)
  async remove(
    @Req() req: { user?: AuthUserPayload },
    @Param('id') id: string,
  ) {
    const clientId = req.user?.clientId ?? null;
    if (!clientId) throw new BadRequestException('Aucun client associé');
    return this.agenciesService.remove(id, clientId);
  }

  @Get()
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN, Role.AGENT)
  async findAll(@Req() req: { user?: AuthUserPayload }) {
    const clientId = req.user?.clientId ?? null;
    if (!clientId) return [];
    return this.agenciesService.findAllByClient(clientId);
  }

  @Get(':id')
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN, Role.AGENT)
  async findOne(
    @Req() req: { user?: AuthUserPayload },
    @Param('id') id: string,
  ) {
    const clientId = req.user?.clientId ?? null;
    if (!clientId) throw new BadRequestException('Aucun client associé');
    return this.agenciesService.findOne(id, clientId);
  }
}