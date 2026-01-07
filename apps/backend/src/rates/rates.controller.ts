//apps/backend/src/rates/rates.controller.ts
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { RatesService } from './rates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Vérifie le chemin

@Controller('rates')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Get()
  getAll() {
    return this.ratesService.getAll();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  update(@Body() body: { pair: string; rate: number }) {
    return this.ratesService.updateRate(body.pair, Number(body.rate));
  }
}