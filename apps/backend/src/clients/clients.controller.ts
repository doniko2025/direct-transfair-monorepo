// apps/backend/src/clients/clients.controller.ts
// =========================================================
// CLIENTS CONTROLLER v4.0
// ✅ Imports corrigés (chemin JwtAuthGuard correct)
// =========================================================

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  Delete,
  Patch,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role, SubscriptionStatus } from '@prisma/client';

import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
// ✅ CORRECTION : chemin correct (pas guards/)
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';

// ✅ Guard de rôle inline (si RolesGuard pas encore créé)
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

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

@ApiTags('Clients (Sociétés)')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Créer une société' })
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Lister les sociétés' })
  findAll() {
    return this.clientsService.findAll();
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Voir une société spécifique' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user?: AuthUserPayload },
  ) {
    const user = req.user;
    if (user?.role === 'COMPANY_ADMIN' && user.clientId !== id) {
      throw new ForbiddenException(
        "Vous ne pouvez pas accéder aux données d'une autre société.",
      );
    }
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mettre à jour les infos' })
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any) {
    return this.clientsService.update(id, data);
  }

  @Patch(':id/status')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Changer le statut (ACTIVE/SUSPENDED)' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: SubscriptionStatus,
  ) {
    return this.clientsService.updateStatus(id, status);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Supprimer une société' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.remove(id);
  }
}