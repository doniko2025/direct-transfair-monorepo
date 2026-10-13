// apps/backend/src/locations/locations.controller.ts
// =========================================================
// LOCATIONS CONTROLLER v1.1 — Direct Transf'air
// ✅ GET /locations → PUBLIC, aucun JWT requis
// ✅ Utilisé par les clients wallet pour voir les agences
// ✅ v1.1 (phase 6, passe 2) : limité à la société désignée par l'en-tête `x-tenant-id`.
//    Avant, la route renvoyait les agences de TOUTES les sociétés (noms, adresses, téléphones) à n'importe qui,
//    sans authentification. Sans en-tête (ou société inconnue) : liste vide.
// =========================================================

import { Controller, Get, Headers } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { LocationsService } from './locations.service';

@ApiTags('Locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  /**
   * GET /locations
   * Public (pas de JWT) mais propre à UNE société : celle de l'en-tête `x-tenant-id`.
   */
  @Get()
  @ApiOperation({ summary: "Agences actives de la société (en-tête x-tenant-id), sans authentification" })
  findAll(@Headers('x-tenant-id') tenant?: string | string[]) {
    return this.locationsService.findPublic(Array.isArray(tenant) ? tenant[0] : tenant);
  }
}
