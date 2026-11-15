//apps/backend/src/rates/rates.controller.ts
// =========================================================
// RATES CONTROLLER v2.0
// ✅ v2.0 : taux PAR SOCIÉTÉ — GET public par code société (?code=), POST réservé au COMPANY_ADMIN (ses propres taux).
// 🚨 FIX SÉCURITÉ : POST /rates n'exigeait qu'un JWT valide — n'importe quel
//    utilisateur connecté (même un client wallet) pouvait réécrire un taux de
//    change de toute la plateforme, sans aucune validation (0, négatif…).
//    Maintenant : COMPANY_ADMIN uniquement (v2.0), paire et taux validés.
//    L'administration complète (historique, sens inverse, audit) est dans
//    rates-admin/ ; cette route est conservée pour l'app mobile existante.
// =========================================================

import { Controller, ForbiddenException, Get, Post, Body, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Role } from '@prisma/client';
import { RatesService } from './rates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { assertValidRate, parseAnyPair } from '../rates-admin/rate-rules';
import { RatePairDto } from '../exchange-rates/dto/exchange-rates.dto';

type AuthRequest = Request & { user?: AuthUserPayload };

@Controller('rates')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  // Public : taux de LA société désignée par son code (sans code : aucun taux n'est publié)
  @Get()
  async getAll(@Query('code') code?: string) {
    if (!code || !code.trim()) return [];
    return this.ratesService.getAll(await this.ratesService.clientIdByCode(code));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.COMPANY_ADMIN)
  @Post()
  update(@Req() req: AuthRequest, @Body() body: RatePairDto) {
    const clientId = req.user?.clientId;
    if (!clientId) throw new ForbiddenException('Aucune société rattachée à ce compte.');
    return this.ratesService.updateRate(clientId, parseAnyPair(body.pair), assertValidRate(body.rate));
  }
}
