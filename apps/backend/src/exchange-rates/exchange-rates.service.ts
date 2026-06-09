// apps/backend/src/exchange-rates/exchange-rates.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService }                  from '../prisma/prisma.service';

@Injectable()
export class ExchangeRatesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Tous les taux actifs ─────────────────────────────────
  async findAll() {
    return this.prisma.exchangeRate.findMany({
      where:   { isActive: true },
      orderBy: { pair: 'asc' },
    });
  }

  // ── Taux par paire (ex: "EUR_XOF") ──────────────────────
  async findByPair(pair: string) {
    const rate = await this.prisma.exchangeRate.findUnique({
      where: { pair: pair.toUpperCase() },
    });
    if (!rate) throw new NotFoundException(`Taux "${pair}" introuvable`);
    return rate;
  }

  // ── Historique d'une paire ───────────────────────────────
  async getHistory(
    pair: string,
    params?: { from?: string; to?: string; limit?: number },
  ) {
    return this.prisma.exchangeRateHistory.findMany({
      where: {
        pair: pair.toUpperCase(),
        ...(params?.from || params?.to
          ? {
              recordedAt: {
                ...(params.from ? { gte: new Date(params.from) } : {}),
                ...(params.to   ? { lte: new Date(params.to)   } : {}),
              },
            }
          : {}),
      },
      orderBy: { recordedAt: 'desc' },
      take:    params?.limit ?? 100,
    });
  }

  // ── Conversion d'un montant ──────────────────────────────
  async convert(
    amount: number,
    from: string,
    to: string,
  ): Promise<{ amount: number; rate: number; convertedAmount: number }> {
    if (from.toUpperCase() === to.toUpperCase()) {
      return { amount, rate: 1, convertedAmount: amount };
    }

    const directPair  = `${from.toUpperCase()}_${to.toUpperCase()}`;
    const inversePair = `${to.toUpperCase()}_${from.toUpperCase()}`;

    // Paire directe
    const direct = await this.prisma.exchangeRate.findUnique({
      where: { pair: directPair },
    });
    if (direct) {
      const rate            = Number(direct.rate);
      const convertedAmount = Math.round(amount * rate * 100) / 100;
      return { amount, rate, convertedAmount };
    }

    // Paire inverse
    const inverse = await this.prisma.exchangeRate.findUnique({
      where: { pair: inversePair },
    });
    if (inverse) {
      const rate            = 1 / Number(inverse.rate);
      const convertedAmount = Math.round(amount * rate * 100) / 100;
      return { amount, rate, convertedAmount };
    }

    throw new NotFoundException(`Aucun taux trouvé pour la paire ${directPair}`);
  }

  // ── Créer ou mettre à jour un taux (admin) ───────────────
  async upsert(pair: string, rate: number) {
    const upperPair   = pair.toUpperCase();
    const inverseRate = rate !== 0 ? 1 / rate : null;

    // ✅ FIX : récupérer l'id du taux upserted pour lier l'historique
    const result = await this.prisma.exchangeRate.upsert({
      where:  { pair: upperPair },
      update: {
        rate,
        inverseRate,
        previousRate:  undefined, // mis à jour côté hook si besoin
        changePercent: undefined,
        updatedAt:     new Date(),
      },
      create: {
        pair: upperPair,
        rate,
        inverseRate,
      },
    });

    // Archiver dans l'historique (rateId obligatoire selon le schéma)
    try {
      await this.prisma.exchangeRateHistory.create({
        data: {
          rateId:     result.id,   // ✅ relation obligatoire ExchangeRate → ExchangeRateHistory
          pair:       upperPair,
          rate,
          recordedAt: new Date(),
        },
      });
    } catch {
      // Non bloquant si la table historique n'est pas encore migrée
    }

    return result;
  }
}