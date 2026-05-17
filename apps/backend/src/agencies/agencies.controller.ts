// apps/backend/src/agencies/agencies.controller.ts
// =========================================================
// AGENCIES CONTROLLER v4.2
// ✅ SUPER_ADMIN global sur toutes les sociétés
// ✅ COMPANY_ADMIN / AGENT limités à leur client
// ✅ CRUD global pour SUPER_ADMIN
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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';

import { AgenciesService } from './agencies.service';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';

// =========================================================
// ROLES DECORATOR
// =========================================================

const ROLES_KEY = 'roles';

const Roles = (...roles: Role[]) => {
  const { SetMetadata } = require('@nestjs/common');
  return SetMetadata(ROLES_KEY, roles);
};

// =========================================================
// ROLES GUARD
// =========================================================

@Injectable()
class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const user: AuthUserPayload = req.user;

    if (!user?.role) {
      return false;
    }

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
  constructor(
    private readonly agenciesService: AgenciesService,
  ) {}

  // =======================================================
  // CREATE
  // =======================================================

  @Post()
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN)
  async create(
    @Req() req: { user?: AuthUserPayload },
    @Body() dto: CreateAgencyDto,
  ) {
    const clientId = req.user?.clientId ?? null;

    if (!clientId) {
      throw new BadRequestException('Aucun client associé');
    }

    return this.agenciesService.create(clientId, dto);
  }

  // =======================================================
  // UPDATE
  // =======================================================

  @Patch(':id')
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN)
  async update(
    @Req() req: { user?: AuthUserPayload },
    @Param('id') id: string,
    @Body() dto: UpdateAgencyDto,
  ) {
    const role = req.user?.role;
    const clientId = req.user?.clientId ?? null;

    // ✅ SUPER ADMIN → GLOBAL
    if (role === Role.SUPER_ADMIN) {
      return this.agenciesService.updateAsSuperAdmin(id, dto);
    }

    // ✅ COMPANY ADMIN → limité à son client
    if (!clientId) {
      throw new BadRequestException('Aucun client associé');
    }

    return this.agenciesService.update(id, clientId, dto);
  }

  // =======================================================
  // DELETE
  // =======================================================

  @Delete(':id')
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN)
  async remove(
    @Req() req: { user?: AuthUserPayload },
    @Param('id') id: string,
  ) {
    const role = req.user?.role;
    const clientId = req.user?.clientId ?? null;

    // ✅ SUPER ADMIN → GLOBAL
    if (role === Role.SUPER_ADMIN) {
      return this.agenciesService.removeAsSuperAdmin(id);
    }

    // ✅ COMPANY ADMIN → limité à son client
    if (!clientId) {
      throw new BadRequestException('Aucun client associé');
    }

    return this.agenciesService.remove(id, clientId);
  }

  // =======================================================
  // GET ALL
  // =======================================================

  @Get()
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN, Role.AGENT)
  async findAll(
    @Req() req: { user?: AuthUserPayload },
  ) {
    const role = req.user?.role;
    const clientId = req.user?.clientId ?? null;

    // ✅ SUPER ADMIN → toutes les agences
    if (role === Role.SUPER_ADMIN) {
      return this.agenciesService.findAll();
    }

    // ✅ COMPANY ADMIN / AGENT → agences du client
    if (!clientId) {
      return [];
    }

    return this.agenciesService.findAllByClient(clientId);
  }

  // =======================================================
  // GET ONE
  // =======================================================

  @Get(':id')
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN, Role.AGENT)
  async findOne(
    @Req() req: { user?: AuthUserPayload },
    @Param('id') id: string,
  ) {
    const role = req.user?.role;
    const clientId = req.user?.clientId ?? null;

    // ✅ SUPER ADMIN → accès global
    if (role === Role.SUPER_ADMIN) {
      return this.agenciesService.findOneAsSuperAdmin(id);
    }

    // ✅ COMPANY ADMIN / AGENT → limité au client
    if (!clientId) {
      throw new BadRequestException('Aucun client associé');
    }

    return this.agenciesService.findOne(id, clientId);
  }
}