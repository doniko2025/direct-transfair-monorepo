// apps/backend/src/validation-thresholds/validation-thresholds.service.ts
// =========================================================
// VALIDATION THRESHOLDS v1.0 — seuil de validation d'un envoi cash, par société et par devise
//
//   get()           les seuils de la société (une ligne par devise, valeur par défaut si non réglé)
//   set()           fixe le seuil d'une devise (admin de société uniquement)
//   reset()         revient à la valeur par défaut du serveur (admin de société uniquement)
//   history()       journal des modifications
//   thresholdFor()  utilisé par TransactionsService.create() et AgentDeskService.sendPreview()
//
// Règle : montant ≤ seuil → envoi validé d'office ; montant > seuil → en attente de validation.
// Sans réglage, on applique DEFAULT_VALIDATION_THRESHOLD (500 000), la valeur qui était codée en dur
// avant cette version : rien ne change tant que l'admin n'a rien réglé. Le super admin consulte, il ne fixe pas.
// =========================================================

import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CurrencyCode, type Prisma } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { hasAtMostTwoDecimals } from '../fees-admin/fee-rules';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_THRESHOLD, type SetThresholdDto } from './dto/validation-threshold.dto';

/** Seuil appliqué tant que l'admin de la société n'a rien réglé (ancienne valeur codée en dur). */
export const DEFAULT_VALIDATION_THRESHOLD = 500_000;

export const THRESHOLD_ENTITY = 'ValidationThreshold';

export interface ThresholdView {
  currency: string;
  /** Seuil réellement appliqué (valeur réglée, sinon valeur par défaut). */
  amount: number;
  /** Une valeur a été réglée par l'admin. Sinon `amount` est la valeur par défaut du serveur. */
  configured: boolean;
  defaultAmount: number;
  updatedAt: string | null;
}

interface ThresholdRow {
  currency: string;
  amount: unknown;
  updatedAt: Date;
}

const CURRENCIES = Object.values(CurrencyCode) as string[];

const fullName = (u: { firstName: string | null; lastName: string | null; email: string } | null): string | null => {
  if (!u) return null;
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.email;
};

function viewOf(currency: string, row: ThresholdRow | undefined): ThresholdView {
  return {
    currency,
    amount: row ? Number(row.amount) : DEFAULT_VALIDATION_THRESHOLD,
    configured: Boolean(row),
    defaultAmount: DEFAULT_VALIDATION_THRESHOLD,
    updatedAt: row ? row.updatedAt.toISOString() : null,
  };
}

/** Un envoi de `amount` doit-il attendre la validation d'un administrateur ? */
export function needsValidation(amount: number, threshold: number): boolean {
  return amount > threshold;
}

