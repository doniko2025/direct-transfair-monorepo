// apps/backend/src/rates/rates.service.ts
// =========================================================
// RATES SERVICE v5.0 — Direct Transf'air
// ✅ v5.0 : TAUX PAR SOCIÉTÉ. Chaque société (COMPANY_ADMIN) fixe ses propres taux, indépendamment des autres : toutes les lectures
//    et écritures sont filtrées par `clientId`. Le super admin ne fixe plus aucun taux. Aucun repli sur les taux d'une autre société :
//    une société sans taux pour une paire voit la conversion refusée (503) jusqu'à ce que SON administrateur la renseigne.
//    clientId absent/null = anciens taux « plateforme » (lignes d'origine conservées par la migration, plus modifiables).
// ✅ v4.0 (audit argent) : PLUS AUCUN TAUX EN DUR. Avant, la table FALLBACK_RATES (EUR_XOF 655,957, EUR_GNF 9 500…) prenait le
//    relais en silence dès qu'un taux manquait en base : montants reçus, commissions et seuils de contrôle calculés avec un
//    taux inventé, sans contrôle d'ancienneté. Maintenant :
//      - convert() ne lit QUE les taux enregistrés par l'administrateur de la société (direct, inverse, pivot EUR — voir rate-resolver.ts) ;
//      - taux introuvable (ou trop ancien : 48 h par défaut en production, réglable par RATE_MAX_AGE_HOURS) → 503 explicite, l'opération est refusée, rien n'est
//        débité ; getRate() synchrone supprimée (elle ne pouvait lire que la table en dur) ;
//      - au démarrage, les paires sans taux sont listées dans les journaux (missingPairs()).
// ✅ FIX v3.1 : normalisation du format de paire (slash → underscore), lecture des deux formats pour les anciennes lignes.
// =========================================================

import { Injectable, Logger, NotFoundException, OnApplicationBootstrap, ServiceUnavailableException } from '@nestjs/common';
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
      const companies = await this.prisma.client.findMany({ select: { id: true, name: true } });
      for (const c of companies) {
        const missing = await this.missingPairs(c.id);
        if (missing.length > 0) {
          this.logger.warn(
            `⚠️ Société #${c.id} (${c.name}) : taux manquants (conversions refusées tant que son administrateur ne les a pas fixés) : ${missing.join(', ')}`,
          );
        }
      }
    } catch (e) {
      this.logger.warn(`Contrôle des taux au démarrage impossible : ${(e as Error)?.message}`);
    }
  }

  /** Paires (EUR_XOF…) pour lesquelles aucune conversion n'est possible avec les taux enregistrés PAR CETTE SOCIÉTÉ. */
  async missingPairs(clientId?: number | null): Promise<string[]> {
    const rows = await this.prisma.exchangeRate.findMany({
      where: { clientId: clientId ?? null },
      select: { pair: true, rate: true, updatedAt: true },
    });
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

  /** Id de la société désignée par son code public (le même que /branding/:code) ; 404 si inconnu. */
  async clientIdByCode(code: string): Promise<number> {
    const client = await this.prisma.client.findUnique({ where: { code: code.trim().toUpperCase() }, select: { id: true } });
    if (!client) throw new NotFoundException(`Société « ${code} » introuvable`);
    return client.id;
  }

  // ========================================================
  // CRUD — Gestion des taux en base (Admin)
  // ========================================================

  /** Taux d'UNE société (format slash pour le convertisseur mobile). */
  async getAll(clientId?: number | null) {
    const rates = await this.prisma.exchangeRate.findMany({
      where: { clientId: clientId ?? null },
      orderBy: { pair: 'asc' },
    });

    // Retourne en format SLASH pour le frontend (rétrocompatibilité avec le convertisseur mobile qui utilise "EUR/XOF")
    return rates.map((r) => ({
      ...r,
      pair: r.pair.includes('/') ? r.pair : r.pair.replace('_', '/'),
    }));
  }

  /** Enregistre un taux POUR UNE SOCIÉTÉ (jamais pour la plateforme ni pour une autre société). */
  async updateRate(clientId: number, pair: string, rate: number) {
    const normalizedPair = this.normalizePair(pair);
    this.logger.log(`ADMIN UPDATE: société #${clientId} — taux ${normalizedPair} mis à jour à ${rate}`);
    return this.prisma.exchangeRate.upsert({
      where:  { clientId_pair: { clientId, pair: normalizedPair } },
      update: { rate },
      create: { clientId, pair: normalizedPair, rate },
    });
  }

  // ========================================================
  // CONVERSION — taux enregistrés uniquement
  // ========================================================

  /** Taux from → to d'UNE société, ou 503 si la base ne permet pas de le calculer. */
  async getRateFor(from: string, to: string, clientId?: number | null): Promise<number> {
    const source = from.toUpperCase().trim();
    const target = to.toUpperCase().trim();
    if (source === target) return 1;

    const rows = await this.prisma.exchangeRate.findMany({
      where: { clientId: clientId ?? null, pair: { in: candidatePairs(source, target) } },
      select: { pair: true, rate: true, updatedAt: true },
    });
    // Anciens taux « plateforme » (aucune société : p. ex. conversion entre les portefeuilles propres du super admin) : figés, donc pas de
    // contrôle d'ancienneté — sinon ces opérations internes seraient refusées au bout de 48 h. Toute opération de société reste contrôlée.
    const res = resolveRate(rows, source, target, { maxAgeMs: clientId == null ? undefined : maxAgeMs() });
    if (res.ok) return res.rate;

    const msg = res.reason === 'STALE'
      ? `Taux de change ${source} → ${target} trop ancien : il doit être remis à jour par l'administrateur de la société.`
      : `Taux de change ${source} → ${target} indisponible : il doit être fixé par l'administrateur de la société.`;
    this.logger.error(`❌ ${msg}`);
    throw new ServiceUnavailableException(msg);
  }

  async convert(amount: number, from: string, to: string, clientId?: number | null): Promise<number> {
    const rate = await this.getRateFor(from, to, clientId);
    return amount * rate;
  }
}
