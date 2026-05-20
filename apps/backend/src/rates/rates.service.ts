// apps/backend/src/rates/rates.service.ts
// =========================================================
// RATES SERVICE v3.0 — Direct Transf'air
// ✅ Toutes les paires directionnelles couvertes (5×4 = 20)
// ✅ Conversion via pivot EUR si paire directe manquante
// ✅ Plus de conversion 1:1 silencieuse — exception explicite
// ✅ Taux persistés en base (Prisma) — priorité absolue
// ✅ Fallback in-memory si base vide
// ✅ getRate() synchrone mis à jour avec toutes les paires
// =========================================================

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// =========================================================
// TAUX DE RÉFÉRENCE — toutes les paires directionnelles
// 5 devises : XOF, EUR, USD, GNF, GBP → 20 paires (5×4)
// Source : taux approximatifs mai 2026 — à mettre à jour via admin
// =========================================================

const FALLBACK_RATES: Record<string, number> = {
  // ── XOF (Franc CFA) ────────────────────────────────────
  'XOF_EUR': 1 / 655.957,   // ≈ 0.001524
  'XOF_USD': 1 / 610.50,    // ≈ 0.001638
  'XOF_GNF': 14.20,         // 1 XOF = 14.20 GNF
  'XOF_GBP': 1 / 750.0,     // ≈ 0.001333

  // ── EUR (Euro) ─────────────────────────────────────────
  'EUR_XOF': 655.957,        // Fixe BCEAO
  'EUR_USD': 1.08,
  'EUR_GNF': 9500.0,
  'EUR_GBP': 0.862,

  // ── USD (Dollar US) ────────────────────────────────────
  'USD_XOF': 610.50,
  'USD_EUR': 0.926,
  'USD_GNF': 8750.0,
  'USD_GBP': 0.794,

  // ── GNF (Franc Guinéen) ────────────────────────────────
  'GNF_XOF': 1 / 14.20,     // ≈ 0.0704
  'GNF_EUR': 1 / 9500.0,    // ≈ 0.0001053
  'GNF_USD': 1 / 8750.0,    // ≈ 0.0001143
  'GNF_GBP': 1 / 11000.0,   // ≈ 0.0000909

  // ── GBP (Livre Sterling) ───────────────────────────────
  'GBP_XOF': 750.0,
  'GBP_EUR': 1.160,
  'GBP_USD': 1.259,
  'GBP_GNF': 11000.0,
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

  async getAll() {
    return this.prisma.exchangeRate.findMany({ orderBy: { pair: 'asc' } });
  }

  async updateRate(pair: string, rate: number) {
    const normalizedPair = pair.toUpperCase();
    this.logger.log(`ADMIN UPDATE: Taux ${normalizedPair} mis à jour à ${rate}`);
    return this.prisma.exchangeRate.upsert({
      where:  { pair: normalizedPair },
      update: { rate },
      create: { pair: normalizedPair, rate },
    });
  }

  // ========================================================
  // CONVERSION SYNCHRONE — in-memory uniquement
  // ========================================================

  /**
   * Retourne le taux entre deux devises (synchrone).
   * Utilise FALLBACK_RATES uniquement — pas d'appel Prisma.
   * Pour les conversions en service, préférer convert() (async).
   */
  getRate(from: string, to: string): number {
    const source = from.toUpperCase().trim();
    const target = to.toUpperCase().trim();
    if (source === target) return 1;

    const pair        = `${source}_${target}`;
    const reversePair = `${target}_${source}`;

    if (FALLBACK_RATES[pair])        return FALLBACK_RATES[pair];
    if (FALLBACK_RATES[reversePair]) return 1 / FALLBACK_RATES[reversePair];

    // Tentative via pivot EUR (synchrone)
    const rateToEur   = this.getRateToEurSync(source);
    const rateFromEur = this.getRateFromEurSync(target);
    if (rateToEur !== null && rateFromEur !== null) {
      return rateToEur * rateFromEur;
    }

    throw new BadRequestException(`Taux non disponible : ${source} → ${target}`);
  }

  // ========================================================
  // CONVERSION ASYNC — Prisma + fallback + pivot EUR
  // ========================================================

  /**
   * Moteur de conversion complet (A → B).
   *
   * Ordre de priorité :
   *   1. Paire exacte en base (Prisma)
   *   2. Paire inverse en base (Prisma)
   *   3. Via pivot EUR en base (A→EUR puis EUR→B)
   *   4. Paire exacte FALLBACK
   *   5. Paire inverse FALLBACK
   *   6. Via pivot EUR FALLBACK
   *   7. Exception BadRequest — PLUS de conversion 1:1 silencieuse
   *
   * La conversion 1:1 était dangereuse : un envoi de 100 EUR
   * vers un bénéficiaire GBP donnait 100 GBP au lieu de ~86 GBP.
   */
  async convert(amount: number, from: string, to: string): Promise<number> {
    const source = from.toUpperCase().trim();
    const target = to.toUpperCase().trim();

    if (source === target) return amount;

    const pair        = `${source}_${target}`;
    const reversePair = `${target}_${source}`;

    this.logger.log(`💱 Conversion: ${amount} ${source} → ${target}`);

    // ── 1. Taux exact en base ───────────────────────────
    const exact = await this.prisma.exchangeRate.findUnique({ where: { pair } });
    if (exact) {
      this.logger.log(`✅ Taux base exact: ${pair} = ${exact.rate}`);
      return amount * Number(exact.rate);
    }

    // ── 2. Taux inverse en base ─────────────────────────
    const reverse = await this.prisma.exchangeRate.findUnique({ where: { pair: reversePair } });
    if (reverse && Number(reverse.rate) > 0) {
      this.logger.log(`✅ Taux base inverse: ${reversePair} = ${reverse.rate}`);
      return amount / Number(reverse.rate);
    }

    // ── 3. Via pivot EUR en base ────────────────────────
    if (source !== 'EUR' && target !== 'EUR') {
      const toEurPair   = `${source}_EUR`;
      const fromEurPair = `EUR_${target}`;

      const toEur   = await this.prisma.exchangeRate.findUnique({ where: { pair: toEurPair } });
      const fromEur = await this.prisma.exchangeRate.findUnique({ where: { pair: fromEurPair } });

      if (toEur && fromEur) {
        const amountInEur = amount * Number(toEur.rate);
        const result      = amountInEur * Number(fromEur.rate);
        this.logger.log(`✅ Pivot EUR base: ${source}→EUR (${toEur.rate}) → ${target} (${fromEur.rate})`);
        return result;
      }

      // Pivot EUR avec inverses en base
      const sourceToEur = toEur?.rate
        ? Number(toEur.rate)
        : await this.getRateToEurFromDb(source);

      const eurToTarget = fromEur?.rate
        ? Number(fromEur.rate)
        : await this.getRateFromEurFromDb(target);

      if (sourceToEur !== null && eurToTarget !== null) {
        const result = amount * sourceToEur * eurToTarget;
        this.logger.log(`✅ Pivot EUR base (mixte): ${source}→EUR (${sourceToEur}) → ${target} (${eurToTarget})`);
        return result;
      }
    }

    // ── 4. Fallback exact ───────────────────────────────
    if (FALLBACK_RATES[pair]) {
      this.logger.warn(`⚠️ Fallback: ${pair} = ${FALLBACK_RATES[pair]}`);
      return amount * FALLBACK_RATES[pair];
    }

    // ── 5. Fallback inverse ─────────────────────────────
    if (FALLBACK_RATES[reversePair]) {
      this.logger.warn(`⚠️ Fallback inverse: ${reversePair}`);
      return amount / FALLBACK_RATES[reversePair];
    }

    // ── 6. Pivot EUR fallback ───────────────────────────
    if (source !== 'EUR' && target !== 'EUR') {
      const rateToEur   = this.getRateToEurSync(source);
      const rateFromEur = this.getRateFromEurSync(target);
      if (rateToEur !== null && rateFromEur !== null) {
        const result = amount * rateToEur * rateFromEur;
        this.logger.warn(`⚠️ Pivot EUR fallback: ${source}→EUR (${rateToEur}) → ${target} (${rateFromEur})`);
        return result;
      }
    }

    // ── 7. Échec explicite ──────────────────────────────
    // Plus de conversion 1:1 silencieuse — erreur claire pour le frontend
    const msg = `Taux de conversion introuvable : ${source} → ${target}. Vérifiez la configuration des taux dans l'admin.`;
    this.logger.error(`❌ ${msg}`);
    throw new BadRequestException(msg);
  }

  // ========================================================
  // HELPERS PRIVÉS
  // ========================================================

  /** Taux de la devise source vers EUR (depuis la base) */
  private async getRateToEurFromDb(source: string): Promise<number | null> {
    const direct  = await this.prisma.exchangeRate.findUnique({ where: { pair: `${source}_EUR` } });
    if (direct) return Number(direct.rate);

    const inverse = await this.prisma.exchangeRate.findUnique({ where: { pair: `EUR_${source}` } });
    if (inverse && Number(inverse.rate) > 0) return 1 / Number(inverse.rate);

    return this.getRateToEurSync(source);
  }

  /** Taux EUR vers la devise cible (depuis la base) */
  private async getRateFromEurFromDb(target: string): Promise<number | null> {
    const direct  = await this.prisma.exchangeRate.findUnique({ where: { pair: `EUR_${target}` } });
    if (direct) return Number(direct.rate);

    const inverse = await this.prisma.exchangeRate.findUnique({ where: { pair: `${target}_EUR` } });
    if (inverse && Number(inverse.rate) > 0) return 1 / Number(inverse.rate);

    return this.getRateFromEurSync(target);
  }

  /** Taux de la devise source vers EUR (FALLBACK uniquement) */
  private getRateToEurSync(source: string): number | null {
    const pair        = `${source}_EUR`;
    const reversePair = `EUR_${source}`;
    if (FALLBACK_RATES[pair])        return FALLBACK_RATES[pair];
    if (FALLBACK_RATES[reversePair]) return 1 / FALLBACK_RATES[reversePair];
    return null;
  }

  /** Taux EUR vers la devise cible (FALLBACK uniquement) */
  private getRateFromEurSync(target: string): number | null {
    const pair        = `EUR_${target}`;
    const reversePair = `${target}_EUR`;
    if (FALLBACK_RATES[pair])        return FALLBACK_RATES[pair];
    if (FALLBACK_RATES[reversePair]) return 1 / FALLBACK_RATES[reversePair];
    return null;
  }
}