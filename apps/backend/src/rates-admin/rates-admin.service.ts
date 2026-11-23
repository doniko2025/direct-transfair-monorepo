// apps/backend/src/rates-admin/rates-admin.service.ts
// =========================================================
// RATES ADMIN v2.1 — administration des taux de change PAR SOCIÉTÉ
// ✅ v2.1 : MARGE DE CHANGE de la société (getMargin / setMargin, journalisée) ; list() renvoie aussi `fxMarginPct`.
// ✅ v2.0 : chaque société fixe ses propres taux, indépendamment des autres (clientId). L'administrateur de société les modifie ;
//    le super admin les consulte en LECTURE SEULE (sélecteur de société) et n'en fixe aucun.
//
//   list     : une ligne par couple de devises, avec le taux appliqué (null tant qu'aucun taux n'est
//              enregistré : la conversion est alors REFUSÉE, il n'existe plus de taux de secours en dur)
//              et les incohérences éventuelles entre les deux sens.
//   history  : historique d'une paire.
//   set      : enregistre un taux (administrateur de la société) — en une transaction : taux, sens inverse
//              s'il existe déjà en base, historique et journal d'audit.
//
// Remplace pour l'écriture les deux anciennes routes (POST /rates, PATCH /exchange-rates/:pair),
// sans garde ni validation, qui ne tenaient ni historique ni audit à jour.
// =========================================================

import { BadRequestException, Injectable } from '@nestjs/common';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../rates/rates.service';
import type { SetRateDto } from './dto/rates-admin.dto';
import { assertValidFxMargin, CANONICAL_PAIRS, LARGE_CHANGE_PERCENT, MAX_FX_MARGIN_PCT, normalizePair, parseCanonicalPair } from './rate-rules';

/** Écart relatif au-delà duquel deux sens enregistrés séparément sont jugés incohérents. */
const MISMATCH_TOLERANCE = 0.001;

const percent = (next: number, previous: number | null): number | null =>
  previous !== null && previous > 0 ? Math.round(((next - previous) / previous) * 10_000) / 100 : null;

