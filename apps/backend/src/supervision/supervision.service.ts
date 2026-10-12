// apps/backend/src/supervision/supervision.service.ts
// =========================================================
// SUPERVISION v1.0
//
// Avant ce module, l'écran « Supervision » du mobile appelait /audit-logs et /alerts,
// deux routes qui n'existaient pas : les listes restaient vides en silence, et la
// « santé système » affichée était écrite en dur (toujours « OK »).
//
// Ici tout est calculé sur des données réelles :
//   - overview    : état de la base, activité des 24 dernières heures, sécurité,
//                   sociétés (super admin) et « points d'attention » détectés.
//   - audit-logs  : journal d'audit paginé (sans le champ `details`, qui peut
//                   contenir des données sensibles).
//   - alerts      : alertes paginées + résolution.
//
// Périmètre : SUPER_ADMIN voit toute la plateforme ; COMPANY_ADMIN est
// strictement limité à sa société (clientId du token, jamais celui de la requête).
// =========================================================

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import type { ListAlertsQueryDto, ListAuditLogsQueryDto } from './dto/supervision.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Une transaction encore en cours après ce délai est considérée comme bloquée. */
const STUCK_AFTER_MS = DAY_MS;
/** Un abonnement qui se termine dans ce délai est signalé. */
const EXPIRING_WITHIN_MS = 14 * DAY_MS;
/** Au-delà, la base est jugée lente. */
const SLOW_DB_MS = 500;

const IN_FLIGHT: TransactionStatus[] = [
  TransactionStatus.PENDING,
  TransactionStatus.VALIDATED,
  TransactionStatus.PROCESSING,
];

export type HealthStatus = 'ok' | 'warn' | 'error';
export type AttentionKind =
  | 'STUCK_TRANSACTIONS'
  | 'ON_HOLD_TRANSACTIONS'
  | 'LOCKED_ACCOUNTS'
  | 'SUSPENDED_COMPANIES'
  | 'EXPIRED_COMPANIES'
  | 'EXPIRING_SUBSCRIPTIONS'
  | 'CRITICAL_ALERTS';

export interface AttentionItem {
  kind: AttentionKind;
  severity: 'warn' | 'danger';
  count: number;
}

