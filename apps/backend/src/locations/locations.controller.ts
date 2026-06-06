// apps/backend/src/locations/locations.controller.ts
// =========================================================
// LOCATIONS CONTROLLER v1.0 — Direct Transf'air
// ✅ GET /locations → PUBLIC, aucun JWT requis
// ✅ Utilisé par les clients wallet pour voir les agences
// ✅ Aucun guard appliqué sur ce contrôleur
// =========================================================

import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { LocationsService } from './locations.service';

@ApiTags('Locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  /**
   * GET /locations
   * Endpoint 100% public — aucune authentification requise.
   * Retourne les agences actives avec leurs informations publiques.
   * Accessible à tous les rôles (y compris clients wallet non connectés).
   */
  @Get()
  @ApiOperation({ summary: 'Liste publique des agences (sans authentification)' })
  findAll() {
    return this.locationsService.findPublic();
  }
}