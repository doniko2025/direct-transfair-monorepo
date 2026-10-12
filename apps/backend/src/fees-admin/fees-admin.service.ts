// apps/backend/src/fees-admin/fees-admin.service.ts
// =========================================================
// FEES ADMIN v1.0 — frais d'envoi par société
//
//   mine       : les frais de MA société (admin de société)
//   companies  : les frais de chaque société (super admin, lecture seule)
//   history    : journal des modifications de frais
//   set        : modifie le taux et le frais fixe d'un mode de retrait (admin de société)
//
// L'écriture passe par CommissionsService.upsertFeeConfig : même ligne en base que celle
// lue par transactions.service.ts et par l'application mobile.
// =========================================================

import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { CommissionsService } from '../commissions/commissions.service';
import { PrismaService } from '../prisma/prisma.service';
import type { FeeHistoryQueryDto, SetFeeDto } from './dto/fees-admin.dto';
import { DEFAULT_FEE_RATE, FEE_METHOD_KEYS, FEE_METHODS, hasAtMostTwoDecimals, PLATFORM_CODE } from './fee-rules';

interface FeeRow {
  clientId: number;
  payoutMethod: string | null;
  feeRate: number | null;
  fixedFee: number | null;
  updatedAt: Date;
}

export interface FeeMethodView {
  payoutMethod: string;
  label: string;
  charged: boolean;
  /** Une ligne existe en base. Sinon c'est le taux par défaut du serveur qui s'applique. */
  configured: boolean;
  feeRate: number;
  fixedFee: number;
  /** Mode gratuit mais qui porte un taux enregistré (par l'application mobile) : il n'est jamais appliqué. */
  storedFeeRate: number | null;
  updatedAt: string | null;
}

const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

function viewOf(def: (typeof FEE_METHODS)[number], row: FeeRow | undefined): FeeMethodView {
  if (!def.charged) {
    const stored = row ? num(row.feeRate, 0) : 0;
    return {
      payoutMethod: def.key,
      label: def.label,
      charged: false,
      configured: false,
      feeRate: 0,
      fixedFee: 0,
      storedFeeRate: stored > 0 ? stored : null,
      updatedAt: null,
    };
  }
  return {
    payoutMethod: def.key,
    label: def.label,
    charged: true,
    configured: Boolean(row),
    feeRate: row ? num(row.feeRate, DEFAULT_FEE_RATE) : DEFAULT_FEE_RATE,
    fixedFee: row ? num(row.fixedFee, 0) : 0,
    storedFeeRate: null,
    updatedAt: row ? row.updatedAt.toISOString() : null,
  };
}

function methodsOf(rows: readonly FeeRow[]): FeeMethodView[] {
  return FEE_METHODS.map((def) => viewOf(def, rows.find((r) => r.payoutMethod === def.key)));
}

const fullName = (u: { firstName: string | null; lastName: string | null; email: string } | null): string | null => {
  if (!u) return null;
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.email;
};

@Injectable()
export class FeesAdminService {
  private readonly logger = new Logger(FeesAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commissions: CommissionsService,
  ) {}

  private async rowsOf(clientIds: number[]): Promise<FeeRow[]> {
    if (clientIds.length === 0) return [];
    return this.prisma.commissionConfig.findMany({
      where: { clientId: { in: clientIds }, payoutMethod: { in: [...FEE_METHOD_KEYS] } },
      select: { clientId: true, payoutMethod: true, feeRate: true, fixedFee: true, updatedAt: true },
    });
  }

  async mine(user: AuthUserPayload) {
    if (!user.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    const company = await this.prisma.client.findUnique({
      where: { id: user.clientId },
      select: { id: true, name: true, code: true },
    });
    if (!company) throw new ForbiddenException('Société introuvable.');
    const rows = await this.rowsOf([company.id]);
    return { company, methods: methodsOf(rows) };
  }

  async companies() {
    const clients = await this.prisma.client.findMany({
      where: { deletedAt: null, code: { not: PLATFORM_CODE } },
      select: { id: true, name: true, code: true, subscriptionStatus: true },
      orderBy: { name: 'asc' },
    });
    const rows = await this.rowsOf(clients.map((c) => c.id));
    return {
      companies: clients.map((c) => ({ ...c, methods: methodsOf(rows.filter((r) => r.clientId === c.id)) })),
    };
  }

  async history(user: AuthUserPayload, query: FeeHistoryQueryDto) {
    const isSuper = user.role === 'SUPER_ADMIN';
    if (!isSuper && !user.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    const clientId = isSuper ? query.clientId : user.clientId;

    const rows = await this.prisma.auditLog.findMany({
      where: { action: 'COMMISSION_CONFIG_UPDATE', entity: 'FeeConfig', ...(clientId ? { clientId } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        client: { select: { name: true } },
      },
    });

    return {
      data: rows.map((r) => {
        const d = (r.details ?? {}) as { payoutMethod?: string; from?: unknown; to?: unknown };
        return {
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          payoutMethod: d.payoutMethod ?? null,
          from: d.from ?? null,
          to: d.to ?? null,
          user: fullName(r.user),
          company: r.client?.name ?? null,
        };
      }),
    };
  }

  async set(user: AuthUserPayload, rawMethod: string, dto: SetFeeDto) {
    if (!user.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    const clientId = user.clientId;

    const key = String(rawMethod ?? '').toUpperCase().trim();
    const def = FEE_METHODS.find((m) => m.key === key);
    if (!def) throw new BadRequestException(`Mode d'envoi inconnu : « ${rawMethod} ».`);
    if (!def.charged) {
      throw new BadRequestException(`${def.label} est gratuit : aucun frais n'est prélevé sur ce mode d'envoi.`);
    }
    if (!hasAtMostTwoDecimals(dto.feeRate) || !hasAtMostTwoDecimals(dto.fixedFee)) {
      throw new BadRequestException('Deux décimales au maximum.');
    }

    const before = methodsOf(await this.rowsOf([clientId])).find((m) => m.payoutMethod === key);
    if (before && before.configured && before.feeRate === dto.feeRate && before.fixedFee === dto.fixedFee) {
      return before;
    }

    await this.commissions.upsertFeeConfig(clientId, key, dto.feeRate, dto.fixedFee);

    // La modification est faite : un échec d'écriture du journal ne doit pas la faire passer pour un échec
    // (l'administrateur recommencerait). On le consigne dans les journaux du serveur.
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          clientId,
          action: 'COMMISSION_CONFIG_UPDATE',
          entity: 'FeeConfig',
          entityId: key,
          details: {
            payoutMethod: key,
            from: before ? { feeRate: before.feeRate, fixedFee: before.fixedFee, configured: before.configured } : null,
            to: { feeRate: dto.feeRate, fixedFee: dto.fixedFee },
          },
          successful: true,
        },
      });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (frais ${key}, société ${clientId}) : ${(err as Error).message}`);
    }

    const after = methodsOf(await this.rowsOf([clientId])).find((m) => m.payoutMethod === key);
    return after;
  }
}
