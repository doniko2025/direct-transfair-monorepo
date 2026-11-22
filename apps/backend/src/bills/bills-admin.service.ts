// apps/backend/src/bills/bills-admin.service.ts
// =========================================================
// PAIEMENT DE FACTURES — côté administrateur de la société (lot 14)
//
//   catalogue   créer / modifier / retirer les facturiers de LA société (frais, plafonds, champs demandés, connecteur,
//               suivi du partenariat, coordonnées de règlement, délai annoncé au client)
//   file        les factures payées par les clients, à régler au facturier : « je m'en occupe », « réglée » (reçu / jeton),
//               « refusée » (le client est remboursé), filtre « en retard », statistiques, export CSV
//
// Réservé à l'administrateur de la société : un super-administrateur ne voit RIEN des opérations d'une société.
// =========================================================

import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, type Biller } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import { SUPPORTED_CURRENCIES } from '../wallets/wallets.service';
import { BillConnectorsService } from './bills.connectors';
import { assertSafePattern, isLate, normalizeCategory, parseFieldDefs, toCsv } from './bills.rules';
import { BillsSettlementService } from './bills-settlement.service';
import type { AdminPaymentsQueryDto, BillerDto, ProcessBillDto, UpdateBillerDto } from './dto/bills.dto';

const OPEN_STATUSES = ['SUBMITTED', 'PROCESSING'] as const;
const MAX_BILLERS = 300;

