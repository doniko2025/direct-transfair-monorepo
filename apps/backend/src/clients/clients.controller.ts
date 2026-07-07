// apps/backend/src/clients/clients.controller.ts
// =========================================================
// CLIENTS CONTROLLER v4.2
// ✅ v4.1 : Double import @nestjs/common supprimé
//          SetMetadata importé proprement (plus de require())
//          RolesGuard et Roles déclarés avant le controller
//
// ✅ v4.2 : Ajout PATCH /clients/me/company-name
//   PROBLÈME RÉSOLU :
//   Le champ "Société" du profil admin (mobile) était verrouillé en
//   dur, sans aucune route permettant à un COMPANY_ADMIN de corriger
//   le nom de sa propre société.
//
//   CORRECTIF :
//   Route dédiée, séparée de PATCH /clients/:id (qui reste réservée
//   à SUPER_ADMIN et accepte n'importe quel champ sans restriction).
//   Ici : le clientId vient TOUJOURS de req.user.clientId (le token
//   JWT de l'appelant), jamais d'un paramètre d'URL — un COMPANY_ADMIN
//   ne peut donc structurellement modifier que sa propre société.
//   Et le service sous-jacent (updateOwnName) ne touche que `name`,
//   jamais subscriptionStatus, devise, branding, etc.
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
  BadRequestException,
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

  // ──────────────────────────────────────────────────────
  // ✅ v4.2 — PATCH /clients/me/company-name (self-service)
  //
  // Déclarée AVANT les routes paramétriques (:id) par convention,
  // même si aucun conflit réel n'est possible ici : "me/company-name"
  // est un chemin à deux segments, ":id" n'en matche qu'un seul.
  // ──────────────────────────────────────────────────────
  @Patch('me/company-name')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Modifier le nom de sa propre société (self-service)' })
  async updateMyCompanyName(
    @Req() req: { user?: AuthUserPayload },
    @Body('name') name: string,
  ) {
    const clientId = req.user?.clientId;
    if (!clientId) {
      throw new BadRequestException('Aucune société associée à ce compte.');
    }
    return this.clientsService.updateOwnName(clientId, name);
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