@Injectable()
export class ValidationThresholdsService {
  private readonly logger = new Logger(ValidationThresholdsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private readScope(user: AuthUserPayload, clientId?: number): number {
    if (user.role === 'SUPER_ADMIN') {
      if (!clientId) throw new BadRequestException('Précisez la société (clientId).');
      return clientId;
    }
    if (!user.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    return user.clientId;
  }

  private parseCurrency(raw: string): CurrencyCode {
    const code = String(raw ?? '').toUpperCase();
    if (!CURRENCIES.includes(code)) throw new BadRequestException(`Devise inconnue : « ${raw} ».`);
    return code as CurrencyCode;
  }

  private rowsOf(clientId: number): Promise<ThresholdRow[]> {
    return this.prisma.validationThreshold.findMany({
      where: { clientId },
      select: { currency: true, amount: true, updatedAt: true },
    }) as unknown as Promise<ThresholdRow[]>;
  }

  /** Seuil appliqué à un envoi de cette société dans cette devise. */
  async thresholdFor(clientId: number, currency: string): Promise<number> {
    const row = await this.prisma.validationThreshold.findUnique({
      where: { clientId_currency: { clientId, currency: currency as CurrencyCode } },
      select: { amount: true },
    });
    return row ? Number(row.amount) : DEFAULT_VALIDATION_THRESHOLD;
  }

  async get(user: AuthUserPayload, clientId?: number) {
    const scope = this.readScope(user, clientId);
    const company = await this.prisma.client.findUnique({ where: { id: scope }, select: { id: true, name: true, code: true } });
    if (!company) throw new NotFoundException('Société introuvable.');
    const rows = await this.rowsOf(scope);
    return {
      company,
      editable: user.role === 'COMPANY_ADMIN',
      defaultAmount: DEFAULT_VALIDATION_THRESHOLD,
      thresholds: CURRENCIES.map((c) => viewOf(c, rows.find((r) => String(r.currency) === c))),
    };
  }

  private requireCompanyAdmin(user: AuthUserPayload): number {
    if (user.role !== 'COMPANY_ADMIN' || !user.clientId) {
      throw new ForbiddenException("Seul l'administrateur de la société fixe son seuil de validation.");
    }
    return user.clientId;
  }

  async set(user: AuthUserPayload, rawCurrency: string, dto: SetThresholdDto): Promise<ThresholdView> {
    const clientId = this.requireCompanyAdmin(user);
    const currency = this.parseCurrency(rawCurrency);

    if (!Number.isFinite(dto.amount) || dto.amount < 0 || dto.amount > MAX_THRESHOLD) {
      throw new BadRequestException('Montant invalide.');
    }
    if (!hasAtMostTwoDecimals(dto.amount)) throw new BadRequestException('Deux décimales au maximum.');

    const before = viewOf(currency, (await this.rowsOf(clientId)).find((r) => String(r.currency) === currency));
    if (before.configured && before.amount === dto.amount) return before;

    await this.prisma.validationThreshold.upsert({
      where: { clientId_currency: { clientId, currency } },
      create: { clientId, currency, amount: dto.amount, updatedById: user.id },
      update: { amount: dto.amount, updatedById: user.id },
    });

    await this.audit(user, clientId, currency, { amount: before.amount, configured: before.configured }, { amount: dto.amount, configured: true });
    return viewOf(currency, (await this.rowsOf(clientId)).find((r) => String(r.currency) === currency));
  }

  async reset(user: AuthUserPayload, rawCurrency: string): Promise<ThresholdView> {
    const clientId = this.requireCompanyAdmin(user);
    const currency = this.parseCurrency(rawCurrency);

    const before = viewOf(currency, (await this.rowsOf(clientId)).find((r) => String(r.currency) === currency));
    if (!before.configured) return before;

    await this.prisma.validationThreshold.deleteMany({ where: { clientId, currency } });
    await this.audit(user, clientId, currency, { amount: before.amount, configured: true }, { amount: DEFAULT_VALIDATION_THRESHOLD, configured: false });
    return viewOf(currency, undefined);
  }

  /** La modification est faite : un échec d'écriture du journal ne doit pas la faire passer pour un échec. */
  private async audit(user: AuthUserPayload, clientId: number, currency: string, from: unknown, to: unknown) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          clientId,
          action: 'COMMISSION_CONFIG_UPDATE',
          entity: THRESHOLD_ENTITY,
          entityId: currency,
          details: { currency, from, to } as Prisma.InputJsonValue,
          successful: true,
        },
      });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (seuil ${currency}, société ${clientId}) : ${(err as Error).message}`);
    }
  }

  async history(user: AuthUserPayload, clientId: number | undefined, limit: number) {
    const scope = this.readScope(user, clientId);
    const rows = await this.prisma.auditLog.findMany({
      where: { action: 'COMMISSION_CONFIG_UPDATE', entity: THRESHOLD_ENTITY, clientId: scope },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
    return {
      data: rows.map((r) => {
        const d = (r.details ?? {}) as { currency?: string; from?: unknown; to?: unknown };
        return {
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          currency: d.currency ?? r.entityId ?? null,
          from: d.from ?? null,
          to: d.to ?? null,
          user: fullName(r.user),
        };
      }),
    };
  }
}
