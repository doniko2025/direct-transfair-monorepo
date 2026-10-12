// apps/backend/src/fee-schedule/fee-schedule.service.ts
// =========================================================
// FEE SCHEDULE SERVICE v1.1 — barème de frais d'envoi par société
//   ✅ v1.1 (phase 6) : le tarif plat du mode (étape 3) et le taux par défaut (étape 4) sont arrondis à l'unité
//   de la devise comme les règles du barème (0 décimale XOF/GNF, 2 sinon) : 12 345 XOF × 1,5 % donnait
//   185,175 XOF de frais, c'est-à-dire des fractions de franc débitées au client et jamais payables en cash.
//
//   quote()    : frais d'un envoi. Appelé par TransactionsService.create() ET par GET /fees-admin/quote
//                (même code : ce que le client voit est ce qu'on lui prélève).
//   list / create / update / remove / history : gestion du barème par l'admin de société.
//                Le super admin consulte (list, history), il ne modifie rien.
//
// Ordre de calcul des frais d'un envoi :
//   1. Mode gratuit (Mobile Money, wallet) .................. 0
//   2. Règle du barème applicable (montant, corridor, mode) .. règle la plus spécifique
//   3. Tarif plat du mode de retrait (page Frais) ............ taux % + frais fixe
//   4. Rien de configuré ..................................... 1,5 %
// =========================================================

import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { CHARGED_METHOD_KEYS, DEFAULT_FEE_RATE, hasAtMostTwoDecimals } from '../fees-admin/fee-rules';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../rates/rates.service';
import { toIso2 } from './countries';
import type { FeeRuleBodyDto } from './dto/fee-rule.dto';
import { feeFromRule, pickRule, rangesOverlap, roundToCurrency, type FeeRuleLike } from './fee-engine';

export const MAX_RULES_PER_COMPANY = 100;

export type FeeSource = 'RULE' | 'METHOD' | 'DEFAULT' | 'FREE';

export interface QuoteParams {
  clientId: number;
  senderId?: string | null;
  payoutMethod: string;
  amount: number;
  currency: string;
  receiveCountry?: string | null;
  /** Imposé par une simulation d'administrateur ; sinon déduit de l'expéditeur. */
  sendCountry?: string | null;
}

export interface FeeQuote {
  fees: number;
  total: number;
  currency: string;
  feeRatePct: number;
  /** Frais fixe dans la devise de l'envoi. */
  fixedFee: number;
  fixedFeeOriginal: { amount: number; currency: string } | null;
  source: FeeSource;
  rule: { id: string; label: string | null } | null;
  sendCountry: string | null;
  receiveCountry: string | null;
}

export interface FeeRuleView {
  id: string;
  label: string | null;
  payoutMethod: string | null;
  sendCountry: string | null;
  receiveCountry: string | null;
  currency: string;
  minAmount: number;
  maxAmount: number | null;
  feeRate: number;
  fixedFee: number;
  isActive: boolean;
  updatedAt: string;
}

interface RuleRow {
  id: string;
  clientId: number;
  label: string | null;
  payoutMethod: string | null;
  sendCountry: string | null;
  receiveCountry: string | null;
  currency: string;
  minAmount: unknown;
  maxAmount: unknown | null;
  feeRate: number;
  fixedFee: unknown;
  isActive: boolean;
  updatedAt: Date;
}

const toNum = (v: unknown): number => Number(v);

function viewOf(r: RuleRow): FeeRuleView {
  return {
    id: r.id,
    label: r.label,
    payoutMethod: r.payoutMethod,
    sendCountry: r.sendCountry,
    receiveCountry: r.receiveCountry,
    currency: r.currency,
    minAmount: toNum(r.minAmount),
    maxAmount: r.maxAmount === null ? null : toNum(r.maxAmount),
    feeRate: r.feeRate,
    fixedFee: toNum(r.fixedFee),
    isActive: r.isActive,
    updatedAt: r.updatedAt.toISOString(),
  };
}