@Injectable()
export class SupervisionService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────
  // Périmètre
  // ───────────────────────────────────────────────────────

  /** Société imposée par le rôle : undefined = toute la plateforme (super admin). */
  private scopeClientId(user: AuthUserPayload): number | undefined {
    if (user.role === 'SUPER_ADMIN') return undefined;
    if (user.role === 'COMPANY_ADMIN' && user.clientId) return user.clientId;
    throw new ForbiddenException('Accès réservé aux administrateurs');
  }

  /** Société effectivement filtrée : celle du rôle, sinon (super admin) celle demandée. */
  private effectiveClientId(user: AuthUserPayload, requested?: number): number | undefined {
    return this.scopeClientId(user) ?? requested;
  }

  // ───────────────────────────────────────────────────────
  // Vue d'ensemble
  // ───────────────────────────────────────────────────────

  async overview(user: AuthUserPayload) {
    const clientId = this.scopeClientId(user);
    const isSuper = clientId === undefined;
    const now = new Date();
    const since = new Date(now.getTime() - DAY_MS);
    const stuckBefore = new Date(now.getTime() - STUCK_AFTER_MS);
    const soon = new Date(now.getTime() + EXPIRING_WITHIN_MS);

    const txScope: Prisma.TransactionWhereInput = { deletedAt: null, ...(clientId ? { clientId } : {}) };
    const auditScope: Prisma.AuditLogWhereInput = { createdAt: { gte: since }, ...(clientId ? { clientId } : {}) };
    const alertScope: Prisma.AlertWhereInput = { isResolved: false, ...(clientId ? { clientId } : {}) };
    // Les comptes verrouillés d'une société ; pour le super admin, tous ceux de la plateforme.
    const lockedScope: Prisma.UserWhereInput = {
      deletedAt: null,
      lockedUntil: { gt: now },
      ...(clientId ? { clientId } : {}),
    };

    // La société du super admin est la plateforme elle-même : elle n'est pas « hébergée ».
    const hosted: Prisma.ClientWhereInput = { deletedAt: null, ...(user.clientId ? { id: { not: user.clientId } } : {}) };

    const [
      database,
      tx24h,
      failed24h,
      stuck,
      onHold,
      failedLogins,
      lockouts,
      suspicious,
      lockedNow,
      alertsOpen,
      alertsCritical,
      companiesByStatus,
      expiringSoon,
    ] = await Promise.all([
      this.pingDatabase(),
      this.prisma.transaction.count({ where: { ...txScope, createdAt: { gte: since } } }),
      this.prisma.transaction.count({ where: { ...txScope, createdAt: { gte: since }, status: TransactionStatus.FAILED } }),
      this.prisma.transaction.count({ where: { ...txScope, status: { in: IN_FLIGHT }, createdAt: { lt: stuckBefore } } }),
      this.prisma.transaction.count({ where: { ...txScope, status: TransactionStatus.ON_HOLD } }),
      this.prisma.auditLog.count({ where: { ...auditScope, action: 'OTP_FAILED' } }),
      this.prisma.auditLog.count({ where: { ...auditScope, action: 'ACCOUNT_LOCKED' } }),
      this.prisma.auditLog.count({ where: { ...auditScope, action: 'SUSPICIOUS_ACTIVITY' } }),
      this.prisma.user.count({ where: lockedScope }),
      this.prisma.alert.count({ where: alertScope }),
      this.prisma.alert.count({ where: { ...alertScope, severity: { in: ['HIGH', 'CRITICAL'] } } }),
      isSuper
        ? this.prisma.client.groupBy({ by: ['subscriptionStatus'], where: hosted, _count: { _all: true } })
        : Promise.resolve(null),
      isSuper
        ? this.prisma.client.count({
            where: { ...hosted, subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] }, subscriptionEnd: { gt: now, lte: soon } },
          })
        : Promise.resolve(0),
    ]);

    const byStatus = (s: string) => companiesByStatus?.find((g) => g.subscriptionStatus === s)?._count._all ?? 0;
    const companies = companiesByStatus
      ? {
          total: companiesByStatus.reduce((n, g) => n + g._count._all, 0),
          active: byStatus('ACTIVE'),
          trial: byStatus('TRIAL'),
          suspended: byStatus('SUSPENDED'),
          expired: byStatus('EXPIRED'),
          inactive: byStatus('INACTIVE'),
          expiringSoon,
        }
      : null;

    const candidates: AttentionItem[] = [
      { kind: 'CRITICAL_ALERTS', severity: 'danger', count: alertsCritical },
      { kind: 'STUCK_TRANSACTIONS', severity: 'danger', count: stuck },
      { kind: 'ON_HOLD_TRANSACTIONS', severity: 'warn', count: onHold },
      { kind: 'LOCKED_ACCOUNTS', severity: 'warn', count: lockedNow },
      { kind: 'SUSPENDED_COMPANIES', severity: 'danger', count: companies?.suspended ?? 0 },
      { kind: 'EXPIRED_COMPANIES', severity: 'danger', count: companies?.expired ?? 0 },
      { kind: 'EXPIRING_SUBSCRIPTIONS', severity: 'warn', count: companies?.expiringSoon ?? 0 },
    ];
    const attention = candidates.filter((a) => a.count > 0);

    return {
      generatedAt: now.toISOString(),
      scope: isSuper ? 'PLATFORM' : 'COMPANY',
      health: {
        database,
        api: { status: 'ok' as HealthStatus, uptimeSeconds: Math.round(process.uptime()) },
      },
      companies,
      last24h: { transactions: tx24h, failedTransactions: failed24h },
      security: {
        failedOtp24h: failedLogins,
        lockouts24h: lockouts,
        suspicious24h: suspicious,
        lockedAccountsNow: lockedNow,
      },
      alerts: { open: alertsOpen, critical: alertsCritical },
      attention,
    };
  }

  /** État réel de la base : un SELECT 1 chronométré. */
  private async pingDatabase(): Promise<{ status: HealthStatus; latencyMs: number | null }> {
    const t0 = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - t0;
      return { status: latencyMs > SLOW_DB_MS ? 'warn' : 'ok', latencyMs };
    } catch {
      return { status: 'error', latencyMs: null };
    }
  }

  // ───────────────────────────────────────────────────────
  // Journal d'audit
  // ───────────────────────────────────────────────────────

  async auditLogs(user: AuthUserPayload, q: ListAuditLogsQueryDto) {
    const clientId = this.effectiveClientId(user, q.clientId);
    const where: Prisma.AuditLogWhereInput = {
      ...(clientId ? { clientId } : {}),
      ...(q.action ? { action: q.action } : {}),
      ...(q.successful !== undefined ? { successful: q.successful } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        // `details` et `userAgent` sont volontairement exclus : contenu libre, potentiellement sensible.
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          ipAddress: true,
          country: true,
          successful: true,
          errorMsg: true,
          createdAt: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
          client: { select: { id: true, name: true, code: true } },
        },
      }),
    ]);

    return { data: rows, meta: this.meta(total, q.page, q.limit) };
  }

  // ───────────────────────────────────────────────────────
  // Alertes
  // ───────────────────────────────────────────────────────

  async alerts(user: AuthUserPayload, q: ListAlertsQueryDto) {
    const clientId = this.effectiveClientId(user, q.clientId);
    const where: Prisma.AlertWhereInput = {
      ...(clientId ? { clientId } : {}),
      ...(q.severity ? { severity: q.severity } : {}),
      ...(q.status === 'open' ? { isResolved: false } : q.status === 'resolved' ? { isResolved: true } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.alert.count({ where }),
      this.prisma.alert.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        select: {
          id: true,
          type: true,
          severity: true,
          title: true,
          message: true,
          isResolved: true,
          resolvedAt: true,
          createdAt: true,
          client: { select: { id: true, name: true, code: true } },
        },
      }),
    ]);

    return { data: rows, meta: this.meta(total, q.page, q.limit) };
  }

  /** Marque une alerte comme traitée. Idempotent ; un admin de société ne voit que les siennes. */
  async resolveAlert(user: AuthUserPayload, id: string) {
    const clientId = this.scopeClientId(user);
    const alert = await this.prisma.alert.findFirst({
      where: { id, ...(clientId ? { clientId } : {}) },
      select: { id: true, isResolved: true },
    });
    if (!alert) throw new NotFoundException('Alerte introuvable');

    if (!alert.isResolved) {
      await this.prisma.alert.update({
        where: { id },
        data: { isResolved: true, resolvedAt: new Date(), resolvedBy: user.id },
      });
    }
    return { id, isResolved: true };
  }

  private meta(total: number, page: number, limit: number) {
    return { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }
}
