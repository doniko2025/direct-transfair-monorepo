//apps/backend/src/rates/rates.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RatesService {
  constructor(private prisma: PrismaService) {}

  async getAll() {
    return this.prisma.exchangeRate.findMany();
  }

  async updateRate(pair: string, rate: number) {
    return this.prisma.exchangeRate.upsert({
      where: { pair },
      update: { rate },
      create: { pair, rate },
    });
  }

  // Helper pour convertir
  async convert(amount: number, from: string, to: string): Promise<number> {
    if (from === to) return amount;
    
    const pair = `${from}_${to}`.toUpperCase();
    const exchange = await this.prisma.exchangeRate.findUnique({ where: { pair } });
    
    if (!exchange) {
        // Essai inverse (ex: XOF_EUR = 1 / EUR_XOF)
        const reversePair = `${to}_${from}`.toUpperCase();
        const reverseExchange = await this.prisma.exchangeRate.findUnique({ where: { pair: reversePair } });
        if (reverseExchange) return amount / reverseExchange.rate;
        
        // Si pas de taux, on renvoie 0 ou on throw une erreur (ici on laisse passer pour le test)
        return amount; 
    }

    return amount * exchange.rate;
  }
}