/** Vue complète d'un facturier pour l'administrateur (avec suivi du partenariat et coordonnées de règlement). */
function adminBiller(b: Biller) {
  return {
    id: b.id,
    name: b.name,
    category: b.category,
    country: b.country,
    currency: b.currency,
    description: b.description,
    status: b.status,
    connectorKey: b.connectorKey,
    referenceLabel: b.referenceLabel,
    referenceHint: b.referenceHint,
    referencePattern: b.referencePattern,
    fields: b.fields ?? [],
    amountMode: b.amountMode,
    minAmount: b.minAmount === null ? null : Number(b.minAmount),
    maxAmount: b.maxAmount === null ? null : Number(b.maxAmount),
    feeFixed: Number(b.feeFixed),
    feePct: Number(b.feePct),
    partnershipStatus: b.partnershipStatus,
    settlementInfo: b.settlementInfo,
    settlementDelayHours: b.settlementDelayHours,
    internalNote: b.internalNote,
    sortOrder: b.sortOrder,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

const text = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t ? t : null;
};

@Injectable()
export class BillsAdminService {
  private readonly logger = new Logger(BillsAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectors: BillConnectorsService,
    private readonly settlement: BillsSettlementService,
  ) {}

  /** Administrateur de société actif → son identifiant de société. */
  private async scope(actor: AuthUserPayload): Promise<{ id: string; clientId: number }> {
    const u = await this.prisma.user.findUnique({ where: { id: actor.id }, select: { id: true, role: true, clientId: true, isActive: true, isSuspended: true, deletedAt: true } });
    if (!u || u.deletedAt || !u.isActive || u.isSuspended || u.role !== 'COMPANY_ADMIN' || !u.clientId) {
      throw new ForbiddenException("Réservé à l'administrateur de la société.");
    }
    return { id: u.id, clientId: u.clientId };
  }

  private async audit(userId: string, clientId: number, action: 'BILLER_CREATE' | 'BILLER_UPDATE' | 'BILL_PAYMENT_PROCESS', entity: string, entityId: string, details: Record<string, unknown>) {
    try {
      await this.prisma.auditLog.create({ data: { userId, clientId, action, entity, entityId, details: details as Prisma.InputJsonValue, successful: true } });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (${action} ${entityId}) : ${(err as Error).message}`);
    }
  }

  // ── Catalogue ──────────────────────────────────────────

  /** Connecteurs disponibles sur ce serveur (liste déroulante du formulaire). */
  meta() {
    return { connectors: this.connectors.available() };
  }

  async listBillers(actor: AuthUserPayload) {
    const { clientId } = await this.scope(actor);
    const rows = await this.prisma.biller.findMany({ where: { clientId }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], take: MAX_BILLERS });
    const open = await this.prisma.billPayment.groupBy({ by: ['billerId'], where: { clientId, status: { in: [...OPEN_STATUSES] } }, _count: { _all: true } });
    const openBy = new Map(open.map((o) => [o.billerId, o._count._all]));
    return rows.map((b) => ({ ...adminBiller(b), openPayments: openBy.get(b.id) ?? 0 }));
  }

  private checkConnector(key: string) {
    if (!this.connectors.get(key)) throw new BadRequestException(`Connecteur « ${key} » indisponible sur ce serveur.`);
  }

  /** « Montant fourni par le facturier » n'a de sens que si le connecteur sait interroger la facture. */
  private checkAmountMode(amountMode: string | undefined, connectorKey: string) {
    if (amountMode === 'FROM_LOOKUP' && !this.connectors.supportsLookup(connectorKey)) {
      throw new BadRequestException("Le montant ne peut venir du facturier que si le mode de règlement sait interroger la facture. Choisissez « Montant libre » : le client saisira lui-même le montant.");
    }
  }

  private checkBounds(min: number | null | undefined, max: number | null | undefined) {
    if (min !== null && min !== undefined && max !== null && max !== undefined && min > max) throw new BadRequestException('Le montant minimum dépasse le maximum.');
  }

  async createBiller(actor: AuthUserPayload, dto: BillerDto) {
    const { id: adminId, clientId } = await this.scope(actor);
    const currency = dto.currency.toUpperCase();
    if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(currency)) throw new BadRequestException('Devise non prise en charge.');
    const connectorKey = dto.connectorKey?.trim() || 'manual';
    this.checkConnector(connectorKey);
    this.checkAmountMode(dto.amountMode ?? 'FREE', connectorKey);
    this.checkBounds(dto.minAmount, dto.maxAmount);
    if ((await this.prisma.biller.count({ where: { clientId } })) >= MAX_BILLERS) throw new BadRequestException(`${MAX_BILLERS} facturiers au maximum.`);

    try {
      const b = await this.prisma.biller.create({
        data: {
          clientId,
          name: dto.name.trim(),
          category: normalizeCategory(dto.category),
          country: dto.country ? dto.country.toUpperCase() : null,
          currency: currency as never,
          description: text(dto.description),
          status: (dto.status ?? 'DRAFT') as never,
          connectorKey,
          referenceLabel: text(dto.referenceLabel) ?? 'Numéro de facture',
          referenceHint: text(dto.referenceHint),
          referencePattern: assertSafePattern(dto.referencePattern, 'Format de la référence'),
          fields: parseFieldDefs(dto.fields) as unknown as Prisma.InputJsonValue,
          amountMode: (dto.amountMode ?? 'FREE') as never,
          minAmount: dto.minAmount ?? null,
          maxAmount: dto.maxAmount ?? null,
          feeFixed: dto.feeFixed ?? 0,
          feePct: dto.feePct ?? 0,
          partnershipStatus: (dto.partnershipStatus ?? 'NONE') as never,
          settlementInfo: text(dto.settlementInfo),
          settlementDelayHours: dto.settlementDelayHours ?? 24,
          internalNote: text(dto.internalNote),
          sortOrder: dto.sortOrder ?? 0,
        },
      });
      await this.audit(adminId, clientId, 'BILLER_CREATE', 'Biller', b.id, { name: b.name, category: b.category, connectorKey, status: b.status });
      return adminBiller(b);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException('Un facturier porte déjà ce nom.');
      throw err;
    }
  }

  private async own(clientId: number, id: string): Promise<Biller> {
    const b = await this.prisma.biller.findFirst({ where: { id, clientId } });
    if (!b) throw new NotFoundException('Facturier introuvable.');
    return b;
  }

  async updateBiller(actor: AuthUserPayload, id: string, dto: UpdateBillerDto) {
    const { id: adminId, clientId } = await this.scope(actor);
    const current = await this.own(clientId, id);
    const data: Prisma.BillerUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.category !== undefined) data.category = normalizeCategory(dto.category);
    if (dto.country !== undefined) data.country = dto.country ? dto.country.toUpperCase() : null;
    if (dto.currency !== undefined) {
      const c = dto.currency.toUpperCase();
      if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(c)) throw new BadRequestException('Devise non prise en charge.');
      // Changer de devise avec des factures en cours fausserait les montants à régler.
      if (c !== current.currency && (await this.prisma.billPayment.count({ where: { billerId: id, status: { in: [...OPEN_STATUSES] } } })) > 0) {
        throw new ConflictException('Des factures de ce facturier sont encore à régler : changez la devise après leur traitement.');
      }
      data.currency = c as never;
    }
    if (dto.description !== undefined) data.description = text(dto.description);
    if (dto.status !== undefined) data.status = dto.status as never;
    if (dto.connectorKey !== undefined) {
      const k = dto.connectorKey.trim() || 'manual';
      this.checkConnector(k);
      data.connectorKey = k;
    }
    if (dto.referenceLabel !== undefined) data.referenceLabel = text(dto.referenceLabel) ?? 'Numéro de facture';
    if (dto.referenceHint !== undefined) data.referenceHint = text(dto.referenceHint);
    if (dto.referencePattern !== undefined) data.referencePattern = assertSafePattern(dto.referencePattern, 'Format de la référence');
    if (dto.fields !== undefined) data.fields = parseFieldDefs(dto.fields) as unknown as Prisma.InputJsonValue;
    if (dto.amountMode !== undefined) data.amountMode = dto.amountMode as never;
    // Cohérence mode du montant ↔ connecteur, sur les valeurs finales (celles du formulaire, sinon celles déjà enregistrées).
    this.checkAmountMode(dto.amountMode ?? current.amountMode, dto.connectorKey !== undefined ? (dto.connectorKey.trim() || 'manual') : current.connectorKey);
    if (dto.minAmount !== undefined) data.minAmount = dto.minAmount;
    if (dto.maxAmount !== undefined) data.maxAmount = dto.maxAmount;
    if (dto.feeFixed !== undefined) data.feeFixed = dto.feeFixed;
    if (dto.feePct !== undefined) data.feePct = dto.feePct;
    if (dto.partnershipStatus !== undefined) data.partnershipStatus = dto.partnershipStatus as never;
    if (dto.settlementInfo !== undefined) data.settlementInfo = text(dto.settlementInfo);
    if (dto.settlementDelayHours !== undefined) data.settlementDelayHours = dto.settlementDelayHours;
    if (dto.internalNote !== undefined) data.internalNote = text(dto.internalNote);
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    this.checkBounds(
      dto.minAmount !== undefined ? dto.minAmount : current.minAmount === null ? null : Number(current.minAmount),
      dto.maxAmount !== undefined ? dto.maxAmount : current.maxAmount === null ? null : Number(current.maxAmount),
    );
    if (Object.keys(data).length === 0) return adminBiller(current);

    try {
      const b = await this.prisma.biller.update({ where: { id }, data });
      await this.audit(adminId, clientId, 'BILLER_UPDATE', 'Biller', id, { changed: Object.keys(data), status: b.status });
      return adminBiller(b);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException('Un facturier porte déjà ce nom.');
      throw err;
    }
  }

  /** Suppression possible seulement s'il n'y a eu aucun paiement (sinon : le suspendre, l'historique des clients reste lisible). */
  async removeBiller(actor: AuthUserPayload, id: string) {
    const { id: adminId, clientId } = await this.scope(actor);
    const b = await this.own(clientId, id);
    if ((await this.prisma.billPayment.count({ where: { billerId: id } })) > 0) {
      throw new ConflictException('Ce facturier a déjà reçu des paiements : suspendez-le plutôt que de le supprimer.');
    }
    await this.prisma.$transaction([this.prisma.savedBill.deleteMany({ where: { billerId: id } }), this.prisma.biller.delete({ where: { id } })]);
    await this.audit(adminId, clientId, 'BILLER_UPDATE', 'Biller', id, { removed: true, name: b.name });
    return { removed: true };
  }

  // ── File des factures à régler ─────────────────────────

  private async whereFor(clientId: number, q: AdminPaymentsQueryDto, now: Date): Promise<Prisma.BillPaymentWhereInput> {
    const where: Prisma.BillPaymentWhereInput = { clientId };
    if (q.status === 'OPEN' || q.late) where.status = { in: [...OPEN_STATUSES] };
    else if (q.status) where.status = q.status as never;
    if (q.billerId) where.billerId = q.billerId;
    if (q.q?.trim()) {
      const t = q.q.trim();
      where.OR = [{ reference: { contains: t, mode: 'insensitive' } }, { accountRef: { contains: t, mode: 'insensitive' } }, { providerRef: { contains: t, mode: 'insensitive' } }];
    }
    const range: Prisma.DateTimeFilter = {};
    if (q.from && !Number.isNaN(Date.parse(q.from))) range.gte = new Date(`${q.from}T00:00:00.000Z`);
    if (q.to && !Number.isNaN(Date.parse(q.to))) range.lte = new Date(`${q.to}T23:59:59.999Z`);
    if (range.gte || range.lte) where.createdAt = range;
    if (q.late) {
      // « En retard » dépend du délai annoncé par chaque facturier : une condition par facturier.
      const billers = await this.prisma.biller.findMany({ where: { clientId }, select: { id: true, settlementDelayHours: true } });
      const late = billers.map((b) => ({ billerId: b.id, createdAt: { lt: new Date(now.getTime() - b.settlementDelayHours * 3_600_000) } }));
      where.AND = [{ OR: late.length ? late : [{ id: '__none__' }] }];
    }
    return where;
  }

  private row(p: Prisma.BillPaymentGetPayload<{ include: { biller: true; payer: { select: { id: true; firstName: true; lastName: true; email: true; phone: true } } } }>, now: Date) {
    return {
      id: p.id,
      reference: p.reference,
      status: p.status,
      late: isLate(p, p.biller.settlementDelayHours, now),
      biller: { id: p.biller.id, name: p.biller.name, category: p.biller.category, settlementInfo: p.biller.settlementInfo },
      accountRef: p.accountRef,
      referenceLabel: p.biller.referenceLabel,
      fields: p.fields ?? {},
      customerName: p.customerName,
      amount: Number(p.amount),
      currency: p.currency,
      totalCharged: Number(p.totalCharged),
      walletCurrency: p.walletCurrency,
      feeCharged: Number(p.feeCharged),
      payer: { id: p.payer.id, name: [p.payer.firstName, p.payer.lastName].filter(Boolean).join(' ') || p.payer.email, phone: p.payer.phone },
      providerRef: p.providerRef,
      token: p.token,
      receiptNote: p.receiptNote,
      failureReason: p.failureReason,
      createdAt: p.createdAt,
      completedAt: p.completedAt,
      refundedAt: p.refundedAt,
      simulated: p.connectorKey === 'sandbox',
    };
  }

  private static readonly INCLUDE = {
    biller: true,
    payer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
  } satisfies Prisma.BillPaymentInclude;

  async listPayments(actor: AuthUserPayload, q: AdminPaymentsQueryDto) {
    const { clientId } = await this.scope(actor);
    const now = new Date();
    const page = q.page ?? 1;
    const limit = q.limit ?? 30;
    const where = await this.whereFor(clientId, q, now);
    const open = q.status === 'OPEN' || q.status === 'SUBMITTED' || q.status === 'PROCESSING' || q.late;
    const [rows, total] = await Promise.all([
      this.prisma.billPayment.findMany({ where, include: BillsAdminService.INCLUDE, orderBy: { createdAt: open ? 'asc' : 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.billPayment.count({ where }),
    ]);
    return { data: rows.map((r) => this.row(r, now)), meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) } };
  }

  /** Tableau de bord : combien à régler, combien en retard, quels montants par facturier et par devise. */
  async stats(actor: AuthUserPayload) {
    const { clientId } = await this.scope(actor);
    const now = new Date();
    const open = await this.prisma.billPayment.findMany({
      where: { clientId, status: { in: [...OPEN_STATUSES] } },
      select: { status: true, amount: true, currency: true, createdAt: true, billerId: true, biller: { select: { name: true, settlementDelayHours: true } } },
      take: 5000,
    });
    const byBiller = new Map<string, { billerId: string; name: string; currency: string; count: number; amount: number; late: number }>();
    let late = 0;
    for (const p of open) {
      const isL = isLate(p, p.biller.settlementDelayHours, now);
      if (isL) late += 1;
      const key = `${p.billerId}:${p.currency}`;
      const cur = byBiller.get(key) ?? { billerId: p.billerId, name: p.biller.name, currency: String(p.currency), count: 0, amount: 0, late: 0 };
      cur.count += 1;
      cur.amount += Number(p.amount);
      if (isL) cur.late += 1;
      byBiller.set(key, cur);
    }
    const since = new Date(now.getTime() - 30 * 24 * 3_600_000);
    const [completed30, refunded30] = await Promise.all([
      this.prisma.billPayment.count({ where: { clientId, status: 'COMPLETED', completedAt: { gte: since } } }),
      this.prisma.billPayment.count({ where: { clientId, status: 'REFUNDED', refundedAt: { gte: since } } }),
    ]);
    return {
      toSettle: open.length,
      processing: open.filter((p) => p.status === 'PROCESSING').length,
      late,
      completed30,
      refunded30,
      byBiller: [...byBiller.values()].sort((a, b) => b.late - a.late || b.amount - a.amount),
    };
  }

  /** Traitement d'une facture : « je m'en occupe », « réglée » (avec le reçu du facturier) ou « refusée » (le client est remboursé). */
  async process(actor: AuthUserPayload, id: string, dto: ProcessBillDto) {
    const { id: adminId, clientId } = await this.scope(actor);
    const existing = await this.prisma.billPayment.findFirst({ where: { id, clientId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Paiement de facture introuvable.');

    if (dto.action === 'PROCESSING') {
      await this.settlement.markProcessing(id, adminId, text(dto.providerRef));
    } else if (dto.action === 'COMPLETE') {
      const providerRef = text(dto.providerRef);
      if (!providerRef) throw new BadRequestException('Saisissez le numéro de reçu donné par le facturier.');
      await this.settlement.complete(id, { providerRef, token: text(dto.token), receiptNote: text(dto.receiptNote), processedById: adminId });
    } else {
      const reason = text(dto.reason);
      if (!reason || reason.length < 5) throw new BadRequestException('Indiquez le motif du refus (montré au client).');
      await this.settlement.fail(id, { reason, processedById: adminId });
    }
    await this.audit(adminId, clientId, 'BILL_PAYMENT_PROCESS', 'BillPayment', id, { action: dto.action, providerRef: text(dto.providerRef), reason: text(dto.reason) });

    const p = await this.prisma.billPayment.findFirstOrThrow({ where: { id, clientId }, include: BillsAdminService.INCLUDE });
    return this.row(p, new Date());
  }

  /** Export CSV (point-virgule, UTF-8 avec BOM : s'ouvre directement dans Excel). Jusqu'à 5000 lignes. */
  async exportCsv(actor: AuthUserPayload, q: AdminPaymentsQueryDto): Promise<string> {
    const { clientId } = await this.scope(actor);
    const now = new Date();
    const where = await this.whereFor(clientId, q, now);
    const rows = await this.prisma.billPayment.findMany({ where, include: BillsAdminService.INCLUDE, orderBy: { createdAt: 'desc' }, take: 5000 });
    const csv = toCsv(
      ['Référence', 'Date', 'Statut', 'En retard', 'Facturier', 'Catégorie', 'Référence client', 'Titulaire', 'Montant', 'Devise', 'Frais (portefeuille)', 'Total débité', 'Devise portefeuille', 'Client', 'Téléphone', 'Reçu du facturier', 'Jeton', 'Motif du refus', 'Réglée le', 'Remboursée le'],
      rows.map((p) => {
        const r = this.row(p, now);
        return [r.reference, p.createdAt.toISOString(), r.status, r.late ? 'oui' : '', r.biller.name, r.biller.category, r.accountRef, r.customerName, r.amount, r.currency, r.feeCharged, r.totalCharged, r.walletCurrency, r.payer.name, r.payer.phone, r.providerRef, r.token, r.failureReason, r.completedAt?.toISOString(), r.refundedAt?.toISOString()];
      }),
    );
    return `﻿${csv}`;
  }

  /** Rappel quotidien : factures payées par les clients et non réglées au-delà du délai annoncé. */
  async countLate(clientId: number): Promise<number> {
    const now = new Date();
    const where = await this.whereFor(clientId, { late: true } as AdminPaymentsQueryDto, now);
    return this.prisma.billPayment.count({ where });
  }
}
