//apps/backend/src/rates/rates.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name);

  constructor(private prisma: PrismaService) {}

  // Récupère la liste de tous les taux configurés en base
  async getAll() {
    return this.prisma.exchangeRate.findMany({
        orderBy: { pair: 'asc' }
    });
  }

  // Met à jour ou crée un taux (ex: "EUR_GNF" -> 9500)
  async updateRate(pair: string, rate: number) {
    this.logger.log(`ADMIN UPDATE: Taux ${pair} mis à jour à ${rate}`);
    return this.prisma.exchangeRate.upsert({
      where: { pair: pair.toUpperCase() },
      update: { rate },
      create: { pair: pair.toUpperCase(), rate },
    });
  }

  // Moteur de conversion automatique (A -> B)
  async convert(amount: number, from: string, to: string): Promise<number> {
    const source = from.toUpperCase().trim();
    const target = to.toUpperCase().trim();

    // Pas de conversion si même devise
    if (source === target) return amount;
    
    const pair = `${source}_${target}`;
    this.logger.log(`💱 Conversion auto: ${amount} ${source} -> ${target} (Pair: ${pair})`);

    // 1. Chercher le taux exact en base de données (Priorité Absolue)
    const exchange = await this.prisma.exchangeRate.findUnique({ where: { pair } });
    if (exchange) {
        return amount * exchange.rate;
    }

    // 2. Chercher le taux inverse (ex: on a EUR_XOF mais on veut XOF_EUR)
    const reversePair = `${target}_${source}`;
    const reverseExchange = await this.prisma.exchangeRate.findUnique({ where: { pair: reversePair } });
    if (reverseExchange && reverseExchange.rate > 0) {
        return amount / reverseExchange.rate;
    }

    // 3. 🚨 TAUX PAR DÉFAUT (Si la base est vide au démarrage)
    // Ce sont les valeurs de référence du marché pour vos 4 devises.
    const FALLBACK_RATES: Record<string, number> = {
        // --- ZONE CFA (XOF) ---
        'EUR_XOF': 655.957, // Fixe
        'USD_XOF': 610.50,  // Variable
        'GNF_XOF': 0.070,   // 1000 GNF = 70 FCFA (approx)

        // --- GUINÉE (GNF) ---
        'EUR_GNF': 9500.0,
        'USD_GNF': 8650.0,
        'XOF_GNF': 14.2,    // 1 FCFA = 14.2 GNF

        // --- USA (USD) ---
        'EUR_USD': 1.08,
    };

    if (FALLBACK_RATES[pair]) {
        this.logger.warn(`⚠️ Utilisation taux FALLBACK pour ${pair}: ${FALLBACK_RATES[pair]}`);
        return amount * FALLBACK_RATES[pair];
    }

    // Gestion des inverses pour les Fallbacks
    if (FALLBACK_RATES[reversePair]) {
        return amount / FALLBACK_RATES[reversePair];
    }

    // Si vraiment aucune liaison n'est trouvée (ex: USD -> GNF via pivot manquant)
    this.logger.error(`❌ Taux introuvable pour ${pair}. Conversion 1:1 appliquée.`);
    return amount; 
  }
}