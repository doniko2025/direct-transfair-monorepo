//apps/backend/src/rates/rates.controller.ts
// =========================================================
// RATES CONTROLLER v1.1
// 🚨 FIX SÉCURITÉ : POST /rates n'exigeait qu'un JWT valide — n'importe quel
//    utilisateur connecté (même un client wallet) pouvait réécrire un taux de
//    change de toute la plateforme, sans aucune validation (0, négatif…).
//    Maintenant : SUPER_ADMIN uniquement, paire et taux validés.
//    L'administration complète (historique, sens inverse, audit) est dans
//    rates-admin/ ; cette route est conservée pour l'app mobile existante.
// =========================================================

import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RatesService } from './rates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { assertValidRate, parseAnyPair } from '../rates-admin/rate-rules';

@Controller('rates')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Get()
  getAll() {
    return this.ratesService.getAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Post()
  update(@Body() body: { pair: string; rate: number }) {
    return this.ratesService.updateRate(parseAnyPair(body?.pair), assertValidRate(body?.rate));
  }
}
