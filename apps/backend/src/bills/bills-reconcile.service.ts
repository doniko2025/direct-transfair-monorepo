// apps/backend/src/bills/bills-reconcile.service.ts
// =========================================================
// RAPPROCHEMENT AUTOMATIQUE — côté administrateur de la société (lot 14b)
//   La société importe le relevé (CSV) d'un facturier ; le serveur le compare aux factures qu'elle a réglées auprès de lui
//   et rend les écarts : montants différents, factures réglées mais absentes du relevé (argent à réclamer), lignes du relevé
//   inconnues chez nous, doublons. Sans état : rien n'est enregistré (aucune migration), le relevé n'est jamais conservé.
// Réservé au COMPANY_ADMIN, limité au catalogue de SA société. Un super-administrateur ne voit rien.
// =========================================================

import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import { toCsv } from './bills.rules';
import {
  KIND_LABEL_FR, MAX_LINES, MAX_ROWS_PER_BUCKET, parseCsv, reconcile, suggestMapping, toLines,
  type ColumnMapping, type OurPayment, type ReconcileKind, type ReconcileRow,
} from './bills.reconcile';
import type { ReconcileDto } from './dto/bills.dto';

const DAY = 24 * 3_600_000;
const ORDER: ReconcileKind[] = ['MISSING_AT_BILLER', 'AMOUNT_MISMATCH', 'UNKNOWN_AT_BILLER', 'DUPLICATE_LINE', 'MATCHED'];

const dayStart = (iso: string): Date => {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(d.getTime())) throw new BadRequestException('Date invalide : format attendu AAAA-MM-JJ.');
  return d;
};

