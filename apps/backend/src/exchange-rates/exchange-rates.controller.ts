// apps/backend/src/exchange-rates/exchange-rates.controller.ts
// =========================================================
// EXCHANGE RATES CONTROLLER v1.1
// 🚨 FIX SÉCURITÉ : PATCH /exchange-rates/:pair n'avait AUCUNE garde (un TODO
//    en commentaire) — n'importe quel visiteur, même non connecté, pouvait
//    réécrire un taux de change de toute la plateforme.
//    Maintenant : SUPER_ADMIN uniquement, paire et taux validés.
//    Les routes de lecture restent publiques (conversion affichée sans login).
// =========================================================

import {
  Controller, Get, Post, Patch,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ExchangeRatesService } from './exchange-rates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { assertValidRate, parseAnyPair } from '../rates-admin/rate-rules';

@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  // GET /exchange-rates  — public (conversion affichée même sans login)
  @Get()
  getAll() {
    return this.exchangeRatesService.findAll();
  }

  // GET /exchange-rates/:pair  — ex: /exchange-rates/EUR_XOF
  @Get(':pair')
  getOne(@Param('pair') pair: string) {
    return this.exchangeRatesService.findByPair(pair);
  }

  // GET /exchange-rates/:pair/history
  @Get(':pair/history')
  getHistory(
    @Param('pair') pair: string,
    @Query('from')  from?: string,
    @Query('to')    to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.exchangeRatesService.getHistory(pair, {
      from,
      to,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // POST /exchange-rates/convert  — { amount, from, to }
  @Post('convert')
  convert(@Body() body: { amount: number; from: string; to: string }) {
    return this.exchangeRatesService.convert(body.amount, body.from, body.to);
  }

  // PATCH /exchange-rates/:pair  — mise à jour (SUPER_ADMIN uniquement)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Patch(':pair')
  update(
    @Param('pair') pair: string,
    @Body() body: { rate: number },
  ) {
    return this.exchangeRatesService.upsert(parseAnyPair(pair), assertValidRate(body?.rate));
  }
}
