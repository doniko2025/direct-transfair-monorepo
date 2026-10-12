// apps/backend/src/agent-desk/agent-desk.service.ts
// =========================================================
// AGENT DESK v1.0 — ce dont un agent a besoin au guichet (lecture seule).
//
//   me()            son agence, le solde de la caisse de l'agence (un portefeuille par devise) et
//                   ses opérations du jour. GET /wallets/me ne le donne pas : pour un agent il renvoie
//                   ses portefeuilles personnels (à 0), pas la caisse de l'agence qui sert à payer.
//   lookupClient()  retrouve un client wallet par téléphone avant un dépôt. Comptes de rôle USER
//                   seulement, de sa société : GET /users/by-phone répond aussi pour un administrateur.
//   sendPreview()   frais, taux et montant reçu d'un envoi cash, calculés par les mêmes services que
//                   POST /transactions : l'écran affiche exactement ce que le serveur appliquera.
//
// Les écritures (dépôt, paiement d'un code, envoi, remise) restent sur leurs routes existantes.
// =========================================================

import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { currencyOfCountry } from '../fee-schedule/country-currency';
import { FeeScheduleService } from '../fee-schedule/fee-schedule.service';
import { normalizePhoneE164 } from '../common/utils/phone.util';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../rates/rates.service';

/** Au-dessus, un envoi cash attend la validation d'un administrateur (même seuil que transactions.service.ts). */
export const VALIDATION_THRESHOLD = 500_000;
const MAX_LOOKBACK_MS = 36 * 3600_000;
const MAX_ROWS = 5000;

export interface CurrencyTotal {
  currency: string;
  total: number;
}
export interface OpSummary {
  count: number;
  totals: CurrencyTotal[];
}

const money = (v: unknown): number => Number(v ?? 0) || 0;
const round4 = (n: number): number => Math.round(n * 10_000) / 10_000;

function summarize(rows: readonly { currency: string; amount: number }[]): OpSummary {
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.currency, (by.get(r.currency) ?? 0) + r.amount);
  return {
    count: rows.length,
    totals: [...by.entries()].map(([currency, total]) => ({ currency, total: round4(total) })).sort((a, b) => b.total - a.total),
  };
}

function startOfDayUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

@Injectable()
export class AgentDeskService {
  private readonly logger = new Logger(AgentDeskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly feeSchedule: FeeScheduleService,
    private readonly rates: RatesService,
  ) {}

  private async agentOf(agentId: string) {
    const agent = await this.prisma.user.findUnique({
      where: { id: agentId },
      select: { id: true, firstName: true, lastName: true, agencyId: true, clientId: true, isActive: true, deletedAt: true },
    });
    if (!agent || !agent.isActive || agent.deletedAt) throw new ForbiddenException('Compte agent indisponible.');
    return agent;
  }

  private async cashWallets(agencyId: string) {
    const wallets = await this.prisma.wallet.findMany({ where: { agencyId, isActive: true }, orderBy: { currency: 'asc' } });
    return wallets.map((w) => {
      const balance = money(w.balance);
      const reserved = money((w as { reservedBalance?: unknown }).reservedBalance);
      return {
        id: w.id,
        currency: String(w.currency),
        balance,
        reservedBalance: reserved,
        availableBalance: round4(balance - reserved),
        isDefault: !!(w as { isDefault?: boolean }).isDefault,
        isFrozen: !!(w as { isFrozen?: boolean }).isFrozen,
      };
    });
  }

