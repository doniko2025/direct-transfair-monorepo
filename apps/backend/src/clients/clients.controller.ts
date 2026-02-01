// apps/backend/src/clients/clients.controller.ts
import { Controller, Get, Post, Body, Param, UseGuards, ParseIntPipe, Delete, Patch, ForbiddenException, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role, SubscriptionStatus } from '@prisma/client';

import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Clients (Sociétés)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Créer une société' })
  create(@Body() createClientDto: CreateClientDto) {
    return this.clientsService.create(createClientDto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN) // 🔒 Sécurité : Seul le Super Admin voit la liste globale
  @ApiOperation({ summary: 'Lister les sociétés' })
  findAll() {
    // Le service filtrera automatiquement "DONIKO" pour ne pas l'afficher
    return this.clientsService.findAll();
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Voir une société spécifique' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const user = req.user;

    // 🔒 SÉCURITÉ : Un Admin Société ne peut voir QUE sa propre société
    if (user.role === Role.COMPANY_ADMIN && user.clientId !== id) {
        throw new ForbiddenException("Vous ne pouvez pas accéder aux données d'une autre société.");
    }

    return this.clientsService.findOne(id);
  }

  // ✅ ROUTE MODIFIER (PATCH) - Mise à jour complète
  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mettre à jour les infos' })
  update(
    @Param('id', ParseIntPipe) id: number,
    // ⚠️ On utilise 'any' ou un DTO partiel complet pour ne pas perdre de données
    // Le formulaire frontend envoie beaucoup de champs (adresse, contact, couleurs...)
    @Body() data: any 
  ) {
    return this.clientsService.update(id, data);
  }

  // ✅ ROUTE STATUT (Suspendre/Activer)
  @Patch(':id/status')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Changer le statut (ACTIVE/SUSPENDED)' })
  updateStatus(
      @Param('id', ParseIntPipe) id: number, 
      @Body('status') status: SubscriptionStatus
  ) {
    return this.clientsService.updateStatus(id, status);
  }

  // ✅ ROUTE SUPPRIMER (DELETE)
  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Supprimer une société' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.remove(id);
  }
}