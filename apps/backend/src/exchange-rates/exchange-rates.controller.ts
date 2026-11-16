// apps/backend/src/exchange-rates/exchange-rates.controller.ts
// =========================================================
// EXCHANGE RATES CONTROLLER v2.1
// ✅ v2.1 : LECTURE SEULE. Route PATCH /exchange-rates/:pair supprimée (doublon inutilisé de PATCH /rates-admin/:pair, qui
//    ajoute historique, audit et garde-fou de variation — aucun client ne l'appelait). Écriture des taux : /rates-admin uniquement.
// ✅ v2.0 : TAUX PAR SOCIÉTÉ. Lectures publiques désignant la société par son code (?code=FLASH) ; PATCH réservé à
//    l'administrateur de la société (COMPANY_ADMIN), qui ne modifie que SES taux. Le super admin ne fixe plus de taux.
// 🚨 FIX SÉCURITÉ : PATCH /exchange-rates/:pair n'avait AUCUNE garde (un TODO
//    en commentaire) — n'importe quel visiteur, même non connecté, pouvait
//    réécrire un taux de change de toute la plateforme.
//    Maintenant : COMPANY_ADMIN uniquement (v2.0), paire et taux validés.
//    Les routes de lecture restent publiques (conversion affichée sans login).
// =========================================================

import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ExchangeRatesService } from './exchange-rates.service';
import { ConvertDto } from './dto/exchange-rates.dto';

@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  // GET /exchange-rates?code=FLASH  — public (conversion affichée même sans login) ; taux de LA société désignée
  @Get()
  async getAll(@Query('code') code?: string) {
    return this.exchangeRatesService.findAll(await this.exchangeRatesService.clientIdByCode(code));
  }

  // GET /exchange-rates/:pair  — ex: /exchange-rates/EUR_XOF
  @Get(':pair')
  async getOne(@Param('pair') pair: string, @Query('code') code?: string) {
    return this.exchangeRatesService.findByPair(pair, await this.exchangeRatesService.clientIdByCode(code));
  }

  // GET /exchange-rates/:pair/history
  @Get(':pair/history')
  async getHistory(
    @Param('pair') pair: string,
    @Query('code')  code?: string,
    @Query('from')  from?: string,
    @Query('to')    to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.exchangeRatesService.getHistory(pair, await this.exchangeRatesService.clientIdByCode(code), {
      from,
      to,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // POST /exchange-rates/convert  — { amount, from, to }
  @Post('convert')
  async convert(@Body() body: ConvertDto, @Query('code') code?: string) {
    return this.exchangeRatesService.convert(body.amount, body.from, body.to, await this.exchangeRatesService.clientIdByCode(code));
  }
}
