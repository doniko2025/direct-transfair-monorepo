// apps/backend/src/pilotage/pilotage.service.ts
// =========================================================
// PILOTAGE v1.0 (lot 15) — outils de pilotage de l'administrateur de société
//   • clôture de caisse     : l'agent compte ses espèces, l'écart avec le solde théorique est signalé ; l'admin l'examine
//   • liquidité             : seuils minimaux par agence et devise, alertes automatiques (LOW_AGENCY_BALANCE)
//   • rentabilité           : frais, commissions et marge nette estimée par couloir (devise d'envoi → devise reçue)
//   • objectifs des agents  : objectif mensuel, avancement et classement
//   • exports comptables    : CSV (opérations, clôtures, rentabilité) + rapport mensuel
// Tout est filtré par société (clientId du jeton) ; le super admin n'a pas accès aux opérations des sociétés.
// =========================================================

import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CurrencyCode, Prisma, Role } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { MailService } from '../mail/mail.service';
import { dayBounds, localDay, parseDay, parseTzOffset, periodBounds, toCsv } from '../merchants/merchant-extras';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { fxMarginGain } from '../rates-admin/rate-rules';
import type { CloseCashDto, ReviewClosingDto, UpsertLiquidityRuleDto, UpsertTargetDto } from './dto/pilotage.dto';
import {
  AgentActivity,
  computeVariance,
  CorridorRow,
  liquidityLevel,
  liquiditySeverity,
  monthBounds,
  needsLiquidityAlert,
  num,
  parseCounted,
  parseMonth,
  parseTarget,
  pickMinBalance,
  previousMonth,
  rankAgents,
  round,
  targetProgress,
  toCorridorRow,
  totalsByCurrency,
  varianceSeverity,
} from './pilotage.rules';

/** Statuts qui comptent dans l'activité (les envois annulés, échoués, remboursés ou expirés n'ont rien rapporté). */
const LIVE_STATUSES = ['PENDING', 'VALIDATED', 'PROCESSING', 'PAID'] as const;
const EARNING_STATUSES = ['VALIDATED', 'PROCESSING', 'PAID'] as const;
const EXPORT_MAX_ROWS = 20_000;
const DEFAULT_PERIOD_DAYS = 30;

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