  // ── Mon guichet ───────────────────────────────────────
  async me(agentId: string, sinceRaw?: string) {
    const agent = await this.agentOf(agentId);
    const identity = { id: agent.id, firstName: agent.firstName, lastName: agent.lastName };
    if (!agent.agencyId || !agent.clientId) return { agent: identity, agency: null, wallets: [], today: null };

    const agency = await this.prisma.agency.findFirst({
      where: { id: agent.agencyId, clientId: agent.clientId },
      select: { id: true, name: true, city: true, country: true, primaryCurrency: true, isActive: true, type: true },
    });
    if (!agency) return { agent: identity, agency: null, wallets: [], today: null };

    const now = new Date();
    let since = startOfDayUtc(now);
    if (sinceRaw) {
      const asked = new Date(sinceRaw);
      if (!Number.isNaN(asked.getTime())) since = new Date(Math.min(Math.max(asked.getTime(), now.getTime() - MAX_LOOKBACK_MS), now.getTime()));
    }

    const [wallets, ops, payouts] = await Promise.all([
      this.cashWallets(agency.id),
      this.prisma.transaction.findMany({
        where: {
          clientId: agent.clientId,
          senderId: agent.id,
          createdAt: { gte: since },
          type: { in: ['DEPOSIT', 'TRANSFER', 'AGENCY_REMITTANCE'] },
          status: { notIn: ['CANCELLED', 'FAILED'] },
        },
        select: { type: true, amount: true, fees: true, currency: true },
        take: MAX_ROWS,
      }),
      this.prisma.withdrawal.findMany({
        where: { clientId: agent.clientId, processedById: agent.id, status: 'PAID', processedAt: { gte: since } },
        select: { transaction: { select: { amount: true, currency: true, receivedAmount: true, targetCurrency: true } } },
        take: MAX_ROWS,
      }),
    ]);

    const of = (type: string) => ops.filter((o) => o.type === type).map((o) => ({ currency: String(o.currency), amount: money(o.amount) }));
    const sends = ops.filter((o) => o.type === 'TRANSFER');
    const paid = payouts
      .map((p) => p.transaction)
      .filter((t): t is NonNullable<typeof t> => !!t)
      .map((t) => (money(t.receivedAmount) > 0 ? { currency: String(t.targetCurrency ?? t.currency), amount: money(t.receivedAmount) } : { currency: String(t.currency), amount: money(t.amount) }));

    return {
      agent: identity,
      agency: { ...agency, primaryCurrency: String(agency.primaryCurrency), type: String(agency.type) },
      wallets,
      today: {
        since: since.toISOString(),
        deposits: summarize(of('DEPOSIT')),
        sends: { ...summarize(of('TRANSFER')), fees: summarize(sends.map((o) => ({ currency: String(o.currency), amount: money(o.fees) }))).totals },
        payouts: summarize(paid),
        remittances: summarize(of('AGENCY_REMITTANCE')),
      },
    };
  }

  // ── Client à créditer ─────────────────────────────────
  async lookupClient(agentId: string, phone: string) {
    const agent = await this.agentOf(agentId);
    if (!agent.clientId) throw new ForbiddenException('Agent sans société associée.');
    const normalized = normalizePhoneE164(phone);
    if (!normalized) return { client: null };

    const client = await this.prisma.user.findFirst({
      where: { clientId: agent.clientId, role: 'USER', deletedAt: null, phone: normalized },
      select: { id: true, firstName: true, lastName: true, phone: true, country: true, isActive: true, isSuspended: true },
    });
    if (!client) return { client: null };
    return {
      client: {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        country: client.country,
        /** Faux : le compte est désactivé ou suspendu, le dépôt serait refusé. */
        canReceive: !!client.isActive && !client.isSuspended,
      },
    };
  }

  // ── Aperçu d'un envoi cash ────────────────────────────
  async sendPreview(agentId: string, amount: number, receiveCountry: string) {
    const agent = await this.agentOf(agentId);
    if (!agent.agencyId || !agent.clientId) throw new ForbiddenException("Cet agent n'est rattaché à aucune agence.");

    const wallets = await this.cashWallets(agent.agencyId);
    const wallet = wallets.find((w) => w.isDefault) ?? wallets[0];
    if (!wallet) throw new NotFoundException("L'agence n'a pas de caisse.");
    const currency = wallet.currency;

    const target = currencyOfCountry(receiveCountry);
    if (!target) throw new BadRequestException(`Pays de réception inconnu : « ${receiveCountry} ».`);

    const quote = await this.feeSchedule.quote({
      clientId: agent.clientId,
      senderId: agent.id,
      payoutMethod: 'CASH_PICKUP',
      amount,
      currency,
      receiveCountry,
    });

    let received: number;
    try {
      received = await this.rates.convert(amount, currency, target);
    } catch (err) {
      this.logger.warn(`Taux indisponible ${currency}→${target} : ${(err as Error).message}`);
      throw new BadRequestException(`Aucun taux de change disponible pour ${currency} → ${target}.`);
    }

    return {
      amount,
      currency,
      fees: quote.fees,
      total: quote.total,
      feeRatePct: quote.feeRatePct,
      feeSource: quote.source,
      rule: quote.rule,
      targetCurrency: target,
      exchangeRate: amount > 0 ? received / amount : 1,
      receivedAmount: received,
      available: wallet.availableBalance,
      enough: wallet.availableBalance >= quote.total,
      needsValidation: amount > VALIDATION_THRESHOLD,
      validationThreshold: VALIDATION_THRESHOLD,
    };
  }
}
