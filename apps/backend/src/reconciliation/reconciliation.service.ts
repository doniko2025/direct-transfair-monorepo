// apps/backend/src/reconciliation/reconciliation.service.ts
// =========================================================
// RÉCONCILIATION QUOTIDIENNE (audit argent I3)
//   • passage automatique chaque nuit à 02:30 (RECONCILIATION_CRON=false pour le couper sur une instance) ;
//   • un rapport par jour, société et devise (relancer le contrôle met le rapport du jour à jour, sans doublon) ;
//   • un écart ouvre une alerte (une seule par société et devise tant qu'elle n'est pas traitée) et prévient les administrateurs ;
//   • lecture : SUPER_ADMIN voit tout, COMPANY_ADMIN uniquement sa société (jamais celle demandée dans la requête).
// Lecture seule sur l'argent : ce service ne corrige rien, il alerte. Un écart se règle à la main, après enquête.
// =========================================================

import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AlertSeverity, Prisma, Role } from '@prisma/client';

import { notifyAdmins } from '../compliance/compliance.core';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { computeReconciliation, DEFAULT_TOLERANCE, describeRow, type ReconRow } from './reconciliation.core';

const dayStart = (d = new Date()): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export interface ReconRunResult { runDate: string; rows: ReconRow[]; alerts: number }

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  private tolerance(): number {
    const v = Number(process.env.RECONCILIATION_TOLERANCE);
    return Number.isFinite(v) && v >= 0 ? v : DEFAULT_TOLERANCE;
  }

  @Cron('30 2 * * *')
  async nightly(): Promise<void> {
    if (String(process.env.RECONCILIATION_CRON ?? '').trim().toLowerCase() === 'false') return;
    try {
      const res = await this.run();
      this.logger.log(`🧮 Réconciliation du ${res.runDate} : ${res.rows.length} ligne(s), ${res.alerts} alerte(s).`);
    } catch (err) {
      this.logger.error(`Réconciliation en échec : ${(err as Error)?.message}`);
    }
  }

  /** Calcule, enregistre le rapport du jour et ouvre les alertes. Lève si la base est illisible (le cron journalise). */
  async run(): Promise<ReconRunResult> {
    if (this.running) throw new ForbiddenException('Une réconciliation est déjà en cours.');
    this.running = true;
    try {
      const runDate = dayStart();
      const rows = await computeReconciliation(this.prisma as unknown as Prisma.TransactionClient, this.tolerance());
      let alerts = 0;
      for (const r of rows) {
        const data = {
          walletsCount: r.walletsCount, walletsBalance: r.walletsBalance, ledgerNet: r.ledgerNet, drift: r.drift,
          driftWallets: r.driftWallets, negativeWallets: r.negativeWallets, reservedIssues: r.reservedIssues,
          inTransitCount: r.inTransitCount, inTransitAmount: r.inTransitAmount, status: r.status,
          problems: r.problems as unknown as Prisma.InputJsonValue,
        };
        await this.prisma.reconciliationReport.upsert({
          where: { runDate_clientId_currency: { runDate, clientId: r.clientId, currency: r.currency } },
          create: { runDate, clientId: r.clientId, currency: r.currency, ...data },
          update: data,
        });
        if (r.status === 'ALERT' && (await this.raiseAlert(r, runDate))) alerts++;
      }
      return { runDate: runDate.toISOString().slice(0, 10), rows, alerts };
    } finally {
      this.running = false;
    }
  }

  /** Une alerte ouverte par société et devise : tant qu'elle n'est pas traitée, on n'en recrée pas chaque nuit. */
  private async raiseAlert(r: ReconRow, runDate: Date): Promise<boolean> {
    try {
      const clientId = r.clientId > 0 ? r.clientId : null;
      const open = await this.prisma.alert.findMany({
        where: { type: 'RECONCILIATION_GAP', isResolved: false, clientId },
        select: { id: true, metadata: true },
        take: 50,
      });
      if (open.some((a) => (a.metadata as { currency?: string } | null)?.currency === r.currency)) return false;

      const severity = r.negativeWallets > 0 || Math.abs(r.drift) > 0 ? AlertSeverity.CRITICAL : AlertSeverity.HIGH;
      const message = `${r.currency} — ${describeRow(r)}. À expliquer avant toute autre vérification (aucune correction automatique).`;
      await this.prisma.alert.create({
        data: {
          clientId, type: 'RECONCILIATION_GAP', severity,
          title: 'Écart de réconciliation des portefeuilles',
          message,
          metadata: { currency: r.currency, runDate: runDate.toISOString().slice(0, 10), drift: r.drift, driftWallets: r.driftWallets, negativeWallets: r.negativeWallets, reservedIssues: r.reservedIssues } as Prisma.InputJsonValue,
        },
      });
      if (clientId) await notifyAdmins(this.prisma as unknown as Prisma.TransactionClient, clientId, '🧮 Écart de réconciliation', message, { kind: 'RECONCILIATION_GAP', currency: r.currency });
      const supers = await this.prisma.user.findMany({ where: { role: Role.SUPER_ADMIN, isActive: true, deletedAt: null }, select: { id: true } });
      await Promise.all(supers.map((u) => this.prisma.notification.create({
        data: { userId: u.id, title: '🧮 Écart de réconciliation', message: `${clientId ? `Société ${clientId} · ` : 'Plateforme · '}${message}`, type: 'WARNING', metadata: { kind: 'RECONCILIATION_GAP', clientId, currency: r.currency } as Prisma.InputJsonValue },
      }).catch(() => undefined)));
      return true;
    } catch (err) {
      this.logger.warn(`Alerte de réconciliation non créée (${r.currency}) : ${(err as Error)?.message}`);
      return false;
    }
  }

  /** Dernier rapport par société et devise + historique des jours (nombre de lignes en alerte). */
  async overview(user: AuthUserPayload, days = 14) {
    const isSuper = user.role === Role.SUPER_ADMIN;
    if (!isSuper && !user.clientId) throw new ForbiddenException('Société inconnue.');
    const span = Math.min(Math.max(Math.trunc(days) || 14, 1), 90);
    const since = new Date(dayStart().getTime() - (span - 1) * 86_400_000);
    const where: Prisma.ReconciliationReportWhereInput = { runDate: { gte: since }, ...(isSuper ? {} : { clientId: user.clientId }) };
    const reports = await this.prisma.reconciliationReport.findMany({ where, orderBy: [{ runDate: 'desc' }, { clientId: 'asc' }, { currency: 'asc' }], take: 5000 });

    const latestDate = reports[0]?.runDate ?? null;
    const latest = latestDate ? reports.filter((r) => r.runDate.getTime() === latestDate.getTime()) : [];
    const byDay = new Map<string, { runDate: string; lines: number; alerts: number }>();
    for (const r of reports) {
      const k = r.runDate.toISOString().slice(0, 10);
      const e = byDay.get(k) ?? { runDate: k, lines: 0, alerts: 0 };
      e.lines++;
      if (r.status === 'ALERT') e.alerts++;
      byDay.set(k, e);
    }
    const num = (v: unknown) => Number(v ?? 0);
    return {
      lastRunDate: latestDate ? latestDate.toISOString().slice(0, 10) : null,
      status: latest.some((r) => r.status === 'ALERT') ? 'ALERT' : latest.length ? 'OK' : 'NEVER',
      rows: latest.map((r) => ({
        id: r.id, clientId: r.clientId, currency: r.currency, status: r.status,
        walletsCount: r.walletsCount, walletsBalance: num(r.walletsBalance), ledgerNet: num(r.ledgerNet), drift: num(r.drift),
        driftWallets: r.driftWallets, negativeWallets: r.negativeWallets, reservedIssues: r.reservedIssues,
        inTransitCount: r.inTransitCount, inTransitAmount: num(r.inTransitAmount),
        problems: (r.problems as unknown[] | null) ?? [], updatedAt: r.updatedAt,
      })),
      history: [...byDay.values()].sort((a, b) => a.runDate.localeCompare(b.runDate)),
    };
  }
}
