// apps/backend/src/exchange-rates/exchange-rates.controller.ts
import {
  Controller, Get, Post, Patch,
  Param, Body, Query,
} from '@nestjs/common';
import { ExchangeRatesService } from './exchange-rates.service';

// TODO: importer JwtAuthGuard et RolesGuard depuis le bon chemin
// de ton projet pour protéger la route PATCH
// ex: import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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

  // PATCH /exchange-rates/:pair  — mise à jour (à protéger avec JwtAuthGuard)
  @Patch(':pair')
  update(
    @Param('pair') pair: string,
    @Body() body: { rate: number },
  ) {
    return this.exchangeRatesService.upsert(pair, body.rate);
  }
}