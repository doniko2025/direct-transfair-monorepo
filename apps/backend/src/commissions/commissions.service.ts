// apps/backend/src/commissions/commissions.service.ts
// =========================================================
// COMMISSIONS SERVICE v5.2
// ✅ v5.2 (phase 6, lot 2c) : journal des commissions paginé (page, limit — 100 par défaut, 500 max).
//    Avant, TOUTES les écritures de la période étaient chargées en mémoire (avec expéditeur, bénéficiaire…) :
//    réponse de plus en plus lourde, jusqu'au dépassement mémoire. Les totaux et compteurs sont calculés par la
//    base sur toute la période (groupBy) : ils ne dépendent pas de la page affichée. Format de réponse inchangé
//    (+ page, limit, hasMore) ; `count` = nombre total d'écritures de la période.
// ✅ v5.1 (phase 6) : upsertRule() ne cible plus que les règles de RÉPARTITION (payoutMethod: null) ;
//    sans ce filtre, une ligne de tarif par mode (payoutMethod renseigné, devise vide) pouvait être
//    écrasée par une règle de répartition.
// ✅ v4.4 conservé : getFeeRate/upsertFeeConfig (frais par méthode,
//    utilisé par fees.tsx), getClientRules/upsertRule (répartition
//    inter-agences, utilisé par settings.tsx) — AUCUN changement
//
// ✅ v5.0 : 🚨 REFONTE — source de vérité = LedgerEntry
//
//   PROBLÈME RÉSOLU (juillet 2026) :
//   getHistory()/getMyStats() (supprimées dans cette version)
//   recalculaient la commission à la volée depuis
//   tx.fees × CommissionConfig ACTUELLE, sans jamais lire les
//   LedgerEntry que withdrawals.service.ts::agentProcessPayment()
//   crédite réellement sur les wallets au moment du paiement. Deux
//   conséquences observées :
//     1. Si l'admin changeait un taux de répartition APRÈS qu'un
//        retrait ait été payé, l'historique affiché changeait
//        rétroactivement — sans rapport avec ce qui avait été
//        réellement crédité ce jour-là.
//     2. La conversion de devise divergeait aussi : getHistory()
//        utilisait tx.exchangeRate (figé à la création),
//        agentProcessPayment() utilise le taux du jour du paiement
//        (RatesService.convert()) — deux montants possibles pour la
//        même transaction si le taux a bougé entre-temps.
//   Par ailleurs, ces deux méthodes filtraient seulement sur
//   `sender: { agencyId }`, ce qui faisait remonter les Dépôts Client
//   (deposit(), fees:0 en dur, senderId = l'agent) et les mouvements
//   de trésorerie interne (AgencyTreasuryService, fees:0 en dur
//   également) au milieu de la liste "commissions", avec des lignes
//   "+0" qui n'ont jamais eu vocation à en générer.
//
//   ✅ DÉCISION PRODUIT CONFIRMÉE (juillet 2026) : Dépôt Client
//   (Wallet → Wallet) reste gratuit, par design. Rien à changer côté
//   deposit()/transactions.service.ts — ce fichier n'y touche pas.
//
//   CORRECTIF : getMyLedgerCommissions() et
//   getCompanyLedgerCommissions() lisent directement les LedgerEntry
//   déjà écrites par agentProcessPayment() — filtrées sur type=CREDIT
//   et description commençant par "Commission" (seul marqueur
//   existant aujourd'hui pour distinguer un crédit de commission d'un
//   crédit de remboursement cash ou d'une recharge). Les montants
//   affichés sont donc EXACTEMENT ceux crédités — plus de divergence
//   possible avec le solde réel du wallet, et plus aucun dépôt /
//   mouvement interne dans la liste puisqu'ils ne créent jamais ce
//   type d'écriture.
//
//   ⚠️ Fragilité assumée : la distinction repose sur le préfixe de
//   description "Commission" — pas de LedgerEntryType dédié dans le
//   schéma actuel (CREDIT/DEBIT/HOLD/UNHOLD/ADJUSTMENT seulement). Si
//   withdrawals.service.ts change un jour la formulation de ces
//   description, cette méthode doit être mise à jour en miroir. Une
//   évolution plus robuste serait un LedgerEntryType.COMMISSION dédié
//   (migration Prisma) — volontairement hors scope ici : ce fichier
//   ne touche AUCUNE ligne de withdrawals.service.ts.
//
//   getHistory()/getMyStats() SUPPRIMÉES : plus aucun fichier ne les
//   appelle après la refonte de agent/commissions.tsx et
//   admin/commissions/config.tsx.
// =========================================================

import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CommissionDestType,
  CommissionSourceType,
  CurrencyCode,
  LedgerEntryType,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { UpdateCommissionDto } from './dto/update-commission.dto';

