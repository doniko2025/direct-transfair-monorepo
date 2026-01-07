// apps/backend/src/clients/clients.controller.ts
import { Controller, Get, Post, Body, Param, UseGuards, ParseIntPipe, Delete, Patch } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role, SubscriptionStatus, SubscriptionType } from '@prisma/client';

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
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Lister les sociétés' })
  findAll() {
    return this.clientsService.findAll();
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.findOne(id);
  }

  // ✅ ROUTE MODIFIER (PATCH) - Indispensable pour le bouton crayon
  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mettre à jour les infos' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { name?: string; code?: string; primaryColor?: string; subscriptionType?: SubscriptionType }
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