// apps/backend/src/transfer-limits/transfer-limits.service.ts
// =========================================================
// TRANSFER LIMITS v1.0 — plafonds d'envoi par niveau KYC et par devise, réglés par l'admin de la société
//
//   get() / set() / reset() / history()   administration (set et reset : admin de société uniquement)
//   setUserKycLevel()                     l'admin de société fait passer un client au niveau KYC voulu
//   effectiveLimits()                     plafonds appliqués : ligne enregistrée, sinon valeurs par défaut du serveur
//   assertWithinLimits()                  contrôle à l'envoi (TransactionsService.create, virements programmés)
//
// Ce qui est contrôlé : les envois (TRANSFER, SCHEDULED) d'un CLIENT (rôle USER), dans la devise de l'envoi, montant
// hors frais. Comptent les envois en cours ou réussis ; pas les annulés, échoués, remboursés ou expirés.
// Les périodes (jour, mois, année) sont calculées en UTC. Un envoi fait par un agent pour un client de passage n'est
// pas contrôlé ici : l'expéditeur n'a pas de compte, donc pas de niveau KYC.
// =========================================================

import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CurrencyCode, KycLevel, type Prisma, TransactionStatus, TransactionType } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { hasAtMostTwoDecimals } from '../fees-admin/fee-rules';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_LIMIT, type SetLimitsDto } from './dto/transfer-limit.dto';
import {
  checkLimitOrder,
  defaultLimits,
  equalLimits,
  evaluateLimits,
  isKycLevel,
  KYC_LEVELS,
  LIMIT_KEYS,
  periodLabel,
  type Breach,
  type KycLevelName,
  type Limits,
  type Usage,
} from './transfer-limit-defaults';

export const LIMIT_ENTITY = 'TransferLimit';
export const KYC_ENTITY = 'UserKycLevel';

/** Envois qui comptent dans les plafonds : l'argent est parti ou réservé. */
const COUNTED_STATUSES: TransactionStatus[] = [
  TransactionStatus.PENDING,
  TransactionStatus.VALIDATED,
  TransactionStatus.PROCESSING,
  TransactionStatus.PAID,
  TransactionStatus.ON_HOLD,
];
const COUNTED_TYPES: TransactionType[] = [TransactionType.TRANSFER, TransactionType.SCHEDULED];

type Db = Prisma.TransactionClient;

export interface LimitView extends Limits {
  kycLevel: KycLevelName;
  currency: string;
  /** Une ligne est enregistrée. Sinon ce sont les plafonds par défaut du serveur. */
  configured: boolean;
  defaults: Limits;
  updatedAt: string | null;
}

interface LimitRow extends Limits {
  kycLevel: string;
  currency: string;
  updatedAt: Date;
}

const CURRENCIES = Object.values(CurrencyCode) as string[];

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

const fullName = (u: { firstName: string | null; lastName: string | null; email: string } | null): string | null => {
  if (!u) return null;
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.email;
};

function viewOf(level: KycLevelName, currency: string, row: LimitRow | undefined): LimitView {
  const defaults = defaultLimits(level, currency);
  const limits: Limits = row
    ? { perTransaction: row.perTransaction, daily: row.daily, monthly: row.monthly, yearly: row.yearly }
    : defaults;
  return { kycLevel: level, currency, ...limits, configured: Boolean(row), defaults, updatedAt: row ? row.updatedAt.toISOString() : null };
}

export function periodStarts(now: Date): { day: Date; month: Date; year: Date } {
  return {
    day: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
    month: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    year: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)),
  };
}