@Injectable()
export class BillsReconcileService {
  private readonly logger = new Logger(BillsReconcileService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async scope(actor: AuthUserPayload): Promise<{ id: string; clientId: number }> {
    const u = await this.prisma.user.findUnique({ where: { id: actor.id }, select: { id: true, role: true, clientId: true, isActive: true, isSuspended: true, deletedAt: true } });
    if (!u || u.deletedAt || !u.isActive || u.isSuspended || u.role !== 'COMPANY_ADMIN' || !u.clientId) throw new ForbiddenException("Réservé à l'administrateur de la société.");
    return { id: u.id, clientId: u.clientId };
  }

  /** Cœur du rapprochement (sans journal d'audit ni découpage) — partagé par l'écran et l'export. */
  private async compute(me: { id: string; clientId: number }, dto: ReconcileDto) {
    const biller = await this.prisma.biller.findFirst({ where: { id: dto.billerId, clientId: me.clientId }, select: { id: true, name: true, currency: true } });
    if (!biller) throw new NotFoundException('Facturier introuvable.');

    const parsed = parseCsv(dto.csv, dto.delimiter);
    if (parsed.headers.length < 1 || parsed.rows.length === 0) throw new BadRequestException('Le fichier est vide ou illisible : un en-tête et au moins une ligne sont attendus.');
    if (parsed.rows.length > MAX_LINES) throw new BadRequestException(`${MAX_LINES} lignes au maximum par fichier : découpez-le par période.`);

    const mapping: ColumnMapping | null = dto.mapping ? { amount: dto.mapping.amount, providerRef: dto.mapping.providerRef ?? null, reference: dto.mapping.reference ?? null, date: dto.mapping.date ?? null } : suggestMapping(parsed.headers);
    if (!mapping) {
      return { biller, parsed, mapping: null, needsMapping: true as const };
    }
    if (!mapping.providerRef && !mapping.reference) throw new BadRequestException("Indiquez au moins la colonne du numéro d'opération ou celle de la référence du client.");

    let lines;
    let invalidAmounts: number[];
    try {
      ({ lines, invalidAmounts } = toLines(parsed, mapping));
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    // Période : explicite, sinon déduite des dates du fichier (± 2 jours), sinon les 62 derniers jours.
    const dates = lines.map((l) => l.date?.getTime()).filter((t): t is number => typeof t === 'number');
    const to = dto.to ? new Date(dayStart(dto.to).getTime() + DAY - 1) : dates.length ? new Date(Math.max(...dates) + 3 * DAY - 1) : new Date();
    const from = dto.from ? dayStart(dto.from) : dates.length ? new Date(Math.min(...dates) - 2 * DAY) : new Date(to.getTime() - 62 * DAY);
    if (from.getTime() > to.getTime()) throw new BadRequestException('La date de début suit la date de fin.');

    const rows = await this.prisma.billPayment.findMany({
      where: {
        clientId: me.clientId,
        billerId: biller.id,
        OR: [
          { status: 'COMPLETED', completedAt: { gte: from, lte: to } },
          { status: 'PROCESSING', createdAt: { lte: to } },
        ],
      },
      select: { id: true, reference: true, accountRef: true, providerRef: true, amount: true, currency: true, status: true, completedAt: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: MAX_LINES,
    });
    const payments: OurPayment[] = rows.map((r) => ({ id: r.id, reference: r.reference, accountRef: r.accountRef, providerRef: r.providerRef, amount: Number(r.amount), currency: String(r.currency), status: r.status, at: r.completedAt ?? r.createdAt }));
    const result = reconcile(lines, payments, { tolerance: dto.tolerance });
    return { biller, parsed, mapping, needsMapping: false as const, lines, invalidAmounts, from, to, paymentsCount: payments.length, result };
  }

  async run(actor: AuthUserPayload, dto: ReconcileDto) {
    const me = await this.scope(actor);
    const c = await this.compute(me, dto);
    if (c.needsMapping) {
      return { needsMapping: true as const, biller: c.biller, delimiter: c.parsed.delimiter, headers: c.parsed.headers, sample: c.parsed.rows.slice(0, 3) };
    }
    const sorted = [...c.result.rows].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
    const rows: ReconcileRow[] = [];
    let truncated = false;
    for (const kind of ORDER) {
      const bucket = sorted.filter((r) => r.kind === kind);
      if (bucket.length > MAX_ROWS_PER_BUCKET) truncated = true;
      rows.push(...bucket.slice(0, MAX_ROWS_PER_BUCKET));
    }
    try {
      await this.prisma.auditLog.create({
        data: { userId: me.id, clientId: me.clientId, action: 'BILL_RECONCILE', entity: 'Biller', entityId: c.biller.id, details: { lines: c.lines.length, counts: c.result.counts, totals: c.result.totals, period: [c.from.toISOString(), c.to.toISOString()] } as Prisma.InputJsonValue, successful: true },
      });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (rapprochement ${c.biller.id}) : ${(err as Error).message}`);
    }
    return {
      needsMapping: false as const,
      biller: c.biller,
      delimiter: c.parsed.delimiter,
      headers: c.parsed.headers,
      mapping: c.mapping,
      period: { from: c.from.toISOString().slice(0, 10), to: c.to.toISOString().slice(0, 10) },
      fileLines: c.lines.length,
      ourPayments: c.paymentsCount,
      invalidAmountLines: c.invalidAmounts.slice(0, 20),
      invalidAmountCount: c.invalidAmounts.length,
      counts: c.result.counts,
      totals: c.result.totals,
      truncated,
      rows,
    };
  }

  /** Les écarts seulement (tout sauf « concordant »), en CSV ouvrable dans un tableur. */
  async exportCsv(actor: AuthUserPayload, dto: ReconcileDto): Promise<string> {
    const me = await this.scope(actor);
    const c = await this.compute(me, dto);
    if (c.needsMapping) throw new BadRequestException('Choisissez d\'abord les colonnes du fichier.');
    const issues = c.result.rows.filter((r) => r.kind !== 'MATCHED').sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
    const header = ['Écart', 'Ligne du fichier', 'Date (fichier)', 'Référence (fichier)', "N° d'opération (fichier)", 'Montant (fichier)', 'Facture (nous)', 'Référence saisie (nous)', "N° d'opération (nous)", 'Montant (nous)', 'Différence'];
    const body = issues.map((r) => [KIND_LABEL_FR[r.kind], r.line, r.fileDate, r.fileRef, r.fileProviderRef, r.fileAmount, r.paymentReference, r.paymentAccountRef, r.paymentProviderRef, r.paymentAmount, r.diff]);
    return `﻿${toCsv(header, body)}`;
  }
}