@Injectable()
export class RatesAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rates: RatesService,
  ) {}

  // ───────────────────────────────────────────────────────
  // Liste
  // ───────────────────────────────────────────────────────

  async list(clientId: number) {
    const rows = await this.prisma.exchangeRate.findMany({ where: { clientId } });

    // Anciennes lignes au format « EUR/XOF » : on les range sous la forme normalisée,
    // la forme avec underscore l'emportant si les deux existent.
    const byPair = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const key = normalizePair(row.pair);
      const known = byPair.get(key);
      if (!known || row.pair === key) byPair.set(key, row);
    }

    const authorIds = [...new Set(rows.map((r) => r.updatedBy).filter((v): v is string => Boolean(v)))];
    const authors = authorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const authorName = (id: string | null) => {
      const u = authors.find((a) => a.id === id);
      if (!u) return null;
      return [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email;
    };

    const pairs = CANONICAL_PAIRS.map(({ base, quote, pair }) => {
      const direct = byPair.get(pair);
      const inverse = byPair.get(`${quote}_${base}`);

      let rate: number | null = null;
      let derived = false;
      if (direct) rate = Number(direct.rate);
      else if (inverse && Number(inverse.rate) > 0) {
        rate = 1 / Number(inverse.rate);
        derived = true;
      }

      const used = direct ?? inverse ?? null;
      const inverseMismatch =
        direct && inverse && Number(direct.rate) > 0 && Number(inverse.rate) > 0
          ? Math.abs(Number(direct.rate) * Number(inverse.rate) - 1) > MISMATCH_TOLERANCE
          : false;

      return {
        pair,
        base,
        quote,
        rate,
        /** Le taux vient du sens inverse (1 / taux) : aucun taux n'est enregistré dans ce sens. */
        derived,
        inverseMismatch,
        previousRate: used && !derived ? used.previousRate : null,
        changePercent: used && !derived ? used.changePercent : null,
        source: used?.source ?? null,
        updatedAt: used ? used.updatedAt.toISOString() : null,
        updatedBy: used ? authorName(used.updatedBy ?? null) : null,
      };
    });

    return { pairs, ...(await this.getMargin(clientId)) };
  }

  // ───────────────────────────────────────────────────────
  // Marge de change (v7.8) : gain de la société sur le taux, retenu sur chaque conversion faite pour un client
  // ───────────────────────────────────────────────────────

  async getMargin(clientId: number) {
    const row = await this.prisma.client.findUnique({ where: { id: clientId }, select: { fxMarginPct: true } });
    return { fxMarginPct: Number(row?.fxMarginPct ?? 0), maxFxMarginPct: MAX_FX_MARGIN_PCT };
  }

  /** Règle la marge de SA société (0 = aucune). Journalisée ; une valeur identique ne réécrit rien. */
  async setMargin(user: AuthUserPayload, clientId: number, raw: unknown) {
    const next = assertValidFxMargin(raw);
    const { fxMarginPct: current } = await this.getMargin(clientId);
    if (next === current) return { fxMarginPct: current, maxFxMarginPct: MAX_FX_MARGIN_PCT };
    await this.prisma.$transaction(async (tx) => {
      await tx.client.update({ where: { id: clientId }, data: { fxMarginPct: next } });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          clientId,
          action: 'EXCHANGE_RATE_UPDATE',
          entity: 'Client',
          entityId: String(clientId),
          details: { kind: 'FX_MARGIN', from: current, to: next },
          successful: true,
        },
      });
    });
    return { fxMarginPct: next, maxFxMarginPct: MAX_FX_MARGIN_PCT };
  }

  // ───────────────────────────────────────────────────────
  // Historique
  // ───────────────────────────────────────────────────────

  async history(clientId: number, rawPair: string, limit: number) {
    const { base, quote, pair } = parseCanonicalPair(rawPair);
    const rows = await this.prisma.exchangeRateHistory.findMany({
      where: { pair: { in: [pair, `${base}/${quote}`] }, exchangeRate: { clientId } },
      orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: { id: true, rate: true, source: true, recordedAt: true },
    });
    return {
      pair,
      base,
      quote,
      data: rows.map((r) => ({ id: r.id, rate: Number(r.rate), source: r.source, recordedAt: r.recordedAt.toISOString() })),
    };
  }

  // ───────────────────────────────────────────────────────
  // Enregistrement
  // ───────────────────────────────────────────────────────

  async set(user: AuthUserPayload, clientId: number, rawPair: string, dto: SetRateDto) {
    const { base, quote, pair } = parseCanonicalPair(rawPair);
    const inversePair = `${quote}_${base}`;
    const rate = dto.rate;

    const rows = await this.prisma.exchangeRate.findMany({
      where: { clientId, pair: { in: [pair, `${base}/${quote}`, inversePair, `${quote}/${base}`] } },
    });
    const direct = rows.find((r) => r.pair === pair) ?? rows.find((r) => r.pair === `${base}/${quote}`);
    const inverse = rows.find((r) => r.pair === inversePair) ?? rows.find((r) => r.pair === `${quote}/${base}`);

    // Taux effectivement appliqué jusqu'ici : celui de la base, sinon l'inverse ; null s'il n'y en a jamais eu (aucun taux en dur).
    const current: number | null = direct
      ? Number(direct.rate)
      : inverse && Number(inverse.rate) > 0
        ? 1 / Number(inverse.rate)
        : null;
    const change = percent(rate, current);

    if (change !== null && Math.abs(change) > LARGE_CHANGE_PERCENT && !dto.confirmLargeChange) {
      throw new BadRequestException({
        code: 'LARGE_CHANGE',
        message: `Ce taux varie de ${change > 0 ? '+' : ''}${change} % par rapport au taux actuel. Confirmez pour l'enregistrer.`,
        changePercent: change,
      });
    }

    const inverseRate = 1 / rate;

    await this.prisma.$transaction(async (tx) => {
      const saved = direct
        ? await tx.exchangeRate.update({
            where: { id: direct.id },
            data: {
              pair,
              rate,
              inverseRate,
              previousRate: direct.rate,
              changePercent: percent(rate, Number(direct.rate)),
              version: { increment: 1 },
              updatedBy: user.id,
              source: 'manual',
              isActive: true,
            },
          })
        : await tx.exchangeRate.create({
            data: { clientId, pair, rate, inverseRate, previousRate: current, changePercent: change, updatedBy: user.id, source: 'manual' },
          });
      await tx.exchangeRateHistory.create({ data: { rateId: saved.id, pair, rate, source: 'manual' } });

      // Le sens inverse déjà enregistré est réaligné : sinon il l'emporterait sur le calcul et rouvrirait l'arbitrage.
      if (inverse) {
        await tx.exchangeRate.update({
          where: { id: inverse.id },
          data: {
            pair: inversePair,
            rate: inverseRate,
            inverseRate: rate,
            previousRate: inverse.rate,
            changePercent: percent(inverseRate, Number(inverse.rate)),
            version: { increment: 1 },
            updatedBy: user.id,
            source: 'manual',
            isActive: true,
          },
        });
        await tx.exchangeRateHistory.create({ data: { rateId: inverse.id, pair: inversePair, rate: inverseRate, source: 'manual' } });
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          clientId,
          action: 'EXCHANGE_RATE_UPDATE',
          entity: 'ExchangeRate',
          entityId: saved.id,
          details: { pair, from: current, to: rate, changePercent: change, inverseAligned: Boolean(inverse) },
          successful: true,
        },
      });
    });

    const { pairs } = await this.list(clientId);
    return pairs.find((p) => p.pair === pair);
  }
}
