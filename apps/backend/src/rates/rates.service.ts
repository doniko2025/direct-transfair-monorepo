// apps/backend/src/rates/rates.service.ts
// =========================================================
// RATES SERVICE v4.0 — Direct Transf'air
// ✅ v4.0 (audit argent) : PLUS AUCUN TAUX EN DUR. Avant, la table FALLBACK_RATES (EUR_XOF 655,957, EUR_GNF 9 500…) prenait le
//    relais en silence dès qu'un taux manquait en base : montants reçus, commissions et seuils de contrôle calculés avec un
//    taux inventé, sans contrôle d'ancienneté. Maintenant :
//      - convert() ne lit QUE les taux enregistrés par le super admin (direct, inverse, pivot EUR — voir rate-resolver.ts) ;
//      - taux introuvable (ou trop ancien : 48 h par défaut en production, réglable par RATE_MAX_AGE_HOURS) → 503 explicite, l'opération est refusée, rien n'est
//        débité ; getRate() synchrone supprimée (elle ne pouvait lire que la table en dur) ;
//      - au démarrage, les paires sans taux sont listées dans les journaux (missingPairs()).
// ✅ FIX v3.1 : normalisation du format de paire (slash → underscore), lecture des deux formats pour les anciennes lignes.
// =========================================================

import { Injectable, Logger, OnApplicationBootstrap, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { candidatePairs, resolveMaxAgeMs, resolveRate } from './rate-resolver';
import { CANONICAL_PAIRS } from '../rates-admin/rate-rules';

/** Âge maximal d'un taux : voir `resolveMaxAgeMs` (48 h par défaut en production, « 0 » pour désactiver). */
const maxAgeMs = (): number | undefined => resolveMaxAgeMs();

@Injectable()
export class RatesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Signale au démarrage les paires qui ne peuvent PAS être converties : sans taux, ces conversions sont refusées.
  async onApplicationBootstrap(): Promise<void> {
    try {
      const missing = await this.missingPairs();
      if (missing.length > 0) {
        this.logger.error(
          `⚠️ Taux de change manquants (conversions refusées tant qu'ils ne sont pas fixés par le super admin) : ${missing.join(', ')}`,
        );
      }
    } catch (e) {
      this.logger.warn(`Contrôle des taux au démarrage impossible : ${(e as Error)?.message}`);
    }
  }

  /** Paires (EUR_XOF…) pour lesquelles aucune conversion n'est possible avec les taux enregistrés. */
  async missingPairs(): Promise<string[]> {
    const rows = await this.prisma.exchangeRate.findMany({ select: { pair: true, rate: true, updatedAt: true } });
    const opts = { maxAgeMs: maxAgeMs() };
    return CANONICAL_PAIRS
      .filter(({ base, quote }) => !resolveRate(rows, base, quote, opts).ok)
      .map(({ pair }) => pair);
  }

  // ========================================================
  // HELPER — Normalisation du format de paire
  //   "EUR/XOF" → "EUR_XOF" · "eur_xof" → "EUR_XOF" · "EUR-XOF" → "EUR_XOF"
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

    // Retourne en format SLASH pour le frontend (rétrocompatibilité avec le convertisseur mobile qui utilise "EUR/XOF")
    return rates.map((r) => ({
      ...r,
      pair: r.pair.includes('/') ? r.pair : r.pair.replace('_', '/'),
    }));
  }

  async updateRate(pair: string, rate: number) {
    const normalizedPair = this.normalizePair(pair);
    this.logger.log(`ADMIN UPDATE: Taux ${normalizedPair} mis à jour à ${rate}`);
    return this.prisma.exchangeRate.upsert({
      where:  { pair: normalizedPair },
      update: { rate },
      create: { pair: normalizedPair, rate },
    });
  }

  // ========================================================
  // CONVERSION — taux enregistrés uniquement
  // ========================================================

  /** Taux from → to, ou 503 si la base ne permet pas de le calculer. */
  async getRateFor(from: string, to: string): Promise<number> {
    const source = from.toUpperCase().trim();
    const target = to.toUpperCase().trim();
    if (source === target) return 1;

    const rows = await this.prisma.exchangeRate.findMany({
      where: { pair: { in: candidatePairs(source, target) } },
      select: { pair: true, rate: true, updatedAt: true },
    });
    const res = resolveRate(rows, source, target, { maxAgeMs: maxAgeMs() });
    if (res.ok) return res.rate;

    const msg = res.reason === 'STALE'
      ? `Taux de change ${source} → ${target} trop ancien : il doit être remis à jour par l'administrateur de la plateforme.`
      : `Taux de change ${source} → ${target} indisponible : il doit être fixé par l'administrateur de la plateforme.`;
    this.logger.error(`❌ ${msg}`);
    throw new ServiceUnavailableException(msg);
  }

  async convert(amount: number, from: string, to: string): Promise<number> {
    const rate = await this.getRateFor(from, to);
    return amount * rate;
  }
}