const PAYOUT_CURRENCY_SLOT: Record<string, CurrencyCode> = {
  CASH_PICKUP:   CurrencyCode.XOF,
  BANK_DEPOSIT:  CurrencyCode.EUR,
  MOBILE_MONEY:  CurrencyCode.GNF,
  IBAN_TRANSFER: CurrencyCode.USD,
};

// Marqueur utilisé par withdrawals.service.ts::agentProcessPayment()
// pour toutes ses écritures de commission (voir "Commission
// paiement…", "Commission envoi…", "Commission plateforme…" là-bas).
const COMMISSION_DESC_PREFIX = 'Commission';

type CurrencyTotal = { currency: string; total: number };

type LedgerCommissionEntry = {
  id: string;
  createdAt: Date;
  amount: number;
  currency: string;
  description: string | null;
  balanceAfter: number;
  transactionId: string | null;
  transactionRef: string | null;
  origin: string;
  grossAmount: number | null;
  grossFees: number | null;
};

type RawLedgerEntry = {
  id: string;
  createdAt: Date;
  amount: any;
  currency: string;
  description: string | null;
  balanceAfter: any;
  transactionId: string | null;
  walletId: string;
  transaction: {
    reference: string;
    amount: any;
    fees: any;
    sender: {
      firstName: string | null;
      lastName: string | null;
      agency: { name: string } | null;
    } | null;
    beneficiary: { fullName: string } | null;
  } | null;
};

type LedgerGroup = { walletId: string; currency: string; total: number; count: number };

const LEDGER_INCLUDE = {
  transaction: {
    select: {
      reference: true,
      amount: true,
      fees: true,
      sender: {
        select: {
          firstName: true, lastName: true,
          agency: { select: { name: true } },
        },
      },
      beneficiary: { select: { fullName: true } },
    },
  },
} as const;

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

