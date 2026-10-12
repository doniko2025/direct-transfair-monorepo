// apps/backend/src/rates-admin/rates-admin.service.ts
// =========================================================
// RATES ADMIN v1.0 — administration des taux de change (globaux à la plateforme)
//
//   list     : une ligne par couple de devises, avec le taux appliqué, le taux de secours
//              intégré au serveur (utilisé tant qu'aucun taux n'est enregistré) et les
//              incohérences éventuelles entre les deux sens.
//   history  : historique d'une paire.
//   set      : enregistre un taux (super admin) — en une transaction : taux, sens inverse
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
import { CANONICAL_PAIRS, LARGE_CHANGE_PERCENT, normalizePair, parseCanonicalPair } from './rate-rules';

/** Écart relatif au-delà duquel deux sens enregistrés séparément sont jugés incohérents. */
const MISMATCH_TOLERANCE = 0.001;

const percent = (next: number, previous: number): number | null =>
  previous > 0 ? Math.round(((next - previous) / previous) * 10_000) / 100 : null;

@Injectable()
export class RatesAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rates: RatesService,
  ) {}

  // ───────────────────────────────────────────────────────
  // Liste
  // ───────────────────────────────────────────────────────

  async list() {
    const rows = await this.prisma.exchangeRate.findMany();

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
        /** Taux intégré au serveur, appliqué tant qu'aucun taux n'est enregistré. */
        fallbackRate: this.rates.getRate(base, quote),
        inverseMismatch,
        previousRate: used && !derived ? used.previousRate : null,
        changePercent: used && !derived ? used.changePercent : null,
        source: used?.source ?? null,
        updatedAt: used ? used.updatedAt.toISOString() : null,
        updatedBy: used ? authorName(used.updatedBy ?? null) : null,
      };
    });

    return { pairs };
  }

  // ───────────────────────────────────────────────────────
  // Historique
  // ───────────────────────────────────────────────────────

  async history(rawPair: string, limit: number) {
    const { base, quote, pair } = parseCanonicalPair(rawPair);
    const rows = await this.prisma.exchangeRateHistory.findMany({
      where: { pair: { in: [pair, `${base}/${quote}`] } },
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

  async set(user: AuthUserPayload, rawPair: string, dto: SetRateDto) {
    const { base, quote, pair } = parseCanonicalPair(rawPair);
    const inversePair = `${quote}_${base}`;
    const rate = dto.rate;

    const rows = await this.prisma.exchangeRate.findMany({
      where: { pair: { in: [pair, `${base}/${quote}`, inversePair, `${quote}/${base}`] } },
    });
    const direct = rows.find((r) => r.pair === pair) ?? rows.find((r) => r.pair === `${base}/${quote}`);
    const inverse = rows.find((r) => r.pair === inversePair) ?? rows.find((r) => r.pair === `${quote}/${base}`);

    // Taux effectivement appliqué jusqu'ici : celui de la base, sinon l'inverse, sinon le taux de secours.
    const current = direct
      ? Number(direct.rate)
      : inverse && Number(inverse.rate) > 0
        ? 1 / Number(inverse.rate)
        : this.rates.getRate(base, quote);
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
            data: { pair, rate, inverseRate, previousRate: current, changePercent: change, updatedBy: user.id, source: 'manual' },
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
          clientId: user.clientId ?? null,
          action: 'EXCHANGE_RATE_UPDATE',
          entity: 'ExchangeRate',
          entityId: saved.id,
          details: { pair, from: current, to: rate, changePercent: change, inverseAligned: Boolean(inverse) },
          successful: true,
        },
      });
    });

    const { pairs } = await this.list();
    return pairs.find((p) => p.pair === pair);
  }
}
