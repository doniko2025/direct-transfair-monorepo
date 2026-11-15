// apps/backend/src/exchange-rates/exchange-rates.service.ts
// ✅ v2.0 : TAUX PAR SOCIÉTÉ — chaque société (COMPANY_ADMIN) fixe ses propres taux, indépendamment des autres.
//    Lectures publiques : la société est désignée par son code public (?code=FLASH). Écriture : administrateur de la société.
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService }                  from '../prisma/prisma.service';

@Injectable()
export class ExchangeRatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Id de la société désignée par son code public ; null si aucun code n'est fourni ; 404 si le code est inconnu. */
  async clientIdByCode(code?: string | null): Promise<number | null> {
    if (!code || !code.trim()) return null;
    const client = await this.prisma.client.findUnique({ where: { code: code.trim().toUpperCase() }, select: { id: true } });
    if (!client) throw new NotFoundException(`Société « ${code} » introuvable`);
    return client.id;
  }

  // ── Tous les taux actifs d'UNE société (sans société : aucun taux n'est publié) ──
  async findAll(clientId: number | null) {
    if (clientId === null) return [];
    return this.prisma.exchangeRate.findMany({
      where:   { clientId, isActive: true },
      orderBy: { pair: 'asc' },
    });
  }

  // ── Taux par paire (ex: "EUR_XOF") ──────────────────────
  async findByPair(pair: string, clientId: number | null) {
    const rate = clientId === null ? null : await this.prisma.exchangeRate.findFirst({
      where: { clientId, pair: pair.toUpperCase() },
    });
    if (!rate) throw new NotFoundException(`Taux "${pair}" introuvable`);
    return rate;
  }

  // ── Historique d'une paire ───────────────────────────────
  async getHistory(
    pair: string,
    clientId: number | null,
    params?: { from?: string; to?: string; limit?: number },
  ) {
    if (clientId === null) return [];
    return this.prisma.exchangeRateHistory.findMany({
      where: {
        pair: pair.toUpperCase(),
        exchangeRate: { clientId },
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

  // ── Conversion d'un montant (taux de la société) ─────────
  async convert(
    amount: number,
    from: string,
    to: string,
    clientId: number | null,
  ): Promise<{ amount: number; rate: number; convertedAmount: number }> {
    if (from.toUpperCase() === to.toUpperCase()) {
      return { amount, rate: 1, convertedAmount: amount };
    }

    const directPair  = `${from.toUpperCase()}_${to.toUpperCase()}`;
    const inversePair = `${to.toUpperCase()}_${from.toUpperCase()}`;

    if (clientId !== null) {
      // Paire directe
      const direct = await this.prisma.exchangeRate.findFirst({ where: { clientId, pair: directPair } });
      if (direct) {
        const rate            = Number(direct.rate);
        const convertedAmount = Math.round(amount * rate * 100) / 100;
        return { amount, rate, convertedAmount };
      }

      // Paire inverse
      const inverse = await this.prisma.exchangeRate.findFirst({ where: { clientId, pair: inversePair } });
      if (inverse) {
        const rate            = 1 / Number(inverse.rate);
        const convertedAmount = Math.round(amount * rate * 100) / 100;
        return { amount, rate, convertedAmount };
      }
    }

    throw new NotFoundException(`Aucun taux trouvé pour la paire ${directPair}`);
  }

  // ── Créer ou mettre à jour un taux de LA société (admin de société) ──
  async upsert(clientId: number, pair: string, rate: number) {
    const upperPair   = pair.toUpperCase();
    const inverseRate = rate !== 0 ? 1 / rate : null;

    // ✅ FIX : récupérer l'id du taux upserted pour lier l'historique
    const result = await this.prisma.exchangeRate.upsert({
      where:  { clientId_pair: { clientId, pair: upperPair } },
      update: {
        rate,
        inverseRate,
        previousRate:  undefined, // mis à jour côté hook si besoin
        changePercent: undefined,
        updatedAt:     new Date(),
      },
      create: {
        clientId,
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
