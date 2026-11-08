// apps/backend/src/merchants/merchant-reports.service.ts
// =========================================================
// RAPPORTS, EXPORT ET CLÔTURE DE CAISSE (lot 13) — réservé au propriétaire du commerce.
//   GET  /merchants/me/report?from=&to=&tz=       encaissements et remboursements d'une période : totaux par devise + lignes (JSON)
//   GET  /merchants/me/report.csv?from=&to=&tz=   mêmes lignes en CSV (Excel en français : « ; », virgule décimale, accents)
//   GET  /merchants/me/closing?day=&tz=           journée : totaux en direct + clôtures déjà faites
//   POST /merchants/me/closing { day, tz, pin }   clôture la journée : photo FIGÉE des totaux (une seule fois par jour et par devise)
//   GET  /merchants/me/closings                   journées déjà clôturées
// Le jour est celui de l'appareil (décalage de fuseau `tz` en minutes), pas celui du serveur.
// Les reçus PDF sont produits par l'application à partir du détail d'un paiement (aucune donnée de plus que ce que le client voit).
// =========================================================

import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import {
  aggregate,
  dayBounds,
  localDay,
  methodOf,
  parseDay,
  parseTzOffset,
  periodBounds,
  REPORT_MAX_ROWS,
  toCsv,
  type CurrencyTotals,
  type RefundRow,
  type SaleRow,
} from './merchant-extras';
import { formatMoney, MerchantNotifierService } from './merchant-notifier.service';
import { MerchantsService } from './merchants.service';
import { PinVerifierService } from './pin-verifier.service';

const METHOD_LABEL = { PHONE: 'Téléphone', QR: 'QR code', STATIC_QR: 'QR de caisse' } as const;

