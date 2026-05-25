// apps/backend/src/clients/branding.controller.ts
// =========================================================
// BRANDING PUBLIC CONTROLLER — sans authentification
// ✅ Appelé AVANT login pour charger le thème de la société
// ✅ Retourne uniquement les champs publics (jamais de données sensibles)
// =========================================================

import {
  Controller, Get, Param, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ClientsService } from './clients.service';

@ApiTags('Branding Public')
@Controller('branding')  // GET /branding/:code — pas de JwtAuthGuard
export class BrandingController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get(':code')
  @ApiOperation({ summary: 'Branding public d\'une société (aucune auth requise)' })
  async getBranding(@Param('code') code: string) {
    const branding = await this.clientsService.findPublicByCode(
      code.trim().toUpperCase(),
    );
    if (!branding) {
      throw new NotFoundException(`Société "${code.toUpperCase()}" introuvable ou inactive.`);
    }
    return branding;
  }
}