/** page ≥ 1 ; limit entre 1 et 500 (100 par défaut). Valeurs invalides → valeurs par défaut. */
export function normalizePaging(pageRaw: unknown, limitRaw: unknown): { page: number; limit: number } {
  const page = Math.floor(Number(pageRaw));
  const limit = Math.floor(Number(limitRaw));
  return {
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    limit: Number.isFinite(limit) && limit >= 1 ? Math.min(limit, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE,
  };
}

function sumByCurrency(groups: readonly LedgerGroup[]): CurrencyTotal[] {
  const by = new Map<string, number>();
  for (const g of groups) by.set(g.currency, (by.get(g.currency) ?? 0) + g.total);
  return Array.from(by.entries()).map(([currency, total]) => ({ currency, total }));
}

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ========================================================
  // FEE CONFIG — lire / écrire un taux de frais par méthode
  // (✅ v4.3, inchangé — utilisé par fees.tsx)
  // ========================================================

  async getFeeRate(
    clientId: number,
    payoutMethod: string,
  ): Promise<{ rate: number; fixedFee: number }> {
    if (!payoutMethod || payoutMethod === 'WALLET' || payoutMethod === 'MOBILE_MONEY') {
      return { rate: 0, fixedFee: 0 };
    }
    try {
      const config = await this.prisma.commissionConfig.findFirst({
        where: { clientId, payoutMethod, isActive: true },
      });
      if (config) {
        return {
          rate:     (config as any).feeRate   ?? 1.5,
          fixedFee: (config as any).fixedFee  ?? 0,
        };
      }
    } catch {
      // Colonne pas encore migrée → fallback
    }
    return { rate: 1.5, fixedFee: 0 };
  }

  async upsertFeeConfig(
    clientId: number,
    payoutMethod: string,
    feeRate: number,
    fixedFee: number,
  ) {
    const currency = PAYOUT_CURRENCY_SLOT[payoutMethod] ?? null;
    const existing = await this.prisma.commissionConfig.findFirst({
      where: { clientId, payoutMethod },
    });

    if (existing) {
      return this.prisma.commissionConfig.update({
        where: { id: existing.id },
        data: {
          isActive:      true,
          senderShare:   feeRate,
          platformShare: Math.max(0, 100 - feeRate),
          description:   `FEE:${payoutMethod}`,
          ...(Object.fromEntries([
            ['feeRate',      feeRate],
            ['fixedFee',     fixedFee],
            ['payoutMethod', payoutMethod],
          ])),
        },
      });
    }

    return this.prisma.commissionConfig.create({
      data: {
        isActive:      true,
        clientId,
        sourceType:    CommissionSourceType.WALLET,
        destType:      CommissionDestType.SUBSIDIARY,
        currency:      currency as CurrencyCode | undefined,
        senderShare:   feeRate,
        payerShare:    0,
        platformShare: Math.max(0, 100 - feeRate),
        description:   `FEE:${payoutMethod}`,
        ...(Object.fromEntries([
          ['feeRate',      feeRate],
          ['fixedFee',     fixedFee],
          ['payoutMethod', payoutMethod],
        ])),
      },
    });
  }

  // ========================================================
  // RÈGLES de répartition (split rules)
  // (✅ inchangé — utilisé par settings.tsx)
  // ========================================================

  async getClientRules(clientId: number) {
    return this.prisma.commissionConfig.findMany({
      where:   { clientId },
      include: { tiers: true },
      orderBy: [{ sourceType: 'asc' }, { destType: 'asc' }],
    });
  }

  async upsertRule(clientId: number, dto: UpdateCommissionDto) {
    const platformShare = 100 - (dto.senderShare + dto.payerShare);
    if (platformShare < 0) {
      throw new BadRequestException('La somme des parts ne peut pas dépasser 100%');
    }
    const existing = await this.prisma.commissionConfig.findFirst({
      where: { clientId, sourceType: dto.sourceType, destType: dto.destType, currency: null, payoutMethod: null }, // ✅ phase 6 : jamais un tarif par mode
    });
    if (existing) {
      return this.prisma.commissionConfig.update({
        where: { id: existing.id },
        data:  { senderShare: dto.senderShare, payerShare: dto.payerShare, platformShare },
      });
    }
    return this.prisma.commissionConfig.create({
      data: { clientId, sourceType: dto.sourceType, destType: dto.destType, senderShare: dto.senderShare, payerShare: dto.payerShare, platformShare },
    });
  }

  // ========================================================
  // ✅ v5.0 — AGENT : commissions réellement créditées à son agence
  // ✅ v5.2 : totaux calculés par la base sur TOUTE la période (groupBy), écritures paginées (page / limit)
  // ========================================================

  async getMyLedgerCommissions(clientId: number, agencyId: string, period: string, pageRaw?: unknown, limitRaw?: unknown) {
    const startDate = this.getPeriodStart(period);
    const { page, limit } = normalizePaging(pageRaw, limitRaw);

    const agencyWallets = await this.prisma.wallet.findMany({
      where: { agencyId, isActive: true },
      select: { id: true },
    });
    const walletIds = agencyWallets.map((w) => w.id);

    if (walletIds.length === 0) {
      return { totalsByCurrency: [] as CurrencyTotal[], count: 0, page, limit, hasMore: false, entries: [] as LedgerCommissionEntry[] };
    }

    const where = this.commissionWhere(walletIds, startDate);
    const [groups, entries] = await Promise.all([
      this.totalsOf(where),
      this.prisma.ledgerEntry.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit + 1,
        include: LEDGER_INCLUDE,
      }),
    ]);

    const count = groups.reduce((n, g) => n + g.count, 0);
    return {
      totalsByCurrency: sumByCurrency(groups),
      count,
      page,
      limit,
      hasMore: entries.length > limit,
      entries: this.mapEntries(entries.slice(0, limit) as unknown as RawLedgerEntry[]),
    };
  }

  // ========================================================
  // ✅ v5.0 — ADMIN : vue société complète
  //   - platform  : commissions réellement créditées au(x) wallet(s)
  //                 société (clientId) — la vraie marge plateforme
  //   - agencies  : commissions réellement créditées à chaque agence
  //                 du réseau, groupées par agence
  // ✅ v5.2 : totaux (société et par agence) calculés par la base sur toute la période ; une seule liste
  //    d'écritures, triée et paginée (champ `scope` = platform | agency).
  // ========================================================

  async getCompanyLedgerCommissions(clientId: number, period: string, pageRaw?: unknown, limitRaw?: unknown) {
    const startDate = this.getPeriodStart(period);
    const { page, limit } = normalizePaging(pageRaw, limitRaw);

    const [companyWallets, agencies] = await Promise.all([
      this.prisma.wallet.findMany({ where: { clientId, isActive: true }, select: { id: true } }),
      this.prisma.agency.findMany({ where: { clientId }, select: { id: true, name: true } }),
    ]);

    const agencyIds = agencies.map((a) => a.id);
    const agencyWallets = agencyIds.length > 0
      ? await this.prisma.wallet.findMany({
          where: { agencyId: { in: agencyIds }, isActive: true },
          select: { id: true, agencyId: true },
        })
      : [];
    const agencyNameById = new Map(agencies.map((a) => [a.id, a.name]));
    const agencyIdByWallet = new Map<string, string>();
    const agencyNameByWallet = new Map<string, string>();
    for (const w of agencyWallets) {
      if (!w.agencyId) continue;
      agencyIdByWallet.set(w.id, w.agencyId);
      agencyNameByWallet.set(w.id, agencyNameById.get(w.agencyId) ?? '—');
    }
    const companyWalletIds = new Set(companyWallets.map((w) => w.id));
    const allWalletIds = [...companyWalletIds, ...agencyWallets.map((w) => w.id)];

    if (allWalletIds.length === 0) {
      return { platform: { totalsByCurrency: [] as CurrencyTotal[], count: 0 }, agencies: [], page, limit, hasMore: false, entries: [] };
    }

    const where = this.commissionWhere(allWalletIds, startDate);
    const [groups, entries] = await Promise.all([
      this.totalsOf(where),
      this.prisma.ledgerEntry.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit + 1,
        include: LEDGER_INCLUDE,
      }),
    ]);

    // Totaux : société (wallets de la société) et par agence, sur toute la période.
    const platformGroups = groups.filter((g) => companyWalletIds.has(g.walletId));
    const perAgency = new Map<string, { agencyId: string; name: string; groups: LedgerGroup[] }>();
    for (const g of groups) {
      const agencyId = agencyIdByWallet.get(g.walletId);
      if (!agencyId || companyWalletIds.has(g.walletId)) continue;
      if (!perAgency.has(agencyId)) perAgency.set(agencyId, { agencyId, name: agencyNameById.get(agencyId) ?? '—', groups: [] });
      perAgency.get(agencyId)!.groups.push(g);
    }

    const shown = entries.slice(0, limit) as unknown as RawLedgerEntry[];
    return {
      platform: {
        totalsByCurrency: sumByCurrency(platformGroups),
        count: platformGroups.reduce((n, g) => n + g.count, 0),
      },
      agencies: Array.from(perAgency.values())
        .map((a) => ({
          agencyId: a.agencyId,
          name: a.name,
          count: a.groups.reduce((n, g) => n + g.count, 0),
          totalsByCurrency: sumByCurrency(a.groups),
        }))
        .sort((x, y) => y.totalsByCurrency.reduce((s, t) => s + t.total, 0) - x.totalsByCurrency.reduce((s, t) => s + t.total, 0)),
      page,
      limit,
      hasMore: entries.length > limit,
      entries: this.mapEntries(shown, agencyNameByWallet).map((e, i) => ({
        ...e,
        scope: (companyWalletIds.has(shown[i].walletId) ? 'platform' : 'agency') as 'platform' | 'agency',
      })),
    };
  }

  // ========================================================
  // HELPERS
  // ========================================================

  private commissionWhere(walletIds: string[], startDate: Date) {
    return {
      walletId: { in: walletIds },
      type: LedgerEntryType.CREDIT,
      description: { startsWith: COMMISSION_DESC_PREFIX },
      createdAt: { gte: startDate },
    };
  }

  /** Totaux par wallet et devise sur toute la période, calculés par la base (pas sur la page affichée). */
  private async totalsOf(where: ReturnType<CommissionsService['commissionWhere']>): Promise<LedgerGroup[]> {
    const rows = await this.prisma.ledgerEntry.groupBy({
      by: ['walletId', 'currency'],
      where,
      _sum: { amount: true },
      _count: { _all: true },
    });
    return rows.map((r) => ({
      walletId: r.walletId,
      currency: String(r.currency),
      total: Number(r._sum.amount ?? 0),
      count: r._count._all,
    }));
  }

  private mapEntries(entries: RawLedgerEntry[], agencyNameByWallet?: Map<string, string>): LedgerCommissionEntry[] {
    return entries.map((e) => {
      const senderName = e.transaction?.sender
        ? `${e.transaction.sender.firstName ?? ''} ${e.transaction.sender.lastName ?? ''}`.trim()
        : null;

      const origin =
        agencyNameByWallet?.get(e.walletId) ??
        e.transaction?.sender?.agency?.name ??
        senderName ??
        e.transaction?.beneficiary?.fullName ??
        '—';

      return {
        id: e.id,
        createdAt: e.createdAt,
        amount: Number(e.amount),
        currency: e.currency,
        description: e.description,
        balanceAfter: Number(e.balanceAfter),
        transactionId: e.transactionId,
        transactionRef: e.transaction?.reference ?? null,
        origin,
        grossAmount: e.transaction ? Number(e.transaction.amount) : null,
        grossFees: e.transaction ? Number(e.transaction.fees) : null,
      };
    });
  }

  private getPeriodStart(period: string): Date {
    const now = new Date();
    const d   = new Date(now);
    switch (period) {
      case 'day':     d.setHours(0, 0, 0, 0);               break;
      case 'week':    d.setDate(now.getDate() - 7);          break;
      case 'month':   d.setMonth(now.getMonth() - 1);        break;
      case 'quarter': d.setMonth(now.getMonth() - 3);        break;
      case 'year':    d.setFullYear(now.getFullYear() - 1);  break;
      default:        return new Date(0);
    }
    return d;
  }
}