const money = (n: number, currency: string): string => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${currency}`;

export function breachMessage(b: Breach, currency: string): string {
  const hint = ' Pour envoyer davantage, demandez à votre agence de faire vérifier votre identité (niveau KYC supérieur).';
  if (b.limit === 'perTransaction') {
    return `Montant supérieur au plafond par envoi : ${money(b.max, currency)} au maximum.${hint}`;
  }
  return `Plafond ${periodLabel(b.limit)} dépassé : il vous reste ${money(b.remaining, currency)} sur ${money(b.max, currency)}.${hint}`;
}

@Injectable()
export class TransferLimitsService {
  private readonly logger = new Logger(TransferLimitsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Lecture ───────────────────────────────────────────
  private readScope(user: AuthUserPayload, clientId?: number): number {
    if (user.role === 'SUPER_ADMIN') {
      if (!clientId) throw new BadRequestException('Précisez la société (clientId).');
      return clientId;
    }
    if (!user.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    return user.clientId;
  }

  private requireCompanyAdmin(user: AuthUserPayload): number {
    if (user.role !== 'COMPANY_ADMIN' || !user.clientId) {
      throw new ForbiddenException("Seul l'administrateur de la société fixe les plafonds de ses clients.");
    }
    return user.clientId;
  }

  private parseLevel(raw: string): KycLevelName {
    const v = String(raw ?? '').toUpperCase();
    if (!isKycLevel(v)) throw new BadRequestException(`Niveau KYC inconnu : « ${raw} ».`);
    return v;
  }

  private parseCurrency(raw: string): CurrencyCode {
    const v = String(raw ?? '').toUpperCase();
    if (!CURRENCIES.includes(v)) throw new BadRequestException(`Devise inconnue : « ${raw} ».`);
    return v as CurrencyCode;
  }

  private async rowsOf(db: Db | PrismaService, clientId: number): Promise<LimitRow[]> {
    const rows = await db.transferLimit.findMany({
      where: { clientId },
      select: { kycLevel: true, currency: true, perTransaction: true, daily: true, monthly: true, yearly: true, updatedAt: true },
    });
    return rows.map((r) => ({
      kycLevel: String(r.kycLevel),
      currency: String(r.currency),
      perTransaction: num(r.perTransaction),
      daily: num(r.daily),
      monthly: num(r.monthly),
      yearly: num(r.yearly),
      updatedAt: r.updatedAt,
    }));
  }

  async get(user: AuthUserPayload, clientId?: number) {
    const scope = this.readScope(user, clientId);
    const company = await this.prisma.client.findUnique({ where: { id: scope }, select: { id: true, name: true, code: true } });
    if (!company) throw new NotFoundException('Société introuvable.');
    const rows = await this.rowsOf(this.prisma, scope);
    const limits: LimitView[] = [];
    for (const currency of CURRENCIES) {
      for (const level of KYC_LEVELS) {
        limits.push(viewOf(level, currency, rows.find((r) => r.kycLevel === level && r.currency === currency)));
      }
    }
    return { company, editable: user.role === 'COMPANY_ADMIN', currencies: CURRENCIES, levels: [...KYC_LEVELS], limits };
  }

  /** Plafonds appliqués à ce niveau et cette devise : ligne enregistrée, sinon valeurs par défaut. */
  async effectiveLimits(db: Db | PrismaService, clientId: number, level: KycLevelName, currency: string): Promise<Limits> {
    const row = await db.transferLimit.findUnique({
      where: { clientId_kycLevel_currency: { clientId, kycLevel: level as KycLevel, currency: currency as CurrencyCode } },
      select: { perTransaction: true, daily: true, monthly: true, yearly: true },
    });
    if (!row) return defaultLimits(level, currency);
    return { perTransaction: num(row.perTransaction), daily: num(row.daily), monthly: num(row.monthly), yearly: num(row.yearly) };
  }

  /** Montants déjà envoyés par ce client dans cette devise, depuis le début du jour / du mois / de l'année (UTC). */
  async usageOf(db: Db | PrismaService, clientId: number, userId: string, currency: string, now = new Date(), excludeTransactionId?: string): Promise<Usage> {
    const start = periodStarts(now);
    const base = {
      clientId,
      senderId: userId,
      currency: currency as CurrencyCode,
      type: { in: COUNTED_TYPES },
      status: { in: COUNTED_STATUSES },
      ...(excludeTransactionId ? { id: { not: excludeTransactionId } } : {}),
    };
    const sum = async (since: Date) => {
      const r = await db.transaction.aggregate({ where: { ...base, createdAt: { gte: since } }, _sum: { amount: true } });
      return Number(r._sum.amount ?? 0);
    };
    const [daily, monthly, yearly] = await Promise.all([sum(start.day), sum(start.month), sum(start.year)]);
    return { daily, monthly, yearly };
  }

  /**
   * Refuse (403, code LIMIT_EXCEEDED) un envoi qui dépasse les plafonds du niveau KYC de l'expéditeur.
   * Ne fait rien pour un expéditeur qui n'est pas un client (agent, admin).
   * `db` peut être une transaction SQL en cours ; `excludeTransactionId` écarte du cumul l'envoi qui vient d'y être créé.
   */
  async assertWithinLimits(db: Db | PrismaService, p: { clientId: number; userId: string; currency: string; amount: number; excludeTransactionId?: string }): Promise<void> {
    const user = await db.user.findFirst({ where: { id: p.userId, clientId: p.clientId }, select: { role: true, kycLevel: true } });
    if (!user || user.role !== 'USER') return;

    const level = String(user.kycLevel) as KycLevelName;
    const limits = await this.effectiveLimits(db, p.clientId, level, p.currency);
    const needsUsage = limits.daily !== null || limits.monthly !== null || limits.yearly !== null;
    const usage = needsUsage ? await this.usageOf(db, p.clientId, p.userId, p.currency, new Date(), p.excludeTransactionId) : { daily: 0, monthly: 0, yearly: 0 };

    const breach = evaluateLimits(limits, usage, p.amount);
    if (!breach) return;
    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      code: 'LIMIT_EXCEEDED',
      message: breachMessage(breach, p.currency),
      limit: breach.limit,
      max: breach.max,
      used: breach.used,
      remaining: breach.remaining,
      currency: p.currency,
    });
  }

  // ── Écriture (admin de société) ───────────────────────
  async set(user: AuthUserPayload, rawLevel: string, rawCurrency: string, dto: SetLimitsDto): Promise<LimitView> {
    const clientId = this.requireCompanyAdmin(user);
    const level = this.parseLevel(rawLevel);
    const currency = this.parseCurrency(rawCurrency);

    const next: Limits = { perTransaction: dto.perTransaction, daily: dto.daily, monthly: dto.monthly, yearly: dto.yearly };
    for (const k of LIMIT_KEYS) {
      const v = next[k];
      if (v === null) continue;
      if (!Number.isFinite(v) || v < 0 || v > MAX_LIMIT) throw new BadRequestException('Montant invalide.');
      if (!hasAtMostTwoDecimals(v)) throw new BadRequestException('Deux décimales au maximum.');
    }
    const orderError = checkLimitOrder(next);
    if (orderError) throw new BadRequestException(orderError);

    const rows = await this.rowsOf(this.prisma, clientId);
    const before = viewOf(level, currency, rows.find((r) => r.kycLevel === level && r.currency === currency));
    if (before.configured && equalLimits(before, next)) return before;

    await this.prisma.transferLimit.upsert({
      where: { clientId_kycLevel_currency: { clientId, kycLevel: level as KycLevel, currency } },
      create: { clientId, kycLevel: level as KycLevel, currency, ...next, updatedById: user.id },
      update: { ...next, updatedById: user.id },
    });

    await this.audit(user, clientId, LIMIT_ENTITY, `${level}:${currency}`, {
      kycLevel: level,
      currency,
      from: { ...pick(before), configured: before.configured },
      to: { ...next, configured: true },
    });
    return viewOf(level, currency, (await this.rowsOf(this.prisma, clientId)).find((r) => r.kycLevel === level && r.currency === currency));
  }

  async reset(user: AuthUserPayload, rawLevel: string, rawCurrency: string): Promise<LimitView> {
    const clientId = this.requireCompanyAdmin(user);
    const level = this.parseLevel(rawLevel);
    const currency = this.parseCurrency(rawCurrency);

    const before = viewOf(level, currency, (await this.rowsOf(this.prisma, clientId)).find((r) => r.kycLevel === level && r.currency === currency));
    if (!before.configured) return before;

    await this.prisma.transferLimit.deleteMany({ where: { clientId, kycLevel: level as KycLevel, currency } });
    await this.audit(user, clientId, LIMIT_ENTITY, `${level}:${currency}`, {
      kycLevel: level,
      currency,
      from: { ...pick(before), configured: true },
      to: { ...before.defaults, configured: false },
    });
    return viewOf(level, currency, undefined);
  }

  /** L'admin de société fixe le niveau KYC d'un de SES clients (rôle USER). */
  async setUserKycLevel(user: AuthUserPayload, userId: string, rawLevel: string) {
    const clientId = this.requireCompanyAdmin(user);
    const level = this.parseLevel(rawLevel);

    const target = await this.prisma.user.findFirst({
      where: { id: userId, clientId, role: 'USER', deletedAt: null },
      select: { id: true, kycLevel: true },
    });
    if (!target) throw new NotFoundException('Client introuvable.');
    if (String(target.kycLevel) === level) return { userId: target.id, kycLevel: level, changed: false };

    await this.prisma.user.update({ where: { id: target.id }, data: { kycLevel: level as KycLevel } });
    await this.audit(user, clientId, KYC_ENTITY, target.id, { userId: target.id, from: String(target.kycLevel), to: level }, 'USER_UPDATE');
    return { userId: target.id, kycLevel: level, changed: true };
  }

  /** La modification est faite : un échec d'écriture du journal ne doit pas la faire passer pour un échec. */
  private async audit(user: AuthUserPayload, clientId: number, entity: string, entityId: string, details: unknown, action: 'COMMISSION_CONFIG_UPDATE' | 'USER_UPDATE' = 'COMMISSION_CONFIG_UPDATE') {
    try {
      await this.prisma.auditLog.create({
        data: { userId: user.id, clientId, action, entity, entityId, details: details as Prisma.InputJsonValue, successful: true },
      });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (${entity} ${entityId}, société ${clientId}) : ${(err as Error).message}`);
    }
  }

  async history(user: AuthUserPayload, clientId: number | undefined, limit: number) {
    const scope = this.readScope(user, clientId);
    const rows = await this.prisma.auditLog.findMany({
      where: { entity: LIMIT_ENTITY, clientId: scope },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
    return {
      data: rows.map((r) => {
        const d = (r.details ?? {}) as { kycLevel?: string; currency?: string; from?: unknown; to?: unknown };
        return {
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          kycLevel: d.kycLevel ?? null,
          currency: d.currency ?? null,
          from: d.from ?? null,
          to: d.to ?? null,
          user: fullName(r.user),
        };
      }),
    };
  }
}

function pick(l: Limits): Limits {
  return { perTransaction: l.perTransaction, daily: l.daily, monthly: l.monthly, yearly: l.yearly };
}
