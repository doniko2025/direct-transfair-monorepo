// apps/backend/src/clients/clients.controller.ts
// =========================================================
// CLIENTS CONTROLLER v4.1
// ✅ Double import @nestjs/common supprimé
// ✅ SetMetadata importé proprement (plus de require())
// ✅ RolesGuard et Roles déclarés avant le controller
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
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,          // ✅ import propre
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Reflector } from '@nestjs/core';
import { Role, SubscriptionStatus } from '@prisma/client';

import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';

// ─── RolesGuard inline ────────────────────────────────────
const ROLES_KEY = 'roles';
const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles); // ✅ plus de require()

@Injectable()
class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const user: AuthUserPayload = context.switchToHttp().getRequest().user;
    if (!user?.role) return false;
    return required.includes(user.role as Role);
  }
}

// ─── Controller ───────────────────────────────────────────
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