@Injectable()
export class PilotageService {
  private readonly logger = new Logger(PilotageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  // ── Contexte ────────────────────────────────────────────

  private companyOf(user: AuthUserPayload): number {
    if (!user.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    return user.clientId;
  }

  private agentScope(user: AuthUserPayload): { clientId: number; agencyId: string; agentId: string } {
    const clientId = this.companyOf(user);
    if (!user.agencyId) throw new ForbiddenException("Votre compte n'est rattaché à aucune agence.");
    return { clientId, agencyId: user.agencyId, agentId: user.id };
  }

  private async audit(user: AuthUserPayload, clientId: number, action: 'CASH_CLOSING' | 'LIQUIDITY_RULE' | 'AGENT_TARGET', entity: string, entityId: string, details: Record<string, unknown>) {
    try {
      await this.prisma.auditLog.create({ data: { userId: user.id, clientId, action, entity, entityId, details: details as Prisma.InputJsonValue, successful: true } });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (${action}, ${entityId}) : ${(err as Error).message}`);
    }
  }

  private async notifyAdmins(clientId: number, title: string, message: string, type: 'WARNING' | 'INFO' = 'WARNING', metadata?: Record<string, unknown>) {
    try {
      const admins = await this.prisma.user.findMany({ where: { clientId, role: Role.COMPANY_ADMIN, isActive: true, deletedAt: null }, select: { id: true } });
      await Promise.all(admins.map((a) => this.notifications.create(a.id, title, message, type, metadata).catch(() => undefined)));
    } catch (err) {
      this.logger.error(`Notification non envoyée : ${(err as Error).message}`);
    }
  }

  // ═══════════════════════════════════════════════════════
  // 1. CLÔTURE DE CAISSE
  // ═══════════════════════════════════════════════════════

  /** Côté agent : soldes théoriques de la caisse de son agence et clôtures déjà faites aujourd'hui. */
  async closingToday(user: AuthUserPayload, tzRaw?: unknown) {
    const { clientId, agencyId } = this.agentScope(user);
    const tz = parseTzOffset(tzRaw);
    const day = localDay(new Date(), tz);
    const { from, to } = dayBounds(day, tz);

    const [agency, wallets, closings, ops] = await Promise.all([
      this.prisma.agency.findFirst({ where: { id: agencyId, clientId, deletedAt: null }, select: { id: true, name: true, city: true } }),
      this.prisma.wallet.findMany({ where: { agencyId, isActive: true }, orderBy: { currency: 'asc' } }),
      this.prisma.cashClosing.findMany({ where: { agencyId, day } }),
      this.prisma.transaction.groupBy({
        by: ['currency'],
        where: { clientId, agencyId, createdAt: { gte: from, lt: to }, status: { in: [...LIVE_STATUSES] } },
        _count: { _all: true },
      }),
    ]);
    if (!agency) throw new NotFoundException('Agence introuvable.');

    const opsBy = new Map(ops.map((o) => [String(o.currency), o._count._all]));
    return {
      day,
      agency,
      items: wallets.map((w) => {
        const currency = String(w.currency);
        const closing = closings.find((c) => String(c.currency) === currency) ?? null;
        return {
          currency,
          expectedAmount: round(num(w.balance), currency),
          opsCount: opsBy.get(currency) ?? 0,
          closing: closing ? this.closingView(closing) : null,
        };
      }),
    };
  }

  /** Côté agent : clôture (ou rectification tant que l'administrateur n'a pas examiné l'écart). */
  async closeCash(user: AuthUserPayload, dto: CloseCashDto) {
    const { clientId, agencyId, agentId } = this.agentScope(user);
    const currency = String(dto.currency);
    const tz = parseTzOffset(dto.tzOffsetMin);
    const day = localDay(new Date(), tz);
    const { from, to } = dayBounds(day, tz);

    const wallet = await this.prisma.wallet.findFirst({ where: { agencyId, currency: dto.currency, isActive: true } });
    if (!wallet) throw new NotFoundException(`Aucune caisse en ${currency} pour votre agence.`);

    const counted = parseCounted(dto.countedAmount, currency);
    const expected = round(num(wallet.balance), currency);
    const variance = computeVariance(counted, expected, currency);

    const existing = await this.prisma.cashClosing.findUnique({ where: { agencyId_day_currency: { agencyId, day, currency: dto.currency } } });
    if (existing?.reviewedAt) throw new ConflictException('Cette clôture a déjà été examinée par votre administrateur : elle ne peut plus être modifiée.');

    const [opsCount, byType] = await Promise.all([
      this.prisma.transaction.count({ where: { clientId, agencyId, currency: dto.currency, createdAt: { gte: from, lt: to }, status: { in: [...LIVE_STATUSES] } } }),
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: { clientId, agencyId, currency: dto.currency, createdAt: { gte: from, lt: to }, status: { in: [...LIVE_STATUSES] } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);
    const details = { byType: byType.map((t) => ({ type: String(t.type), count: t._count._all, amount: num(t._sum.amount) })) } as Prisma.InputJsonValue;
    const note = dto.note?.trim() ? dto.note.trim().slice(0, 300) : null;

    const data = { expectedAmount: expected, countedAmount: counted, variance, opsCount, note, details, agentId, tzOffsetMin: tz };
    const row = existing
      ? await this.prisma.cashClosing.update({ where: { id: existing.id }, data })
      : await this.prisma.cashClosing.create({ data: { ...data, clientId, agencyId, day, currency: dto.currency } });

    await this.syncVarianceAlert(user, row, existing?.id ?? null);
    await this.audit(user, clientId, 'CASH_CLOSING', 'CashClosing', row.id, { day, currency, expected, counted, variance, rectified: !!existing });
    return this.closingView(row);
  }

  private async syncVarianceAlert(user: AuthUserPayload, row: { id: string; clientId: number; agencyId: string; agentId: string; day: string; currency: unknown; variance: unknown; expectedAmount: unknown }, previousId: string | null) {
    try {
      if (previousId) await this.resolveClosingAlerts(row.clientId, row.id, 'system');
      const variance = num(row.variance);
      const currency = String(row.currency);
      const severity = varianceSeverity(variance, num(row.expectedAmount));
      if (severity === 'NONE') return;
      const agency = await this.prisma.agency.findUnique({ where: { id: row.agencyId }, select: { name: true } });
      const sign = variance < 0 ? 'Manque' : 'Excédent';
      const message = `${sign} de ${Math.abs(variance)} ${currency} à la clôture de caisse du ${row.day} (${agency?.name ?? 'agence'}).`;
      await this.prisma.alert.create({
        data: {
          clientId: row.clientId,
          userId: row.agentId,
          type: 'CASH_VARIANCE',
          severity: severity === 'LOW' ? 'LOW' : severity === 'MEDIUM' ? 'MEDIUM' : 'HIGH',
          title: 'Écart de caisse',
          message,
          metadata: { closingId: row.id, agencyId: row.agencyId, currency, variance, day: row.day } as Prisma.InputJsonValue,
        },
      });
      await this.notifyAdmins(row.clientId, 'Écart de caisse', message, 'WARNING', { closingId: row.id });
    } catch (err) {
      this.logger.error(`Alerte d'écart de caisse non créée : ${(err as Error).message}`);
    }
  }

  private async resolveClosingAlerts(clientId: number, closingId: string, by: string) {
    const open = await this.prisma.alert.findMany({ where: { clientId, type: 'CASH_VARIANCE', isResolved: false }, select: { id: true, metadata: true } });
    const ids = open.filter((a) => (a.metadata as { closingId?: string } | null)?.closingId === closingId).map((a) => a.id);
    if (ids.length) await this.prisma.alert.updateMany({ where: { id: { in: ids } }, data: { isResolved: true, resolvedAt: new Date(), resolvedBy: by } });
  }

  private closingView(c: {
    id: string; agencyId: string; agentId: string; day: string; currency: unknown; expectedAmount: unknown; countedAmount: unknown; variance: unknown;
    opsCount: number; note: string | null; reviewedAt: Date | null; reviewNote: string | null; closedAt: Date; details?: unknown;
  }) {
    const variance = num(c.variance);
    return {
      id: c.id,
      agencyId: c.agencyId,
      agentId: c.agentId,
      day: c.day,
      currency: String(c.currency),
      expectedAmount: num(c.expectedAmount),
      countedAmount: num(c.countedAmount),
      variance,
      severity: varianceSeverity(variance, num(c.expectedAmount)),
      opsCount: c.opsCount,
      note: c.note,
      reviewedAt: c.reviewedAt ? c.reviewedAt.toISOString() : null,
      reviewNote: c.reviewNote,
      closedAt: c.closedAt.toISOString(),
    };
  }

  /** Côté admin : clôtures d'un jour (ou d'une période) + caisses non clôturées du jour. */
  async listClosings(user: AuthUserPayload, q: { day?: string; from?: string; to?: string; tz?: unknown; onlyVariance?: string }) {
    const clientId = this.companyOf(user);
    const tz = parseTzOffset(q.tz);
    const today = localDay(new Date(), tz);
    const single = !q.from && !q.to;
    const fromDay = parseDay(single ? q.day ?? today : q.from ?? q.to);
    const toDay = parseDay(single ? fromDay : q.to ?? q.from);
    periodBounds(fromDay, toDay, tz); // refuse une période à l'envers ou trop longue

    const where: Prisma.CashClosingWhereInput = { clientId, day: { gte: fromDay, lte: toDay } };
    const rows = await this.prisma.cashClosing.findMany({ where, orderBy: [{ day: 'desc' }, { closedAt: 'desc' }], take: 1000 });
    const [agencies, agents] = await Promise.all([
      this.prisma.agency.findMany({ where: { clientId }, select: { id: true, name: true } }),
      this.prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.agentId))] } }, select: { id: true, firstName: true, lastName: true } }),
    ]);
    const agencyName = new Map(agencies.map((a) => [a.id, a.name]));
    const agentName = new Map(agents.map((a) => [a.id, `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim()]));
    let closings = rows.map((r) => ({ ...this.closingView(r), agencyName: agencyName.get(r.agencyId) ?? '—', agentName: agentName.get(r.agentId) ?? '—' }));
    if (q.onlyVariance === 'true') closings = closings.filter((c) => c.variance !== 0);

    // Caisses non clôturées : seulement pour un jour unique (les agences qui ont au moins un agent actif).
    let missing: { agencyId: string; agencyName: string; currency: string; expectedAmount: number }[] = [];
    if (single && fromDay <= today) {
      const live = await this.prisma.agency.findMany({
        where: { clientId, deletedAt: null, isActive: true, agents: { some: { role: Role.AGENT, isActive: true, deletedAt: null } } },
        select: { id: true, name: true, wallets: { where: { isActive: true }, select: { currency: true, balance: true } } },
      });
      const done = new Set(rows.map((r) => `${r.agencyId}:${String(r.currency)}`));
      missing = live.flatMap((a) =>
        a.wallets
          .filter((w) => !done.has(`${a.id}:${String(w.currency)}`))
          .map((w) => ({ agencyId: a.id, agencyName: a.name, currency: String(w.currency), expectedAmount: round(num(w.balance), String(w.currency)) })),
      );
    }

    return {
      from: fromDay,
      to: toDay,
      closings,
      missing,
      summary: {
        count: closings.length,
        withVariance: closings.filter((c) => c.variance !== 0).length,
        toReview: closings.filter((c) => c.variance !== 0 && !c.reviewedAt).length,
        missing: missing.length,
      },
    };
  }

  async reviewClosing(user: AuthUserPayload, id: string, dto: ReviewClosingDto) {
    const clientId = this.companyOf(user);
    const row = await this.prisma.cashClosing.findFirst({ where: { id, clientId } });
    if (!row) throw new NotFoundException('Clôture introuvable.');
    const updated = await this.prisma.cashClosing.update({
      where: { id },
      data: { reviewedAt: new Date(), reviewedById: user.id, reviewNote: dto.note?.trim() ? dto.note.trim().slice(0, 300) : null },
    });
    await this.resolveClosingAlerts(clientId, id, user.id);
    await this.audit(user, clientId, 'CASH_CLOSING', 'CashClosing', id, { kind: 'REVIEW', variance: num(row.variance) });
    return this.closingView(updated);
  }

  // ═══════════════════════════════════════════════════════
  // 2. LIQUIDITÉ
  // ═══════════════════════════════════════════════════════

  private async liquidityRows(clientId: number) {
    const [rules, agencies] = await Promise.all([
      this.prisma.liquidityRule.findMany({ where: { clientId }, orderBy: [{ currency: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.agency.findMany({
        where: { clientId, deletedAt: null, isActive: true },
        select: { id: true, name: true, city: true, wallets: { where: { isActive: true }, select: { currency: true, balance: true, reservedBalance: true } } },
        orderBy: { name: 'asc' },
      }),
    ]);
    const numeric = rules.map((r) => ({ agencyId: r.agencyId, currency: String(r.currency), minBalance: num(r.minBalance), isActive: r.isActive }));
    const items = agencies.flatMap((a) =>
      a.wallets.map((w) => {
        const currency = String(w.currency);
        const balance = round(num(w.balance), currency);
        const minBalance = pickMinBalance(numeric, a.id, currency);
        return {
          agencyId: a.id,
          agencyName: a.name,
          city: a.city,
          currency,
          balance,
          reserved: round(num(w.reservedBalance), currency),
          minBalance,
          level: liquidityLevel(balance, minBalance),
        };
      }),
    );
    return { rules, agencies, items };
  }

  async liquidity(user: AuthUserPayload) {
    const clientId = this.companyOf(user);
    const { rules, agencies, items } = await this.liquidityRows(clientId);
    const order = { CRITICAL: 0, LOW: 1, WARN: 2, OK: 3 } as const;
    items.sort((a, b) => order[a.level] - order[b.level] || a.agencyName.localeCompare(b.agencyName, 'fr'));
    const name = new Map(agencies.map((a) => [a.id, a.name]));
    return {
      items,
      rules: rules.map((r) => ({
        id: r.id,
        agencyId: r.agencyId,
        agencyName: r.agencyId ? name.get(r.agencyId) ?? '—' : null,
        currency: String(r.currency),
        minBalance: num(r.minBalance),
        isActive: r.isActive,
      })),
      summary: {
        critical: items.filter((i) => i.level === 'CRITICAL').length,
        low: items.filter((i) => i.level === 'LOW').length,
        warn: items.filter((i) => i.level === 'WARN').length,
        ok: items.filter((i) => i.level === 'OK').length,
      },
    };
  }

  async upsertRule(user: AuthUserPayload, dto: UpsertLiquidityRuleDto) {
    const clientId = this.companyOf(user);
    const currency = String(dto.currency);
    const min = parseCounted(dto.minBalance, currency);
    if (!(min > 0)) throw new BadRequestException('Le seuil doit être supérieur à zéro.');
    const agencyId = dto.agencyId ? dto.agencyId : null;
    if (agencyId && !(await this.prisma.agency.findFirst({ where: { id: agencyId, clientId, deletedAt: null }, select: { id: true } }))) {
      throw new NotFoundException('Agence introuvable.');
    }
    const existing = await this.prisma.liquidityRule.findFirst({ where: { clientId, agencyId, currency: dto.currency } });
    const row = existing
      ? await this.prisma.liquidityRule.update({ where: { id: existing.id }, data: { minBalance: min, isActive: dto.isActive ?? true } })
      : await this.prisma.liquidityRule.create({ data: { clientId, agencyId, currency: dto.currency, minBalance: min, isActive: dto.isActive ?? true } });
    await this.audit(user, clientId, 'LIQUIDITY_RULE', 'LiquidityRule', row.id, { agencyId, currency, minBalance: min, isActive: row.isActive });
    // Évaluation immédiate : l'admin voit tout de suite l'effet du nouveau seuil.
    await this.evaluateClient(clientId).catch(() => undefined);
    return { id: row.id, agencyId: row.agencyId, currency, minBalance: min, isActive: row.isActive };
  }

  async deleteRule(user: AuthUserPayload, id: string) {
    const clientId = this.companyOf(user);
    const row = await this.prisma.liquidityRule.findFirst({ where: { id, clientId } });
    if (!row) throw new NotFoundException('Seuil introuvable.');
    await this.prisma.liquidityRule.delete({ where: { id } });
    await this.audit(user, clientId, 'LIQUIDITY_RULE', 'LiquidityRule', id, { kind: 'DELETE', agencyId: row.agencyId, currency: String(row.currency) });
    return { ok: true };
  }

  /** Crée une alerte (une seule ouverte par agence et devise) quand une caisse passe sous son seuil ; la referme quand elle remonte. */
  async evaluateClient(clientId: number): Promise<number> {
    const { items } = await this.liquidityRows(clientId);
    const open = await this.prisma.alert.findMany({ where: { clientId, type: 'LOW_AGENCY_BALANCE', isResolved: false }, select: { id: true, metadata: true } });
    const keyOf = (m: unknown) => {
      const meta = (m ?? {}) as { agencyId?: string; currency?: string };
      return `${meta.agencyId}:${meta.currency}`;
    };
    const openByKey = new Map(open.map((a) => [keyOf(a.metadata), a.id]));
    let created = 0;

    for (const it of items) {
      const key = `${it.agencyId}:${it.currency}`;
      if (needsLiquidityAlert(it.level)) {
        if (openByKey.has(key)) continue;
        const critical = it.level === 'CRITICAL';
        const message = `La caisse de ${it.agencyName} en ${it.currency} est ${critical ? 'presque vide' : 'sous son seuil'} : ${it.balance} (seuil ${it.minBalance}).`;
        await this.prisma.alert.create({
          data: {
            clientId,
            type: 'LOW_AGENCY_BALANCE',
            severity: liquiditySeverity(it.level),
            title: 'Liquidité faible',
            message,
            metadata: { agencyId: it.agencyId, currency: it.currency, balance: it.balance, minBalance: it.minBalance } as Prisma.InputJsonValue,
          },
        });
        await this.prisma.liquidityRule.updateMany({ where: { clientId, currency: it.currency as CurrencyCode, OR: [{ agencyId: it.agencyId }, { agencyId: null }] }, data: { lastAlertAt: new Date() } });
        await this.notifyAdmins(clientId, 'Liquidité faible', message, 'WARNING', { agencyId: it.agencyId, currency: it.currency });
        created++;
      } else if (openByKey.has(key) && (it.level === 'OK' || it.level === 'WARN')) {
        await this.prisma.alert.update({ where: { id: openByKey.get(key)! }, data: { isResolved: true, resolvedAt: new Date(), resolvedBy: 'system' } });
      }
    }
    return created;
  }

  /** Passage planifié : toutes les sociétés qui ont au moins un seuil actif. */
  async evaluateAll(): Promise<number> {
    const clients = await this.prisma.liquidityRule.findMany({ where: { isActive: true }, distinct: ['clientId'], select: { clientId: true } });
    let total = 0;
    for (const c of clients) {
      try {
        total += await this.evaluateClient(c.clientId);
      } catch (err) {
        this.logger.error(`Contrôle de liquidité (société ${c.clientId}) : ${(err as Error).message}`);
      }
    }
    return total;
  }

  // ═══════════════════════════════════════════════════════
  // 3. RENTABILITÉ PAR COULOIR
  // ═══════════════════════════════════════════════════════

  private period(q: { from?: string; to?: string; tz?: unknown }) {
    const tz = parseTzOffset(q.tz);
    const today = localDay(new Date(), tz);
    const toDay = q.to ? parseDay(q.to) : today;
    const fromDay = q.from ? parseDay(q.from) : localDay(new Date(Date.now() - (DEFAULT_PERIOD_DAYS - 1) * 86_400_000), tz);
    const { from, to } = periodBounds(fromDay, toDay, tz);
    return { fromDay, toDay, from, to, tz };
  }

  private async corridors(clientId: number, from: Date, to: Date): Promise<CorridorRow[]> {
    const groups = await this.prisma.transaction.groupBy({
      by: ['currency', 'targetCurrency'],
      where: { clientId, type: 'TRANSFER', direction: 'OUTBOUND', deletedAt: null, status: { in: [...EARNING_STATUSES] }, createdAt: { gte: from, lt: to } },
      _count: { _all: true },
      _sum: { amount: true, fees: true, receivedAmount: true, senderCommission: true, payerCommission: true, platformCommission: true },
    });
    const gains = await this.fxGains(clientId, from, to);
    return groups
      .map((g) =>
        toCorridorRow({
          currency: String(g.currency),
          targetCurrency: g.targetCurrency ? String(g.targetCurrency) : null,
          count: g._count._all,
          sent: num(g._sum.amount),
          received: num(g._sum.receivedAmount),
          fees: num(g._sum.fees),
          agentCommissions: num(g._sum.senderCommission) + num(g._sum.payerCommission),
          platformShare: num(g._sum.platformCommission),
          fxGain: gains.get(`${String(g.currency)}|${g.targetCurrency ? String(g.targetCurrency) : ''}`) ?? 0,
        }),
      )
      .sort((a, b) => b.net - a.net);
  }

  /** Gain de change estimé par couloir : Σ montant envoyé × marge de la société appliquée à l'opération (devise d'envoi). */
  private async fxGains(clientId: number, from: Date, to: Date): Promise<Map<string, number>> {
    const rows = await this.prisma.transaction.findMany({
      where: { clientId, type: 'TRANSFER', direction: 'OUTBOUND', deletedAt: null, status: { in: [...EARNING_STATUSES] }, createdAt: { gte: from, lt: to }, fxMarginPct: { not: null } },
      select: { currency: true, targetCurrency: true, amount: true, fxMarginPct: true },
    });
    const out = new Map<string, number>();
    for (const r of rows) {
      const cur = String(r.currency);
      const key = `${cur}|${r.targetCurrency ? String(r.targetCurrency) : ''}`;
      out.set(key, round((out.get(key) ?? 0) + fxMarginGain(num(r.amount), num(r.fxMarginPct)), cur));
    }
    return out;
  }

  async profitability(user: AuthUserPayload, q: { from?: string; to?: string; tz?: unknown }) {
    const clientId = this.companyOf(user);
    const p = this.period(q);
    const corridors = await this.corridors(clientId, p.from, p.to);
    return { from: p.fromDay, to: p.toDay, corridors, totals: totalsByCurrency(corridors) };
  }

  // ═══════════════════════════════════════════════════════
  // 4. OBJECTIFS ET CLASSEMENT DES AGENTS
  // ═══════════════════════════════════════════════════════

  async agentsBoard(user: AuthUserPayload, q: { month?: string; tz?: unknown }) {
    const clientId = this.companyOf(user);
    const tz = parseTzOffset(q.tz);
    return this.boardFor(clientId, parseMonth(q.month, new Date(), tz), tz);
  }

  private async boardFor(clientId: number, month: string, tz: number) {
    const { from, to } = monthBounds(month, tz);

    const agents = await this.prisma.user.findMany({
      where: { clientId, role: Role.AGENT, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, isActive: true, agency: { select: { name: true } } },
    });
    const ids = agents.map((a) => a.id);
    const [groups, targets] = await Promise.all([
      ids.length
        ? this.prisma.transaction.groupBy({
            by: ['senderId', 'currency'],
            where: { clientId, senderId: { in: ids }, type: { in: ['TRANSFER', 'DEPOSIT'] }, status: { in: [...EARNING_STATUSES] }, createdAt: { gte: from, lt: to }, deletedAt: null },
            _count: { _all: true },
            _sum: { amount: true, fees: true },
          })
        : Promise.resolve([]),
      this.prisma.agentTarget.findMany({ where: { clientId, month } }),
    ]);

    const activity = new Map<string, AgentActivity>();
    for (const g of groups) {
      const a = activity.get(g.senderId) ?? { agentId: g.senderId, operations: 0, volume: {}, fees: {} };
      const cur = String(g.currency);
      a.operations += g._count._all;
      a.volume[cur] = round((a.volume[cur] ?? 0) + num(g._sum.amount), cur);
      a.fees[cur] = round((a.fees[cur] ?? 0) + num(g._sum.fees), cur);
      activity.set(g.senderId, a);
    }

    const rows = agents.map((ag) => {
      const act = activity.get(ag.id) ?? { agentId: ag.id, operations: 0, volume: {}, fees: {} };
      const t = targets.find((x) => x.agentId === ag.id) ?? null;
      const target = t ? { currency: String(t.currency), targetAmount: num(t.targetAmount), targetOperations: t.targetOperations } : null;
      return {
        agentId: ag.id,
        name: `${ag.firstName ?? ''} ${ag.lastName ?? ''}`.trim() || '—',
        agencyName: ag.agency?.name ?? null,
        isActive: ag.isActive,
        operations: act.operations,
        volume: act.volume,
        fees: act.fees,
        target,
        progress: targetProgress(act, target),
      };
    });
    return { month, rows: rankAgents(rows) };
  }

  async upsertTarget(user: AuthUserPayload, agentId: string, dto: UpsertTargetDto) {
    const clientId = this.companyOf(user);
    const agent = await this.prisma.user.findFirst({ where: { id: agentId, clientId, role: Role.AGENT, deletedAt: null }, select: { id: true } });
    if (!agent) throw new NotFoundException('Agent introuvable.');
    const month = parseMonth(dto.month);
    const t = parseTarget({ currency: dto.currency, targetAmount: dto.targetAmount, targetOperations: dto.targetOperations });
    const row = await this.prisma.agentTarget.upsert({
      where: { agentId_month: { agentId, month } },
      create: { clientId, agentId, month, currency: dto.currency, targetAmount: t.targetAmount, targetOperations: t.targetOperations },
      update: { currency: dto.currency, targetAmount: t.targetAmount, targetOperations: t.targetOperations },
    });
    await this.audit(user, clientId, 'AGENT_TARGET', 'AgentTarget', row.id, { agentId, month, ...t });
    return { agentId, month, currency: t.currency, targetAmount: t.targetAmount, targetOperations: t.targetOperations };
  }

  async deleteTarget(user: AuthUserPayload, agentId: string, monthRaw: string) {
    const clientId = this.companyOf(user);
    const month = parseMonth(monthRaw);
    const res = await this.prisma.agentTarget.deleteMany({ where: { agentId, clientId, month } });
    if (res.count) await this.audit(user, clientId, 'AGENT_TARGET', 'AgentTarget', agentId, { kind: 'DELETE', month });
    return { ok: true };
  }

  // ═══════════════════════════════════════════════════════
  // 5. EXPORTS COMPTABLES
  // ═══════════════════════════════════════════════════════

  async exportTransactionsCsv(user: AuthUserPayload, q: { from?: string; to?: string; tz?: unknown }): Promise<{ filename: string; csv: string }> {
    const clientId = this.companyOf(user);
    const p = this.period(q);
    const rows = await this.prisma.transaction.findMany({
      where: { clientId, deletedAt: null, createdAt: { gte: p.from, lt: p.to } },
      orderBy: { createdAt: 'asc' },
      take: EXPORT_MAX_ROWS + 1,
      select: {
        createdAt: true, reference: true, type: true, status: true, currency: true, amount: true, fees: true, total: true, targetCurrency: true, receivedAmount: true,
        exchangeRate: true, senderCommission: true, payerCommission: true, platformCommission: true, payoutMethod: true,
        agency: { select: { name: true } }, sender: { select: { firstName: true, lastName: true } },
      },
    });
    if (rows.length > EXPORT_MAX_ROWS) throw new BadRequestException(`Trop d'opérations (plus de ${EXPORT_MAX_ROWS}) : réduisez la période.`);
    const shift = p.tz * 60_000;
    const csv = toCsv(
      ['Date', 'Heure', 'Référence', 'Type', 'Statut', 'Agence', 'Agent / expéditeur', 'Devise', 'Montant', 'Frais', 'Total', 'Devise reçue', 'Montant reçu', 'Taux', 'Commission expéditeur', 'Commission payeur', 'Part plateforme', 'Mode de retrait'],
      rows.map((r) => {
        const local = new Date(r.createdAt.getTime() + shift).toISOString();
        return [
          local.slice(0, 10), local.slice(11, 19), r.reference, String(r.type), String(r.status), r.agency?.name ?? '',
          `${r.sender?.firstName ?? ''} ${r.sender?.lastName ?? ''}`.trim(), String(r.currency), num(r.amount), num(r.fees), num(r.total),
          r.targetCurrency ? String(r.targetCurrency) : '', r.receivedAmount === null ? null : num(r.receivedAmount), r.exchangeRate ?? null,
          r.senderCommission === null ? null : num(r.senderCommission), r.payerCommission === null ? null : num(r.payerCommission),
          r.platformCommission === null ? null : num(r.platformCommission), String(r.payoutMethod),
        ];
      }),
    );
    return { filename: `operations_${p.fromDay}_${p.toDay}.csv`, csv };
  }

  async exportClosingsCsv(user: AuthUserPayload, q: { from?: string; to?: string; tz?: unknown }): Promise<{ filename: string; csv: string }> {
    const p = this.period(q);
    const data = await this.listClosings(user, { from: p.fromDay, to: p.toDay, tz: p.tz });
    const csv = toCsv(
      ['Jour', 'Agence', 'Agent', 'Devise', 'Solde théorique', 'Espèces comptées', 'Écart', 'Opérations', 'Note agent', 'Examiné le', 'Note administrateur'],
      data.closings.map((c) => [c.day, c.agencyName, c.agentName, c.currency, c.expectedAmount, c.countedAmount, c.variance, c.opsCount, c.note, c.reviewedAt ? c.reviewedAt.slice(0, 10) : '', c.reviewNote]),
    );
    return { filename: `clotures_caisse_${p.fromDay}_${p.toDay}.csv`, csv };
  }

  async exportProfitabilityCsv(user: AuthUserPayload, q: { from?: string; to?: string; tz?: unknown }): Promise<{ filename: string; csv: string }> {
    const clientId = this.companyOf(user);
    const p = this.period(q);
    const corridors = await this.corridors(clientId, p.from, p.to);
    const csv = toCsv(
      ['Couloir', 'Opérations', 'Montant envoyé', 'Montant reçu', 'Frais perçus', 'Gain de change', 'Commissions agents', 'Part plateforme', 'Marge nette estimée', 'Marge %'],
      corridors.map((c) => [c.corridor, c.count, c.sent, c.received, c.fees, c.fxGain, c.agentCommissions, c.platformShare, c.net, c.marginPct]),
    );
    return { filename: `rentabilite_${p.fromDay}_${p.toDay}.csv`, csv };
  }

  // ═══════════════════════════════════════════════════════
  // 6. RAPPORT MENSUEL
  // ═══════════════════════════════════════════════════════

  async monthlyReport(clientId: number, month: string, tz = 0) {
    const { from, to } = monthBounds(month, tz);
    const [corridors, closings, board] = await Promise.all([
      this.corridors(clientId, from, to),
      this.prisma.cashClosing.findMany({ where: { clientId, day: { gte: `${month}-01`, lte: `${month}-31` } }, select: { variance: true, currency: true, reviewedAt: true } }),
      this.boardFor(clientId, month, tz),
    ]);
    const withVariance = closings.filter((c) => num(c.variance) !== 0);
    return {
      month,
      totals: totalsByCurrency(corridors),
      corridors: corridors.slice(0, 5),
      topAgents: board.rows.filter((r) => r.operations > 0).slice(0, 5),
      closings: { count: closings.length, withVariance: withVariance.length, unreviewed: withVariance.filter((c) => !c.reviewedAt).length },
    };
  }

  /** Le 1er de chaque mois : envoie le rapport du mois écoulé aux administrateurs de chaque société active. */
  async sendMonthlyReports(now = new Date()): Promise<number> {
    const month = previousMonth(now);
    const clients = await this.prisma.client.findMany({ where: { isActive: true }, select: { id: true, name: true } });
    let sent = 0;
    for (const c of clients) {
      try {
        const admins = await this.prisma.user.findMany({ where: { clientId: c.id, role: Role.COMPANY_ADMIN, isActive: true, deletedAt: null }, select: { email: true, firstName: true } });
        if (!admins.length) continue;
        const report = await this.monthlyReport(c.id, month);
        if (!report.totals.length && !report.closings.count) continue; // rien à dire : pas de courriel
        const html = this.reportHtml(c.name ?? 'Votre société', report);
        for (const a of admins) {
          if (!a.email) continue;
          await this.mail.sendEmail({ to: a.email, subject: `Rapport d'activité ${month} — ${c.name ?? ''}`.trim(), htmlContent: html });
          sent++;
        }
      } catch (err) {
        this.logger.error(`Rapport mensuel (société ${c.id}) : ${(err as Error).message}`);
      }
    }
    return sent;
  }

  private reportHtml(company: string, r: Awaited<ReturnType<PilotageService['monthlyReport']>>): string {
    const money = (n: number, cur: string) => `${n.toLocaleString('fr-FR')} ${cur}`;
    const totals = r.totals.map((t) => `<tr><td>${esc(t.currency)}</td><td>${t.count}</td><td>${esc(money(t.sent, t.currency))}</td><td>${esc(money(t.fees, t.currency))}</td><td>${esc(money(t.fxGain, t.currency))}</td><td><b>${esc(money(t.net, t.currency))}</b></td></tr>`).join('');
    const agents = r.topAgents.map((a) => `<li>${esc(a.name)} — ${a.operations} opération(s)</li>`).join('');
    return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1c2a22">
<h2 style="margin:0 0 4px">Rapport d'activité — ${esc(r.month)}</h2><p style="margin:0 0 16px;color:#5b6b61">${esc(company)}</p>
<table style="width:100%;border-collapse:collapse;font-size:14px" border="0" cellpadding="6"><tr style="background:#eef3ef"><th align="left">Devise</th><th align="left">Envois</th><th align="left">Volume</th><th align="left">Frais</th><th align="left">Gain de change</th><th align="left">Marge nette est.</th></tr>${totals || '<tr><td colspan="6">Aucun envoi ce mois-ci.</td></tr>'}</table>
${agents ? `<h3>Meilleurs agents</h3><ol>${agents}</ol>` : ''}
<p>Clôtures de caisse : ${r.closings.count} (dont ${r.closings.withVariance} avec écart, ${r.closings.unreviewed} à examiner).</p>
<p style="color:#5b6b61;font-size:12px">La marge nette est une estimation : frais perçus et gain de change (marge de change de la société), moins commissions des agents et part de la plateforme.</p></div>`;
  }
}

