// apps/backend/src/fee-schedule/fee-schedule.service.ts
// =========================================================
// FEE SCHEDULE SERVICE v1.2 — barème de frais d'envoi par société
//   ✅ v1.2 : plus rien n'est écrit en dur. Les modes gratuits (par défaut : seul WALLET, wallet → wallet) et le taux de repli
//   viennent des paramètres de la société (CompanySettingsService). Le frais fixe d'un tarif plat est exprimé dans la devise par
//   défaut de la société et converti dans la devise de l'envoi (avant : ajouté tel quel — 200 XOF devenaient 200 EUR).
//   Une règle du barème ne peut pas viser un mode que la société a déclaré gratuit.
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
//   1. Mode gratuit (réglé par la société ; défaut : wallet) . 0
//   2. Règle du barème applicable (montant, corridor, mode) .. règle la plus spécifique
//   3. Tarif plat du mode de retrait (page Frais) ............ taux % + frais fixe
//   4. Rien de configuré ..................................... taux de repli de la société (défaut 1,5 %)
// =========================================================

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { CompanySettingsService } from '../company-settings/company-settings.service';
import { isFreeMethod } from '../company-settings/company-settings.logic';
import { hasAtMostTwoDecimals } from '../fees-admin/fee-rules';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../rates/rates.service';
import { toIso2 } from './countries';
import type { FeeRuleBodyDto } from './dto/fee-rule.dto';
import { fallbackNotice } from './fallback-coverage';
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
    private readonly settings: CompanySettingsService,
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

  /** Devise dans laquelle la société exprime ses frais fixes (sa devise par défaut ; sinon celle de l'envoi : aucune conversion). */
  private async companyCurrency(clientId: number, fallback: string): Promise<string> {
    try {
      const c = await this.prisma.client.findUnique({ where: { id: clientId }, select: { defaultCurrency: true } });
      return String(c?.defaultCurrency ?? fallback);
    } catch {
      return fallback;
    }
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

  private readonly fallbackWarned = new Map<string, number>();

  /** Un seul avertissement par société et par mode toutes les 6 h : le taux de repli s'applique sans que personne l'ait choisi. */
  private warnFallbackOnce(clientId: number, method: string, ratePct: number): void {
    const key = `${clientId}:${method}`;
    const last = this.fallbackWarned.get(key) ?? 0;
    if (Date.now() - last < 6 * 3_600_000) return;
    this.fallbackWarned.set(key, Date.now());
    this.logger.warn(`Société ${clientId} : aucun tarif configuré pour « ${method} » — taux de repli ${ratePct} % appliqué. Ajoutez une règle de barème ou un tarif plat.`);
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

    // ✅ v1.2 : les modes gratuits sont un réglage de la société.
    const company = await this.settings.forClient(p.clientId);
    if (isFreeMethod(company, method)) {
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
    const fallbackRate = company.fees.fallbackFeeRatePct;
    let ratePct = fallbackRate;
    let fixed = 0;
    let source: FeeSource = 'DEFAULT';
    try {
      const flat = await this.prisma.commissionConfig.findFirst({ where: { clientId: p.clientId, payoutMethod: method } });
      if (flat) {
        ratePct = (flat as { feeRate?: number }).feeRate ?? fallbackRate;
        fixed = (flat as { fixedFee?: number }).fixedFee ?? 0;
        source = 'METHOD';
      }
    } catch {
      // Colonne pas encore migrée : taux de repli.
    }

    // ✅ v1.2 : le frais fixe du tarif plat est dans la devise par défaut de la société → converti dans la devise de l'envoi.
    let fixedFee = fixed;
    let fixedFeeOriginal: FeeQuote['fixedFeeOriginal'] = null;
    if (fixed > 0) {
      const flatCurrency = await this.companyCurrency(p.clientId, currency);
      if (flatCurrency !== currency) {
        try {
          fixedFee = roundToCurrency(await convert(fixed, flatCurrency, currency), currency);
          fixedFeeOriginal = { amount: fixed, currency: flatCurrency };
        } catch (err) {
          this.logger.error(`Frais fixe ${flatCurrency}→${currency} non convertible : ${(err as Error).message}`);
          throw new ServiceUnavailableException(
            `Taux de change ${flatCurrency} → ${currency} indisponible : les frais ne peuvent pas être calculés pour le moment. Réessayez dans quelques instants.`,
          );
        }
      }
    }

    if (source === 'DEFAULT') this.warnFallbackOnce(p.clientId, method, ratePct);
    const fees = new Prisma.Decimal(p.amount).mul(new Prisma.Decimal(ratePct / 100)).plus(new Prisma.Decimal(fixedFee));
    return done(roundToCurrency(fees.toNumber(), currency), {
      feeRatePct: ratePct,
      fixedFee,
      fixedFeeOriginal,
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
    // ✅ v4.34 — signale les modes sans aucun tarif : ils sont facturés au taux de repli sans que l'administrateur l'ait décidé.
    const settings = await this.settings.forClient(scope);
    let flatMethods: Array<string | null> = [];
    try {
      const flats = await this.prisma.commissionConfig.findMany({ where: { clientId: scope, payoutMethod: { not: null } }, select: { payoutMethod: true } });
      flatMethods = flats.map((f: { payoutMethod: string | null }) => f.payoutMethod);
    } catch {
      // Colonne pas encore migrée : pas de tarif plat connu.
    }
    const fallback = fallbackNotice({ fallbackFeeRatePct: settings.fees.fallbackFeeRatePct, freeMethods: settings.fees.freeMethods, rules: rows, flatMethods });
    return { company, editable: user.role === 'COMPANY_ADMIN', rules: rows.map(viewOf), fallback };
  }

  private async assertBody(clientId: number, dto: FeeRuleBodyDto): Promise<void> {
    if (dto.payoutMethod) {
      const company = await this.settings.forClient(clientId);
      if (isFreeMethod(company, dto.payoutMethod)) {
        throw new BadRequestException(
          'Ce mode d\'envoi est gratuit dans vos paramètres : aucun frais n\'y est prélevé. Retirez-le des modes gratuits pour lui appliquer une règle.',
        );
      }
    }
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
    await this.assertBody(clientId, dto);
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
    await this.assertBody(clientId, dto);
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
