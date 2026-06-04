// apps/backend/src/rates/rates.service.ts
// =========================================================
// RATES SERVICE v3.1 — Direct Transf'air
// ✅ v3.0 : Toutes les paires couvertes + pivot EUR + fallback explicite
// ✅ FIX v3.1 : Normalisation du format de paire
//    AVANT : les taux sauvegardés depuis le frontend arrivaient avec
//            le format slash "EUR/XOF" mais convert() cherchait avec
//            le format underscore "EUR_XOF" → pas de match en base →
//            toujours fallback même quand un taux admin était défini.
//    MAINTENANT :
//    - normalizePair() convertit systématiquement slash → underscore
//    - updateRate() normalise avant stockage
//    - convert() cherche avec underscore ET slash pour compatibilité
//      avec les données déjà en base au format slash
//    - getAll() retourne les paires en format slash (lisible frontend)
// =========================================================

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// =========================================================
// TAUX DE RÉFÉRENCE — toutes les paires directionnelles
// 5 devises : XOF, EUR, USD, GNF, GBP → 20 paires (5×4)
// Format interne : TOUJOURS underscore (EUR_XOF, pas EUR/XOF)
// =========================================================

const FALLBACK_RATES: Record<string, number> = {
  // ── XOF (Franc CFA) ────────────────────────────────────
  'XOF_EUR': 1 / 655.957,   // ≈ 0.001524
  'XOF_USD': 1 / 610.50,    // ≈ 0.001638
  'XOF_GNF': 14.20,
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
  'GNF_XOF': 1 / 14.20,
  'GNF_EUR': 1 / 9500.0,
  'GNF_USD': 1 / 8750.0,
  'GNF_GBP': 1 / 11000.0,

  // ── GBP (Livre Sterling) ───────────────────────────────
  'GBP_XOF': 750.0,
  'GBP_EUR': 1.160,
  'GBP_USD': 1.259,
  'GBP_GNF': 11000.0,
};

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ========================================================
  // HELPER — Normalisation du format de paire
  // ✅ FIX v3.1 : toujours underscore en interne
  // Exemples :
  //   "EUR/XOF" → "EUR_XOF"
  //   "eur_xof" → "EUR_XOF"
  //   "EUR-XOF" → "EUR_XOF"
  // ========================================================

  private normalizePair(pair: string): string {
    return pair
      .toUpperCase()
      .trim()
      .replace(/[\/\-\s]/g, '_');
  }

  // ========================================================
  // CRUD — Gestion des taux en base (Admin)
  // ========================================================

  async getAll() {
    const rates = await this.prisma.exchangeRate.findMany({
      orderBy: { pair: 'asc' },
    });

    // ✅ FIX v3.1 — Retourne en format SLASH pour le frontend
    // (rétrocompatibilité avec le convertisseur mobile qui utilise "EUR/XOF")
    return rates.map((r) => ({
      ...r,
      pair: r.pair.includes('/') ? r.pair : r.pair.replace('_', '/'),
    }));
  }

  async updateRate(pair: string, rate: number) {
    // ✅ FIX v3.1 — Normalise slash → underscore avant stockage
    const normalizedPair = this.normalizePair(pair);
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

  getRate(from: string, to: string): number {
    const source = from.toUpperCase().trim();
    const target = to.toUpperCase().trim();
    if (source === target) return 1;

    const pair        = `${source}_${target}`;
    const reversePair = `${target}_${source}`;

    if (FALLBACK_RATES[pair])        return FALLBACK_RATES[pair];
    if (FALLBACK_RATES[reversePair]) return 1 / FALLBACK_RATES[reversePair];

    const rateToEur   = this.getRateToEurSync(source);
    const rateFromEur = this.getRateFromEurSync(target);
    if (rateToEur !== null && rateFromEur !== null) {
      return rateToEur * rateFromEur;
    }

    throw new BadRequestException(`Taux non disponible : ${source} → ${target}`);
  }

  // ========================================================
  // CONVERSION ASYNC — Prisma + fallback + pivot EUR
  // ✅ FIX v3.1 : cherche en base avec les DEUX formats
  //   (underscore pour les nouvelles entrées normalisées,
  //    slash pour les anciennes entrées non migrées)
  // ========================================================

  async convert(amount: number, from: string, to: string): Promise<number> {
    const source = from.toUpperCase().trim();
    const target = to.toUpperCase().trim();

    if (source === target) return amount;

    const pairUnderscore = `${source}_${target}`;
    const pairSlash      = `${source}/${target}`;
    const revUnderscore  = `${target}_${source}`;
    const revSlash       = `${target}/${source}`;

    this.logger.log(`💱 Conversion: ${amount} ${source} → ${target}`);

    // ── 1. Taux exact en base (underscore ET slash) ──────
    const exact = await this.prisma.exchangeRate.findFirst({
      where: { OR: [{ pair: pairUnderscore }, { pair: pairSlash }] },
    });
    if (exact) {
      this.logger.log(`✅ Taux base exact: ${exact.pair} = ${exact.rate}`);
      return amount * Number(exact.rate);
    }

    // ── 2. Taux inverse en base (underscore ET slash) ────
    const reverse = await this.prisma.exchangeRate.findFirst({
      where: { OR: [{ pair: revUnderscore }, { pair: revSlash }] },
    });
    if (reverse && Number(reverse.rate) > 0) {
      this.logger.log(`✅ Taux base inverse: ${reverse.pair} = ${reverse.rate}`);
      return amount / Number(reverse.rate);
    }

    // ── 3. Via pivot EUR en base ────────────────────────
    if (source !== 'EUR' && target !== 'EUR') {
      const sourceToEur = await this.getRateToEurFromDb(source);
      const eurToTarget = await this.getRateFromEurFromDb(target);

      if (sourceToEur !== null && eurToTarget !== null) {
        const result = amount * sourceToEur * eurToTarget;
        this.logger.log(
          `✅ Pivot EUR base: ${source}→EUR (${sourceToEur}) → ${target} (${eurToTarget})`,
        );
        return result;
      }
    }

    // ── 4. Fallback exact ───────────────────────────────
    if (FALLBACK_RATES[pairUnderscore]) {
      this.logger.warn(`⚠️ Fallback: ${pairUnderscore} = ${FALLBACK_RATES[pairUnderscore]}`);
      return amount * FALLBACK_RATES[pairUnderscore];
    }

    // ── 5. Fallback inverse ─────────────────────────────
    if (FALLBACK_RATES[revUnderscore]) {
      this.logger.warn(`⚠️ Fallback inverse: ${revUnderscore}`);
      return amount / FALLBACK_RATES[revUnderscore];
    }

    // ── 6. Pivot EUR fallback ───────────────────────────
    if (source !== 'EUR' && target !== 'EUR') {
      const rateToEur   = this.getRateToEurSync(source);
      const rateFromEur = this.getRateFromEurSync(target);
      if (rateToEur !== null && rateFromEur !== null) {
        const result = amount * rateToEur * rateFromEur;
        this.logger.warn(
          `⚠️ Pivot EUR fallback: ${source}→EUR (${rateToEur}) → ${target} (${rateFromEur})`,
        );
        return result;
      }
    }

    // ── 7. Échec explicite — plus de 1:1 silencieux ─────
    const msg = `Taux de conversion introuvable : ${source} → ${target}. Vérifiez la configuration des taux dans l'admin.`;
    this.logger.error(`❌ ${msg}`);
    throw new BadRequestException(msg);
  }

  // ========================================================
  // HELPERS PRIVÉS
  // ========================================================

  private async getRateToEurFromDb(source: string): Promise<number | null> {
    const direct = await this.prisma.exchangeRate.findFirst({
      where: { OR: [{ pair: `${source}_EUR` }, { pair: `${source}/EUR` }] },
    });
    if (direct) return Number(direct.rate);

    const inverse = await this.prisma.exchangeRate.findFirst({
      where: { OR: [{ pair: `EUR_${source}` }, { pair: `EUR/${source}` }] },
    });
    if (inverse && Number(inverse.rate) > 0) return 1 / Number(inverse.rate);

    return this.getRateToEurSync(source);
  }

  private async getRateFromEurFromDb(target: string): Promise<number | null> {
    const direct = await this.prisma.exchangeRate.findFirst({
      where: { OR: [{ pair: `EUR_${target}` }, { pair: `EUR/${target}` }] },
    });
    if (direct) return Number(direct.rate);

    const inverse = await this.prisma.exchangeRate.findFirst({
      where: { OR: [{ pair: `${target}_EUR` }, { pair: `${target}/EUR` }] },
    });
    if (inverse && Number(inverse.rate) > 0) return 1 / Number(inverse.rate);

    return this.getRateFromEurSync(target);
  }

  private getRateToEurSync(source: string): number | null {
    if (FALLBACK_RATES[`${source}_EUR`]) return FALLBACK_RATES[`${source}_EUR`];
    if (FALLBACK_RATES[`EUR_${source}`]) return 1 / FALLBACK_RATES[`EUR_${source}`];
    return null;
  }

  private getRateFromEurSync(target: string): number | null {
    if (FALLBACK_RATES[`EUR_${target}`]) return FALLBACK_RATES[`EUR_${target}`];
    if (FALLBACK_RATES[`${target}_EUR`]) return 1 / FALLBACK_RATES[`${target}_EUR`];
    return null;
  }
}