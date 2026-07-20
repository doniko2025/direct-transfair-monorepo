// apps/backend/src/commissions/commissions.service.ts
// =========================================================
// COMMISSIONS SERVICE v5.0
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
      where: { clientId, sourceType: dto.sourceType, destType: dto.destType, currency: null },
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
  // ========================================================

  async getMyLedgerCommissions(clientId: number, agencyId: string, period: string) {
    const startDate = this.getPeriodStart(period);

    const agencyWallets = await this.prisma.wallet.findMany({
      where: { agencyId, isActive: true },
      select: { id: true },
    });
    const walletIds = agencyWallets.map((w) => w.id);

    if (walletIds.length === 0) {
      return { totalsByCurrency: [] as CurrencyTotal[], count: 0, entries: [] as LedgerCommissionEntry[] };
    }

    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        walletId: { in: walletIds },
        type: LedgerEntryType.CREDIT,
        description: { startsWith: COMMISSION_DESC_PREFIX },
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
      include: {
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
      },
    });

    return this.summarize(entries as unknown as RawLedgerEntry[]);
  }

  // ========================================================
  // ✅ v5.0 — ADMIN : vue société complète
  //   - platform  : commissions réellement créditées au(x) wallet(s)
  //                 société (clientId) — la vraie marge plateforme
  //   - agencies  : commissions réellement créditées à chaque agence
  //                 du réseau, groupées par agence
  // ========================================================

  async getCompanyLedgerCommissions(clientId: number, period: string) {
    const startDate = this.getPeriodStart(period);

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
    const agencyNameByWallet = new Map<string, string>();
    for (const w of agencyWallets) {
      if (w.agencyId) agencyNameByWallet.set(w.id, agencyNameById.get(w.agencyId) ?? '—');
    }

    const companyWalletIds = companyWallets.map((w) => w.id);
    const agencyWalletIds  = agencyWallets.map((w) => w.id);

    const include = {
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

    const [platformEntries, agencyEntries] = await Promise.all([
      companyWalletIds.length > 0
        ? this.prisma.ledgerEntry.findMany({
            where: {
              walletId: { in: companyWalletIds },
              type: LedgerEntryType.CREDIT,
              description: { startsWith: COMMISSION_DESC_PREFIX },
              createdAt: { gte: startDate },
            },
            orderBy: { createdAt: 'desc' },
            include,
          })
        : Promise.resolve([]),
      agencyWalletIds.length > 0
        ? this.prisma.ledgerEntry.findMany({
            where: {
              walletId: { in: agencyWalletIds },
              type: LedgerEntryType.CREDIT,
              description: { startsWith: COMMISSION_DESC_PREFIX },
              createdAt: { gte: startDate },
            },
            orderBy: { createdAt: 'desc' },
            include,
          })
        : Promise.resolve([]),
    ]);

    // ── Totaux par agence (utilisés pour le tableau récap) ────
    const perAgency = new Map<string, { agencyId: string; name: string; totals: Map<string, number>; count: number }>();
    for (const e of agencyEntries) {
      const agencyId = agencyWallets.find((w) => w.id === e.walletId)?.agencyId ?? null;
      if (!agencyId) continue;
      if (!perAgency.has(agencyId)) {
        perAgency.set(agencyId, {
          agencyId,
          name: agencyNameById.get(agencyId) ?? '—',
          totals: new Map(),
          count: 0,
        });
      }
      const bucket = perAgency.get(agencyId)!;
      bucket.totals.set(e.currency, (bucket.totals.get(e.currency) ?? 0) + Number(e.amount));
      bucket.count += 1;
    }

    const platformSummary = this.summarize(platformEntries as unknown as RawLedgerEntry[]);
    const agencySummary   = this.summarize(agencyEntries as unknown as RawLedgerEntry[], agencyNameByWallet);

    return {
      platform: {
        totalsByCurrency: platformSummary.totalsByCurrency,
        count: platformSummary.count,
      },
      agencies: Array.from(perAgency.values())
        .map((a) => ({
          agencyId: a.agencyId,
          name: a.name,
          count: a.count,
          totalsByCurrency: Array.from(a.totals.entries()).map(([currency, total]) => ({ currency, total })),
        }))
        .sort((a, b) =>
          b.totalsByCurrency.reduce((s, t) => s + t.total, 0) -
          a.totalsByCurrency.reduce((s, t) => s + t.total, 0),
        ),
      entries: [
        ...platformSummary.entries.map((e) => ({ ...e, scope: 'platform' as const })),
        ...agencySummary.entries.map((e) => ({ ...e, scope: 'agency' as const })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    };
  }

  // ========================================================
  // HELPERS
  // ========================================================

  private summarize(
    entries: RawLedgerEntry[],
    agencyNameByWallet?: Map<string, string>,
  ): { totalsByCurrency: CurrencyTotal[]; count: number; entries: LedgerCommissionEntry[] } {
    const totalsMap = new Map<string, number>();
    const mapped: LedgerCommissionEntry[] = entries.map((e) => {
      totalsMap.set(e.currency, (totalsMap.get(e.currency) ?? 0) + Number(e.amount));

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

    return {
      totalsByCurrency: Array.from(totalsMap.entries()).map(([currency, total]) => ({ currency, total })),
      count: entries.length,
      entries: mapped,
    };
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