const personName = (u: { firstName?: string | null; lastName?: string | null } | null | undefined): string => [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim();

interface Loaded {
  sales: {
    id: string;
    reference: string;
    paidAt: Date | null;
    currency: string;
    amount: Prisma.Decimal;
    fee: Prisma.Decimal;
    netAmount: Prisma.Decimal;
    method: string;
    viaStaticQr: boolean;
    createdById: string | null;
    note: string | null;
    payerPhone: string | null;
    refundedAt: Date | null;
    payer: { firstName: string | null; lastName: string | null } | null;
  }[];
  refunds: { id: string; reference: string; refundedAt: Date | null; currency: string; amount: Prisma.Decimal; refundReason: string | null; payer: { firstName: string | null; lastName: string | null } | null }[];
  names: Map<string, string>;
  truncated: boolean;
}

@Injectable()
export class MerchantReportsService {
  private readonly logger = new Logger(MerchantReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly merchants: MerchantsService,
    private readonly pins: PinVerifierService,
    private readonly notifier: MerchantNotifierService,
  ) {}

  private async load(ownerId: string, from: Date, to: Date): Promise<Loaded> {
    const [sales, refunds] = await Promise.all([
      this.prisma.paymentRequest.findMany({
        where: { payeeId: ownerId, status: 'PAID', paidAt: { gte: from, lt: to } },
        select: {
          id: true, reference: true, paidAt: true, currency: true, amount: true, fee: true, netAmount: true, method: true, viaStaticQr: true, createdById: true, note: true, payerPhone: true, refundedAt: true,
          payer: { select: { firstName: true, lastName: true } },
        },
        orderBy: { paidAt: 'asc' },
        take: REPORT_MAX_ROWS + 1,
      }),
      this.prisma.paymentRequest.findMany({
        where: { payeeId: ownerId, refundedAt: { gte: from, lt: to } },
        select: { id: true, reference: true, refundedAt: true, currency: true, amount: true, refundReason: true, payer: { select: { firstName: true, lastName: true } } },
        orderBy: { refundedAt: 'asc' },
        take: REPORT_MAX_ROWS + 1,
      }),
    ]);
    const truncated = sales.length > REPORT_MAX_ROWS || refunds.length > REPORT_MAX_ROWS;
    const ids = [...new Set(sales.map((s) => s.createdById).filter((x): x is string => !!x))];
    const users = ids.length ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, email: true } }) : [];
    const names = new Map(users.map((u) => [u.id, personName(u) || u.email]));
    return { sales: sales.slice(0, REPORT_MAX_ROWS), refunds: refunds.slice(0, REPORT_MAX_ROWS), names, truncated };
  }

  private totals(l: Loaded): (CurrencyTotals & { byCashierNamed: { userId: string | null; name: string; count: number; gross: number }[] })[] {
    const sales: SaleRow[] = l.sales.map((s) => ({ currency: s.currency, amount: Number(s.amount), fee: Number(s.fee), netAmount: Number(s.netAmount), method: s.method, viaStaticQr: s.viaStaticQr, createdById: s.createdById }));
    const refunds: RefundRow[] = l.refunds.map((r) => ({ currency: r.currency, amount: Number(r.amount) }));
    return aggregate(sales, refunds).map((t) => ({
      ...t,
      byCashierNamed: t.byCashier.map((c) => ({ ...c, name: c.userId ? (l.names.get(c.userId) ?? 'Caissier') : 'Propriétaire' })),
    }));
  }

  // ── Période ────────────────────────────────────────────

  async report(user: AuthUserPayload, q: { from?: string; to?: string; tz?: unknown }) {
    const { profile } = await this.merchants.assertActiveMerchant(user.id);
    const tz = parseTzOffset(q.tz);
    const today = localDay(new Date(), tz);
    const fromDay = parseDay(q.from ?? today);
    const toDay = parseDay(q.to ?? fromDay);
    const { from, to } = periodBounds(fromDay, toDay, tz);
    const l = await this.load(user.id, from, to);
    return {
      shop: { id: profile.id, businessName: profile.businessName, city: profile.city },
      period: { from: fromDay, to: toDay, tz },
      totals: this.totals(l),
      truncated: l.truncated,
      payments: l.sales.map((s) => ({
        id: s.id,
        reference: s.reference,
        at: s.paidAt?.toISOString() ?? null,
        currency: s.currency,
        amount: Number(s.amount),
        fee: Number(s.fee),
        net: Number(s.netAmount),
        method: methodOf(s),
        payer: personName(s.payer) || s.payerPhone || null,
        cashier: s.createdById ? (l.names.get(s.createdById) ?? 'Caissier') : null,
        note: s.note,
        refunded: !!s.refundedAt,
      })),
      refunds: l.refunds.map((r) => ({ id: r.id, reference: r.reference, at: r.refundedAt?.toISOString() ?? null, currency: r.currency, amount: Number(r.amount), payer: personName(r.payer) || null, reason: r.refundReason })),
    };
  }

  /** CSV : une ligne par paiement et par remboursement, dans l'ordre du temps. Les montants du remboursement sont en négatif. */
  async csv(user: AuthUserPayload, q: { from?: string; to?: string; tz?: unknown }): Promise<{ filename: string; body: string }> {
    const r = await this.report(user, q);
    const rows: (string | number | null)[][] = [];
    const stamp = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + r.period.tz * 60_000).toISOString().replace('T', ' ').slice(0, 19) : '');
    for (const p of r.payments) {
      rows.push([stamp(p.at), 'Paiement', p.reference, METHOD_LABEL[p.method], p.payer, p.cashier ?? '', p.amount, p.fee, p.net, p.currency, p.refunded ? 'Remboursé' : '', p.note]);
    }
    for (const f of r.refunds) {
      rows.push([stamp(f.at), 'Remboursement', f.reference, '', f.payer, '', -f.amount, 0, -f.amount, f.currency, '', f.reason]);
    }
    rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    const body = toCsv(['Date (heure locale)', 'Type', 'Référence', 'Moyen', 'Client', 'Caissier', 'Montant', 'Commission', 'Net', 'Devise', 'Statut', 'Libellé / motif'], rows);
    return { filename: `encaissements_${r.period.from}_${r.period.to}.csv`, body };
  }

  // ── Clôture de journée ─────────────────────────────────

  private closingView(c: { id: string; day: string; currency: string; paymentsCount: number; gross: Prisma.Decimal; fees: Prisma.Decimal; net: Prisma.Decimal; refundsCount: number; refundsTotal: Prisma.Decimal; details: Prisma.JsonValue | null; closedAt: Date }) {
    const net = Number(c.net);
    const refunds = Number(c.refundsTotal);
    return {
      id: c.id,
      day: c.day,
      currency: c.currency,
      count: c.paymentsCount,
      gross: Number(c.gross),
      fees: Number(c.fees),
      net,
      refundsCount: c.refundsCount,
      refundsTotal: refunds,
      balanceChange: net - refunds,
      details: c.details ?? null,
      closedAt: c.closedAt.toISOString(),
    };
  }

  /** Totaux en direct de la journée + clôtures déjà faites + écart éventuel (paiements arrivés APRÈS la clôture). */
  async day(user: AuthUserPayload, q: { day?: string; tz?: unknown }) {
    const { profile } = await this.merchants.assertActiveMerchant(user.id);
    const tz = parseTzOffset(q.tz);
    const day = parseDay(q.day ?? localDay(new Date(), tz));
    const { from, to } = dayBounds(day, tz);
    const [l, closed] = await Promise.all([this.load(user.id, from, to), this.prisma.merchantClosing.findMany({ where: { merchantId: profile.id, day }, orderBy: { currency: 'asc' } })]);
    const live = this.totals(l);
    const closings = closed.map((c) => this.closingView(c));
    return {
      shop: { id: profile.id, businessName: profile.businessName },
      day,
      tz,
      live,
      closings,
      // Une journée clôturée dont les totaux en direct ont changé depuis (paiement tardif, remboursement après coup).
      drift: closings.some((c) => {
        const t = live.find((x) => x.currency === c.currency);
        return !t || t.count !== c.count || t.refundsCount !== c.refundsCount || t.net !== c.net;
      }),
    };
  }

  async close(user: AuthUserPayload, dto: { day: string; tz?: number; pin: string }) {
    const { profile } = await this.merchants.assertActiveMerchant(user.id);
    const tz = parseTzOffset(dto.tz);
    const day = parseDay(dto.day);
    const today = localDay(new Date(), tz);
    if (day > today) throw new BadRequestException("Vous ne pouvez pas clôturer une journée qui n'a pas encore eu lieu.");
    await this.pins.assertPin(user.id, dto.pin);

    const { from, to } = dayBounds(day, tz);
    const l = await this.load(user.id, from, to);
    if (l.truncated) throw new BadRequestException('Trop d’opérations pour cette journée. Contactez le service client.');
    const totals = this.totals(l);
    if (totals.length === 0) throw new BadRequestException('Aucun encaissement ni remboursement ce jour-là : rien à clôturer.');

    const already = await this.prisma.merchantClosing.findMany({ where: { merchantId: profile.id, day }, select: { currency: true } });
    const done = new Set<string>(already.map((a) => a.currency));
    const todo = totals.filter((t) => !done.has(t.currency));
    if (todo.length === 0) throw new ConflictException('Cette journée est déjà clôturée.');

    try {
      await this.prisma.$transaction(
        todo.map((t) =>
          this.prisma.merchantClosing.create({
            data: {
              merchantId: profile.id,
              day,
              tzOffsetMin: tz,
              currency: t.currency as never,
              paymentsCount: t.count,
              gross: t.gross,
              fees: t.fees,
              net: t.net,
              refundsCount: t.refundsCount,
              refundsTotal: t.refundsTotal,
              details: { byMethod: t.byMethod, byCashier: t.byCashierNamed.map((c) => ({ name: c.name, count: c.count, gross: c.gross })) } as Prisma.InputJsonValue,
              closedById: user.id,
            },
          }),
        ),
      );
    } catch (err) {
      if ((err as { code?: string })?.code === 'P2002') throw new ConflictException('Cette journée est déjà clôturée.');
      throw err;
    }
    try {
      await this.prisma.auditLog.create({
        data: { userId: user.id, clientId: profile.clientId, action: 'MERCHANT_CLOSING', entity: 'MerchantProfile', entityId: profile.id, details: { day, currencies: todo.map((t) => t.currency) } as Prisma.InputJsonValue, successful: true },
      });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (MERCHANT_CLOSING, ${profile.id}) : ${(err as Error).message}`);
    }
    const u = await this.prisma.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, firstName: true } });
    if (u) {
      const lines = todo.map((t) => `${formatMoney(t.balanceChange, t.currency)} (${t.count} paiement${t.count > 1 ? 's' : ''}${t.refundsCount ? `, ${t.refundsCount} remboursement${t.refundsCount > 1 ? 's' : ''}` : ''})`).join(' · ');
      await this.notifier.notifyUser(u, {
        kind: 'DAY_CLOSED',
        title: `Journée du ${day.split('-').reverse().join('/')} clôturée`,
        body: `Variation du solde : ${lines}.`,
        actionUrl: '/merchant/closing',
        actionLabel: 'Clôture de caisse',
        type: 'SUCCESS',
        email: true,
      });
    }
    return this.day(user, { day, tz });
  }

  async closings(user: AuthUserPayload, limit = 30) {
    const { profile } = await this.merchants.assertActiveMerchant(user.id);
    const rows = await this.prisma.merchantClosing.findMany({ where: { merchantId: profile.id }, orderBy: [{ day: 'desc' }, { currency: 'asc' }], take: Math.min(Math.max(1, limit), 120) });
    return { data: rows.map((c) => this.closingView(c)) };
  }
}
