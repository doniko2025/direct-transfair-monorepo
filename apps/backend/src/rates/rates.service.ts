// apps/backend/src/rates/rates.service.ts
// =========================================================
// RATES SERVICE v2.0 — Direct Transf'air
// ✅ Taux persistés en base (Prisma)
// ✅ Taux in-memory (getRate synchrone)
// ✅ Fallback automatique si base vide
// ✅ Recherche du taux inverse automatique
// =========================================================

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// =========================================================
// TAUX DE RÉFÉRENCE (fallback si base vide au démarrage)
// =========================================================

const FALLBACK_RATES: Record<string, number> = {
  // --- ZONE CFA (XOF) ---
  'EUR_XOF': 655.957, // Fixe
  'USD_XOF': 610.50,  // Variable
  'GBP_XOF': 750.0,
  'GNF_XOF': 0.070,   // 1000 GNF ≈ 70 FCFA

  // --- GUINÉE (GNF) ---
  'EUR_GNF': 9500.0,
  'USD_GNF': 8650.0,
  'XOF_GNF': 14.2,    // 1 FCFA = 14.2 GNF

  // --- EUR / USD / GBP ---
  'EUR_USD': 1.08,
  'USD_EUR': 0.9,
  'GBP_EUR': 1.15,
};

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ========================================================
  // CRUD — Gestion des taux en base (Admin)
  // ========================================================

  /** Récupère tous les taux configurés en base */
  async getAll() {
    return this.prisma.exchangeRate.findMany({
      orderBy: { pair: 'asc' },
    });
  }

  /** Met à jour ou crée un taux (ex: "EUR_GNF" -> 9500) */
  async updateRate(pair: string, rate: number) {
    const normalizedPair = pair.toUpperCase();
    this.logger.log(`ADMIN UPDATE: Taux ${normalizedPair} mis à jour à ${rate}`);
    return this.prisma.exchangeRate.upsert({
      where: { pair: normalizedPair },
      update: { rate },
      create: { pair: normalizedPair, rate },
    });
  }

  // ========================================================
  // CONVERSION SYNCHRONE — in-memory (getRate)
  // ========================================================

  /**
   * Retourne le taux de conversion entre deux devises.
   * Priorité : FALLBACK_RATES → inverse FALLBACK_RATES → exception.
   * Synchrone : à utiliser quand on ne peut pas faire d'appel async.
   */
  getRate(from: string, to: string): number {
    const source = from.toUpperCase().trim();
    const target = to.toUpperCase().trim();

    if (source === target) return 1;

    const pair = `${source}_${target}`;
    const reversePair = `${target}_${source}`;

    if (FALLBACK_RATES[pair]) return FALLBACK_RATES[pair];
    if (FALLBACK_RATES[reversePair]) return 1 / FALLBACK_RATES[reversePair];

    throw new BadRequestException(`Taux non disponible : ${source} → ${target}`);
  }

  // ========================================================
  // CONVERSION ASYNC — avec lookup Prisma (convert)
  // ========================================================

  /**
   * Moteur de conversion complet (A -> B).
   * Ordre de priorité :
   *   1. Taux exact en base (Prisma) — Priorité absolue
   *   2. Taux inverse en base (Prisma)
   *   3. Taux FALLBACK (constantes ci-dessus)
   *   4. Inverse FALLBACK
   *   5. Conversion 1:1 (dernier recours, loggée en erreur)
   */
  async convert(amount: number, from: string, to: string): Promise<number> {
    const source = from.toUpperCase().trim();
    const target = to.toUpperCase().trim();

    if (source === target) return amount;

    const pair = `${source}_${target}`;
    const reversePair = `${target}_${source}`;

    this.logger.log(`💱 Conversion: ${amount} ${source} → ${target} (pair: ${pair})`);

    // 1. Taux exact en base
    const exact = await this.prisma.exchangeRate.findUnique({ where: { pair } });
    if (exact) return amount * Number(exact.rate);

    // 2. Taux inverse en base
    const reverse = await this.prisma.exchangeRate.findUnique({ where: { pair: reversePair } });
    if (reverse && Number(reverse.rate) > 0) return amount / Number(reverse.rate);

    // 3. Fallback exact
    if (FALLBACK_RATES[pair]) {
      this.logger.warn(`⚠️ Taux FALLBACK utilisé pour ${pair}: ${FALLBACK_RATES[pair]}`);
      return amount * FALLBACK_RATES[pair];
    }

    // 4. Fallback inverse
    if (FALLBACK_RATES[reversePair]) {
      this.logger.warn(`⚠️ Taux FALLBACK inverse utilisé pour ${reversePair}`);
      return amount / FALLBACK_RATES[reversePair];
    }

    // 5. Dernier recours
    this.logger.error(`❌ Taux introuvable pour ${pair}. Conversion 1:1 appliquée.`);
    return amount;
  }
}