function engineRule(r: RuleRow): FeeRuleLike {
  return {
    id: r.id,
    label: r.label,
    payoutMethod: r.payoutMethod,
    sendCountry: r.sendCountry,
    receiveCountry: r.receiveCountry,
    currency: r.currency,
    minAmount: toNum(r.minAmount),
    maxAmount: r.maxAmount === null ? null : toNum(r.maxAmount),
    feeRate: r.feeRate,
    fixedFee: toNum(r.fixedFee),
    updatedAt: r.updatedAt,
  };
}

const fullName = (u: { firstName: string | null; lastName: string | null; email: string } | null): string | null => {
  if (!u) return null;
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.email;
};

@Injectable()
export class FeeScheduleService {
  private readonly logger = new Logger(FeeScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rates: RatesService,
  ) {}

  // ───────────────────────────────────────────────────────
  // Calcul des frais
  // ───────────────────────────────────────────────────────

  private async sendCountryOf(senderId: string | null | undefined): Promise<string | null> {
    if (!senderId) return null;
    const user = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { country: true, agency: { select: { country: true } } },
    });
    // Un agent encaisse en agence : c'est le pays de l'agence qui compte, pas son pays de résidence.
    return toIso2(user?.agency?.country ?? user?.country);
  }

  private async activeRules(clientId: number): Promise<RuleRow[]> {
    try {
      return (await this.prisma.feeRule.findMany({ where: { clientId, isActive: true } })) as unknown as RuleRow[];
    } catch (err) {
      // Table absente (migration pas encore appliquée) : on retombe sur les tarifs plats plutôt que de bloquer les envois.
      this.logger.warn(`Barème illisible, tarif plat appliqué : ${(err as Error).message}`);
      return [];
    }
  }

  async quote(p: QuoteParams): Promise<FeeQuote> {
    const currency = p.currency.toUpperCase();
    const method = p.payoutMethod;
    const receiveCountry = toIso2(p.receiveCountry ?? null);
    const sendCountry = p.sendCountry !== undefined && p.sendCountry !== null ? toIso2(p.sendCountry) : await this.sendCountryOf(p.senderId);

    const base = { currency, sendCountry, receiveCountry };
    const done = (fees: number, extra: Omit<FeeQuote, 'fees' | 'total' | 'currency' | 'sendCountry' | 'receiveCountry'>): FeeQuote => ({
      ...base,
      fees,
      total: Number(new Prisma.Decimal(p.amount).plus(new Prisma.Decimal(fees))),
      ...extra,
    });

    if (!CHARGED_METHOD_KEYS.includes(method)) {
      return done(0, { feeRatePct: 0, fixedFee: 0, fixedFeeOriginal: null, source: 'FREE', rule: null });
    }

    const convert = (amount: number, from: string, to: string) => this.rates.convert(amount, from, to);

    const rules = await this.activeRules(p.clientId);
    if (rules.length > 0) {
      const ctx = { payoutMethod: method, sendCountry, receiveCountry };
      const rule = await pickRule(rules.map(engineRule), ctx, p.amount, currency, convert);
      if (rule) {
        try {
          const f = await feeFromRule(rule, p.amount, currency, convert);
          return done(f.fees, {
            feeRatePct: f.feeRatePct,
            fixedFee: f.fixedFee,
            fixedFeeOriginal: f.fixedFeeOriginal,
            source: 'RULE',
            rule: { id: rule.id, label: rule.label },
          });
        } catch (err) {
          this.logger.warn(`Règle ${rule.id} inapplicable (${(err as Error).message}) — tarif plat appliqué.`);
        }
      }
    }

    // Tarif plat du mode de retrait (même lecture qu'avant le barème).
    let ratePct = DEFAULT_FEE_RATE;
    let fixed = 0;
    let source: FeeSource = 'DEFAULT';
    try {
      const flat = await this.prisma.commissionConfig.findFirst({ where: { clientId: p.clientId, payoutMethod: method } });
      if (flat) {
        ratePct = (flat as { feeRate?: number }).feeRate ?? DEFAULT_FEE_RATE;
        fixed = (flat as { fixedFee?: number }).fixedFee ?? 0;
        source = 'METHOD';
      }
    } catch {
      // Colonne pas encore migrée : taux par défaut.
    }
    const fees = new Prisma.Decimal(p.amount).mul(new Prisma.Decimal(ratePct / 100)).plus(new Prisma.Decimal(fixed));
    return done(roundToCurrency(fees.toNumber(), currency), {
      feeRatePct: ratePct,
      fixedFee: fixed,
      fixedFeeOriginal: null,
      source,
      rule: null,
    });
  }

  // ───────────────────────────────────────────────────────
  // Gestion du barème
  // ───────────────────────────────────────────────────────

  private readScope(user: AuthUserPayload, clientId?: number): number {
    if (user.role === 'SUPER_ADMIN') {
      if (!clientId) throw new BadRequestException('Précisez la société (clientId).');
      return clientId;
    }
    if (!user.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    return user.clientId;
  }

  private writeScope(user: AuthUserPayload): number {
    if (user.role !== 'COMPANY_ADMIN' || !user.clientId) {
      throw new ForbiddenException("Seul l'administrateur de la société modifie son barème.");
    }
    return user.clientId;
  }

  async list(user: AuthUserPayload, clientId?: number) {
    const scope = this.readScope(user, clientId);
    const company = await this.prisma.client.findUnique({ where: { id: scope }, select: { id: true, name: true, code: true } });
    if (!company) throw new NotFoundException('Société introuvable.');
    const rows = (await this.prisma.feeRule.findMany({
      where: { clientId: scope },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })) as unknown as RuleRow[];
    return { company, editable: user.role === 'COMPANY_ADMIN', rules: rows.map(viewOf) };
  }

  private assertBody(dto: FeeRuleBodyDto): void {
    const max = dto.maxAmount ?? null;
    if (max !== null && max <= dto.minAmount) {
      throw new BadRequestException('Le plafond de la tranche doit être supérieur à son minimum.');
    }
    for (const n of [dto.minAmount, max, dto.feeRate, dto.fixedFee]) {
      if (n !== null && !hasAtMostTwoDecimals(n)) throw new BadRequestException('Deux décimales au maximum.');
    }
  }

  private async assertNoOverlap(clientId: number, dto: FeeRuleBodyDto, selfId?: string): Promise<void> {
    if (dto.isActive === false) return;
    const rows = (await this.prisma.feeRule.findMany({
      where: {
        clientId,
        isActive: true,
        currency: dto.currency,
        payoutMethod: (dto.payoutMethod ?? null) as never, // ✅ phase 6 : erreur de compilation TS2322 (string vs enum PayoutMethod), même cast que dataOf()
        sendCountry: dto.sendCountry ?? null,
        receiveCountry: dto.receiveCountry ?? null,
        ...(selfId ? { id: { not: selfId } } : {}),
      },
    })) as unknown as RuleRow[];
    const mine = { minAmount: dto.minAmount, maxAmount: dto.maxAmount ?? null };
    const clash = rows.find((r) => rangesOverlap(mine, { minAmount: toNum(r.minAmount), maxAmount: r.maxAmount === null ? null : toNum(r.maxAmount) }));
    if (clash) {
      const to = clash.maxAmount === null ? 'sans plafond' : `jusqu'à ${toNum(clash.maxAmount)}`;
      throw new ConflictException(
        `Cette tranche chevauche « ${clash.label ?? 'une autre règle'} » (de ${toNum(clash.minAmount)} ${to} ${clash.currency}) pour les mêmes critères.`,
      );
    }
  }

  private dataOf(dto: FeeRuleBodyDto) {
    return {
      label: dto.label?.trim() ? dto.label.trim() : null,
      payoutMethod: (dto.payoutMethod ?? null) as never,
      sendCountry: dto.sendCountry ?? null,
      receiveCountry: dto.receiveCountry ?? null,
      currency: dto.currency,
      minAmount: new Prisma.Decimal(dto.minAmount),
      maxAmount: dto.maxAmount === null || dto.maxAmount === undefined ? null : new Prisma.Decimal(dto.maxAmount),
      feeRate: dto.feeRate,
      fixedFee: new Prisma.Decimal(dto.fixedFee),
      isActive: dto.isActive ?? true,
    };
  }

  private async audit(user: AuthUserPayload, clientId: number, entityId: string, details: Record<string, unknown>): Promise<void> {
    // L'opération est faite : un échec d'écriture du journal ne doit pas la faire passer pour un échec.
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          clientId,
          action: 'COMMISSION_CONFIG_UPDATE',
          entity: 'FeeRule',
          entityId,
          details: details as Prisma.InputJsonValue,
          successful: true,
        },
      });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (règle ${entityId}, société ${clientId}) : ${(err as Error).message}`);
    }
  }

  async create(user: AuthUserPayload, dto: FeeRuleBodyDto): Promise<FeeRuleView> {
    const clientId = this.writeScope(user);
    this.assertBody(dto);
    const count = await this.prisma.feeRule.count({ where: { clientId } });
    if (count >= MAX_RULES_PER_COMPANY) {
      throw new BadRequestException(`Un barème ne peut pas dépasser ${MAX_RULES_PER_COMPANY} règles.`);
    }
    await this.assertNoOverlap(clientId, dto);
    const row = (await this.prisma.feeRule.create({ data: { clientId, ...this.dataOf(dto) } })) as unknown as RuleRow;
    const view = viewOf(row);
    await this.audit(user, clientId, row.id, { op: 'create', to: view });
    return view;
  }

  async update(user: AuthUserPayload, id: string, dto: FeeRuleBodyDto): Promise<FeeRuleView> {
    const clientId = this.writeScope(user);
    const existing = (await this.prisma.feeRule.findFirst({ where: { id, clientId } })) as unknown as RuleRow | null;
    if (!existing) throw new NotFoundException('Règle introuvable.');
    this.assertBody(dto);
    await this.assertNoOverlap(clientId, dto, id);
    const row = (await this.prisma.feeRule.update({ where: { id }, data: this.dataOf(dto) })) as unknown as RuleRow;
    const view = viewOf(row);
    await this.audit(user, clientId, id, { op: 'update', from: viewOf(existing), to: view });
    return view;
  }

  async remove(user: AuthUserPayload, id: string): Promise<{ id: string }> {
    const clientId = this.writeScope(user);
    const existing = (await this.prisma.feeRule.findFirst({ where: { id, clientId } })) as unknown as RuleRow | null;
    if (!existing) throw new NotFoundException('Règle introuvable.');
    await this.prisma.feeRule.delete({ where: { id } });
    await this.audit(user, clientId, id, { op: 'delete', from: viewOf(existing) });
    return { id };
  }

  async history(user: AuthUserPayload, clientId: number | undefined, limit: number) {
    const scope = this.readScope(user, clientId);
    const rows = await this.prisma.auditLog.findMany({
      where: { action: 'COMMISSION_CONFIG_UPDATE', entity: 'FeeRule', clientId: scope },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
    return {
      data: rows.map((r) => {
        const d = (r.details ?? {}) as { op?: string; from?: FeeRuleView | null; to?: FeeRuleView | null };
        return {
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          op: d.op ?? 'update',
          label: (d.to ?? d.from)?.label ?? null,
          from: d.from ?? null,
          to: d.to ?? null,
          user: fullName(r.user),
        };
      }),
    };
  }
}
