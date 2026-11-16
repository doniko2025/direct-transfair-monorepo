// apps/backend/src/bills/bills.service.ts
// =========================================================
// PAIEMENT DE FACTURES — côté client (lot 14)
//
//   catalogue   les facturiers ACTIVE de LA société du client (chaque société négocie et tient les siens)
//   lookup      « interroger la facture » auprès du facturier (si un connecteur le permet) : titulaire (masqué), montant dû
//   quote       devis sans effet : frais, taux de la société si le portefeuille n'est pas dans la devise du facturier, total débité
//   pay         paiement depuis le portefeuille — UNE transaction SQL : paiement enregistré, opération, débit du client, crédit du
//               portefeuille de la société (qui règle ensuite le facturier). Tout réussit ou rien n'est écrit.
//   historique  mes factures, détail, reçu vérifiable ; « Mes factures » enregistrées (repaiement en deux touchers)
//
// Sécurité et argent
//   • Réservé aux clients (rôle USER), identité vérifiée (KYC), code secret à chaque paiement (5 erreurs → 30 min de blocage).
//   • Clé d'idempotence : rejouer la même confirmation (double appui, réseau coupé) renvoie le même paiement, sans second débit.
//   • Montants, frais, plafonds par facture et par jour : tous lus dans la configuration de la société et du facturier — rien en dur.
//   • Solde insuffisant : rien n'est débité, rien n'est enregistré.
//   • Le nom du titulaire renvoyé par un facturier est masqué (« Mamadou D. ») : on ne peut pas énumérer des abonnés en essayant des numéros.
// =========================================================

import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, type BillPayment, type Biller } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { CompanySettingsService } from '../company-settings/company-settings.service';
import { KycGuardService } from '../kyc/kyc-guard.service';
import { formatMoney } from '../merchants/merchant-notifier.service';
import { assertValidAmount, assertWithinBounds, roundForCurrency } from '../merchants/merchant-rules';
import { PinVerifierService } from '../merchants/pin-verifier.service';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../rates/rates.service';
import { SUPPORTED_CURRENCIES, WalletsService } from '../wallets/wallets.service';
import { BillConnectorsService, type BillConnector, type ConnectorBiller } from './bills.connectors';
import {
  assertReference, cleanFieldValues, computeBillFee, convertCharges, generateBillReference, isLate, publicBiller, readFieldDefs,
} from './bills.rules';
import { billReceiptCode, isValidBillSignature, parseBillReceiptCode } from './bills.receipt';
import { BillsNotifierService } from './bills-notifier.service';
import { categoryLabelFr, renderBillReceiptPdf } from './bills.pdf';
import { BillsSettlementService } from './bills-settlement.service';
import type { BillLookupDto, BillQuoteDto, MyBillsQueryDto, PayBillDto, SaveBillDto } from './dto/bills.dto';

const ACTOR_SELECT = {
  id: true, email: true, firstName: true, lastName: true, role: true, kycLevel: true, clientId: true,
  isActive: true, isSuspended: true, deletedAt: true, primaryCurrency: true,
} as const;
type Actor = Prisma.UserGetPayload<{ select: typeof ACTOR_SELECT }>;

type PaymentWithBiller = BillPayment & { biller: Biller };

/** « Mamadou Diallo » → « Mamadou D. » : assez pour reconnaître son proche, trop peu pour identifier un inconnu. */
export function maskCustomerName(name: string | null | undefined): string | null {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  return [parts[0], ...parts.slice(1).map((p) => `${p[0].toUpperCase()}.`)].join(' ');
}

/** « 0123456789 » → « ••••••6789 » : la référence complète n'est jamais renvoyée par la vérification publique d'un reçu. */
export const maskReference = (ref: string): string => (ref.length <= 4 ? '••••' : `${'•'.repeat(Math.min(6, ref.length - 4))}${ref.slice(-4)}`);

const toConnectorBiller = (b: Biller): ConnectorBiller => ({ id: b.id, name: b.name, category: b.category, currency: b.currency, amountMode: b.amountMode, connectorKey: b.connectorKey });

@Injectable()
export class BillsService {
  private readonly logger = new Logger(BillsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletsService,
    private readonly rates: RatesService,
    private readonly kyc: KycGuardService,
    private readonly pins: PinVerifierService,
    private readonly settings: CompanySettingsService,
    private readonly connectors: BillConnectorsService,
    private readonly settlement: BillsSettlementService,
    private readonly notifier: BillsNotifierService,
  ) {}

  // ── Utilitaires ────────────────────────────────────────

  private async actor(userId: string): Promise<Actor & { clientId: number }> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: ACTOR_SELECT });
    if (!u || !u.clientId || u.deletedAt || !u.isActive || u.isSuspended) throw new ForbiddenException('Compte indisponible.');
    if (u.role !== 'USER') throw new ForbiddenException('Seuls les clients peuvent payer des factures.');
    return u as Actor & { clientId: number };
  }

  private async assertEnabled(clientId: number) {
    const s = await this.settings.forClient(clientId);
    if (!s.bills.enabled) throw new ForbiddenException("Le paiement de factures n'est pas disponible pour le moment.");
    return s;
  }

  private async activeBiller(actor: { clientId: number }, id: string): Promise<Biller> {
    const b = await this.prisma.biller.findFirst({ where: { id, clientId: actor.clientId, status: 'ACTIVE' } });
    if (!b) throw new NotFoundException('Facturier introuvable ou indisponible.');
    return b;
  }

  private connectorOf(biller: Biller): BillConnector {
    const c = this.connectors.get(biller.connectorKey);
    if (!c) throw new ConflictException("Ce facturier n'est pas disponible pour le moment.");
    return c;
  }

  // ── Catalogue ──────────────────────────────────────────

  async options(user: AuthUserPayload) {
    const actor = await this.actor(user.id);
    const s = await this.settings.forClient(actor.clientId);
    if (!s.bills.enabled) return { enabled: false, categories: [] as Array<{ category: string; count: number }>, savedCount: 0 };
    const [groups, savedCount] = await Promise.all([
      this.prisma.biller.groupBy({ by: ['category'], where: { clientId: actor.clientId, status: 'ACTIVE' }, _count: { _all: true }, orderBy: { category: 'asc' } }),
      this.prisma.savedBill.count({ where: { userId: actor.id, biller: { status: 'ACTIVE' } } }),
    ]);
    return { enabled: true, categories: groups.map((g) => ({ category: g.category, count: g._count._all })), savedCount };
  }

  async listBillers(user: AuthUserPayload, q: { category?: string; q?: string }) {
    const actor = await this.actor(user.id);
    await this.assertEnabled(actor.clientId);
    const where: Prisma.BillerWhereInput = {
      clientId: actor.clientId,
      status: 'ACTIVE',
      ...(q.category ? { category: q.category.toUpperCase() } : {}),
      ...(q.q?.trim() ? { name: { contains: q.q.trim(), mode: 'insensitive' } } : {}),
    };
    const rows = await this.prisma.biller.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], take: 200 });
    return rows.map(publicBiller);
  }

  async getBiller(user: AuthUserPayload, id: string) {
    const actor = await this.actor(user.id);
    await this.assertEnabled(actor.clientId);
    return publicBiller(await this.activeBiller(actor, id));
  }

  // ── Recherche de la facture ────────────────────────────

  private async lookupInternal(biller: Biller, dto: BillLookupDto) {
    const reference = assertReference(biller, dto.reference);
    const fields = cleanFieldValues(readFieldDefs(biller.fields), dto.fields);
    const connector = this.connectorOf(biller);
    if (!connector.lookup) return { reference, fields, supported: false as const, found: null };
    let found;
    try {
      found = await connector.lookup(toConnectorBiller(biller), reference, fields);
    } catch (err) {
      this.logger.error(`Recherche de facture (${biller.name}) en échec : ${(err as Error).message}`);
      throw new ServiceUnavailableException('Le facturier ne répond pas pour le moment. Réessayez dans quelques minutes.');
    }
    if (!found) throw new NotFoundException('Référence introuvable chez ce facturier : vérifiez le numéro saisi.');
    return { reference, fields, supported: true as const, found };
  }

  async lookup(user: AuthUserPayload, billerId: string, dto: BillLookupDto) {
    const actor = await this.actor(user.id);
    await this.assertEnabled(actor.clientId);
    const biller = await this.activeBiller(actor, billerId);
    const res = await this.lookupInternal(biller, dto);
    return {
      supported: res.supported,
      customerName: maskCustomerName(res.found?.customerName),
      amountDue: res.found?.amountDue ?? null,
      dueDate: res.found?.dueDate ?? null,
      currency: biller.currency,
    };
  }

  // ── Devis ──────────────────────────────────────────────

  private async computeQuote(actor: Actor & { clientId: number }, biller: Biller, dto: BillQuoteDto) {
    const s = await this.assertEnabled(actor.clientId);
    const currency = biller.currency;
    const looked = await this.lookupInternal(biller, dto);

    let amount: number;
    if (biller.amountMode === 'FROM_LOOKUP') {
      const due = looked.found?.amountDue;
      if (!due || due <= 0) throw new ConflictException('Aucun montant à payer sur cette facture.');
      amount = assertValidAmount(due, currency);
    } else {
      amount = assertValidAmount(dto.amount, currency);
      assertWithinBounds(amount, currency, { min: biller.minAmount ? Number(biller.minAmount) : undefined, max: biller.maxAmount ? Number(biller.maxAmount) : undefined }, 'montant de la facture');
    }
    const cap = s.bills.maxPerPayment[currency];
    if (cap !== undefined && amount > cap) throw new BadRequestException(`Une facture ne peut pas dépasser ${formatMoney(cap, currency)}.`);

    const fee = computeBillFee(amount, Number(biller.feeFixed), Number(biller.feePct), currency);
    const walletCurrency = (dto.walletCurrency ?? actor.primaryCurrency ?? currency).toUpperCase();
    if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(walletCurrency)) throw new BadRequestException('Devise du portefeuille non prise en charge.');
    const rate = walletCurrency === currency ? 1 : await this.rates.getRateFor(currency, walletCurrency, actor.clientId);
    const charges = convertCharges({ amount, fee, rate, walletCurrency });

    return { biller, reference: looked.reference, fields: looked.fields, customerName: looked.found?.customerName ?? null, amount, fee, currency, walletCurrency, rate, ...charges };
  }

  /** Solde disponible du client dans une devise (0 s'il n'a pas encore de portefeuille). */
  private async available(userId: string, currency: string): Promise<number> {
    const w = await this.prisma.wallet.findFirst({ where: { userId, currency: currency as never }, select: { balance: true, reservedBalance: true } });
    return w ? Math.max(0, Number(w.balance.minus(w.reservedBalance))) : 0;
  }

  async quote(user: AuthUserPayload, billerId: string, dto: BillQuoteDto) {
    const actor = await this.actor(user.id);
    const biller = await this.activeBiller(actor, billerId);
    const q = await this.computeQuote(actor, biller, dto);
    const balance = await this.available(actor.id, q.walletCurrency);
    return {
      billerId: biller.id,
      amount: q.amount,
      fee: q.fee,
      currency: q.currency,
      walletCurrency: q.walletCurrency,
      rate: q.rate,
      amountCharged: q.amountCharged,
      feeCharged: q.feeCharged,
      totalCharged: q.totalCharged,
      customerName: maskCustomerName(q.customerName),
      balance,
      sufficient: balance >= q.totalCharged,
      delayHours: biller.settlementDelayHours,
      automatic: biller.connectorKey !== 'manual',
      simulated: biller.connectorKey === 'sandbox',
    };
  }

  // ── Paiement ───────────────────────────────────────────

  async pay(user: AuthUserPayload, billerId: string, dto: PayBillDto) {
    const actor = await this.actor(user.id);
    return this.execute(actor, billerId, dto, { pin: dto.pin });
  }

  /**
   * Échéance d'une facture récurrente en prélèvement automatique (lot 14b). Mêmes contrôles qu'un paiement manuel — module activé,
   * facturier actif, plafonds par facture et par jour, KYC, solde — SAUF le code secret : le client l'a donné une fois, à la création
   * de la programmation (consentement), et la société a ouvert le prélèvement automatique (contrôlé par l'appelant à chaque échéance).
   */
  async payForSchedule(userId: string, billerId: string, scheduleId: string, dto: Omit<PayBillDto, 'pin'>) {
    const actor = await this.actor(userId);
    return this.execute(actor, billerId, dto, { scheduleId });
  }

  private async execute(actor: Actor & { clientId: number }, billerId: string, dto: Omit<PayBillDto, 'pin'>, opts: { pin?: string; scheduleId?: string }) {
    // Garde-fou : sans code secret, seul un prélèvement programmé (consentement donné à la création) peut débiter.
    if (opts.pin === undefined && !opts.scheduleId) throw new ForbiddenException('Code secret requis.');

    // Rejeu de la même confirmation : même paiement, aucun second débit.
    const replay = await this.prisma.billPayment.findUnique({
      where: { payerId_idempotencyKey: { payerId: actor.id, idempotencyKey: dto.idempotencyKey } },
      include: { biller: true },
    });
    if (replay) return this.view(replay);

    const s = await this.assertEnabled(actor.clientId);
    const biller = await this.activeBiller(actor, billerId);
    const connector = this.connectorOf(biller);
    const q = await this.computeQuote(actor, biller, dto);

    // Plafond journalier (24 h glissantes), par devise du facturier, remboursements exclus.
    const dayCap = s.bills.maxPerDay[q.currency];
    if (dayCap !== undefined) {
      const since = new Date(Date.now() - 24 * 3_600_000);
      const agg = await this.prisma.billPayment.aggregate({
        _sum: { amount: true },
        where: { payerId: actor.id, currency: q.currency as never, status: { not: 'REFUNDED' }, createdAt: { gte: since } },
      });
      const already = Number(agg._sum.amount ?? 0);
      if (already + q.amount > dayCap) {
        throw new BadRequestException(`Plafond de ${formatMoney(dayCap, q.currency)} par jour atteint (déjà ${formatMoney(already, q.currency)} aujourd'hui).`);
      }
    }

    await this.kyc.assertVerified({ id: actor.id, role: actor.role, kycLevel: String(actor.kycLevel) });
    if (opts.pin !== undefined) await this.pins.assertPin(actor.id, opts.pin);

    const [payerWallet, companyWallet] = await Promise.all([
      this.wallets.getOrCreateWallet({ userId: actor.id, currency: q.walletCurrency }),
      this.wallets.getOrCreateWallet({ clientId: actor.clientId, currency: q.walletCurrency }),
    ]);

    const reference = generateBillReference();
    let created: PaymentWithBiller;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const payment = await tx.billPayment.create({
          data: {
            reference,
            clientId: actor.clientId,
            billerId: biller.id,
            payerId: actor.id,
            accountRef: q.reference,
            fields: Object.keys(q.fields).length ? (q.fields as Prisma.InputJsonValue) : Prisma.JsonNull,
            customerName: maskCustomerName(q.customerName),
            amount: q.amount,
            fee: q.fee,
            currency: q.currency as never,
            walletCurrency: q.walletCurrency as never,
            rate: q.rate,
            amountCharged: q.amountCharged,
            feeCharged: q.feeCharged,
            totalCharged: q.totalCharged,
            connectorKey: biller.connectorKey,
            idempotencyKey: dto.idempotencyKey,
            scheduleId: opts.scheduleId ?? null,
          },
          include: { biller: true },
        });
        const txn = await tx.transaction.create({
          data: {
            reference,
            type: 'BILL_PAYMENT',
            direction: 'INTERNAL',
            amount: q.amountCharged,
            fees: q.feeCharged,
            total: q.totalCharged,
            currency: q.walletCurrency as never,
            receivedAmount: q.amountCharged,
            platformCommission: q.feeCharged,
            status: 'PAID',
            payoutMethod: 'WALLET',
            paymentMethod: 'WALLET',
            senderId: actor.id,
            clientId: actor.clientId,
            note: `Facture ${biller.name} ${q.reference}`,
            paidAt: new Date(),
          },
        });
        await this.wallets.debitInTx(tx, payerWallet.id, q.totalCharged, `Facture ${biller.name} ${reference}`, txn.id);
        await this.wallets.creditInTx(tx, companyWallet.id, q.totalCharged, `Facture client ${reference}`, txn.id, { allowFrozen: true });
        await tx.billPayment.update({ where: { id: payment.id }, data: { transactionId: txn.id } });
        return { ...payment, transactionId: txn.id };
      });
    } catch (err) {
      // Deux confirmations simultanées avec la même clé : la seconde retrouve la première.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const again = await this.prisma.billPayment.findUnique({
          where: { payerId_idempotencyKey: { payerId: actor.id, idempotencyKey: dto.idempotencyKey } },
          include: { biller: true },
        });
        if (again) return this.view(again);
      }
      throw err;
    }

    await this.audit(actor.id, actor.clientId, created.id, { step: 'PAID', biller: biller.name, amount: q.amount, currency: q.currency, totalCharged: q.totalCharged, walletCurrency: q.walletCurrency, ...(opts.scheduleId ? { scheduleId: opts.scheduleId, automatic: opts.pin === undefined } : {}) });

    if (dto.saveAs?.trim()) await this.saveInternal(actor.id, biller, dto.saveAs.trim(), q.reference, q.fields, maskCustomerName(q.customerName));

    await this.notifier.notifyUser(actor, {
      kind: 'BILL_SUBMITTED',
      title: `Facture payée : ${formatMoney(q.amount, q.currency)}`,
      body: connector.automatic
        ? `Votre facture ${biller.name} est en cours de règlement. Réf. ${reference}.`
        : `Votre paiement ${biller.name} est bien reçu. Il sera réglé sous ${biller.settlementDelayHours} h au plus tard ; vous recevrez le reçu ici. Réf. ${reference}.`,
      actionUrl: `/bills/payment?id=${created.id}`,
      actionLabel: 'Mes factures',
      type: 'SUCCESS',
      email: false,
    });

    if (connector.automatic && connector.pay) await this.runConnector(connector, created, biller);
    else {
      await this.notifier.notifyCompanyAdmins(actor.clientId, {
        kind: 'BILL_TO_SETTLE',
        title: `Facture à régler : ${biller.name}`,
        body: `${formatMoney(q.amount, q.currency)} · réf. ${q.reference} · ${reference}.`,
        actionUrl: '/bills/payments',
        actionLabel: 'Factures à régler',
        type: 'INFO',
      });
    }

    const done = await this.prisma.billPayment.findUnique({ where: { id: created.id }, include: { biller: true } });
    return this.view(done ?? created);
  }

  /** Règlement automatique par le connecteur. Un incident technique ne perd jamais l'argent : la facture reste « à régler » pour la société. */
  private async runConnector(connector: BillConnector, payment: PaymentWithBiller, biller: Biller): Promise<void> {
    try {
      const res = await connector.pay!({
        biller: toConnectorBiller(biller),
        reference: payment.reference,
        accountRef: payment.accountRef,
        fields: (payment.fields ?? {}) as Record<string, string>,
        amount: Number(payment.amount),
        currency: payment.currency,
      });
      if (res.status === 'COMPLETED') await this.settlement.complete(payment.id, { providerRef: res.providerRef, token: res.token, receiptNote: res.message });
      else if (res.status === 'PENDING') await this.settlement.markProcessing(payment.id, null, res.providerRef);
      else await this.settlement.fail(payment.id, { reason: res.message ?? 'Paiement refusé par le facturier.' });
    } catch (err) {
      this.logger.error(`Connecteur ${connector.key} en échec pour ${payment.reference} : ${(err as Error).message}`);
      await this.notifier.notifyCompanyAdmins(payment.clientId, {
        kind: 'BILL_TO_SETTLE',
        title: `Facture à régler à la main : ${biller.name}`,
        body: `Le règlement automatique a échoué (${payment.reference}). Le client est débité : réglez ou refusez cette facture.`,
        actionUrl: '/bills/payments',
        actionLabel: 'Factures à régler',
        type: 'WARNING',
      });
    }
  }

  private async audit(userId: string, clientId: number, entityId: string, details: Record<string, unknown>) {
    try {
      await this.prisma.auditLog.create({ data: { userId, clientId, action: 'BILL_PAYMENT', entity: 'BillPayment', entityId, details: details as Prisma.InputJsonValue, successful: true } });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (facture ${entityId}) : ${(err as Error).message}`);
    }
  }

  // ── Historique et reçu ─────────────────────────────────

  /** Vue renvoyée à l'application (le client ne voit ni coordonnées de règlement ni note interne). */
  view(p: PaymentWithBiller) {
    const pending = p.status === 'SUBMITTED' || p.status === 'PROCESSING';
    return {
      id: p.id,
      reference: p.reference,
      status: p.status,
      biller: { id: p.biller.id, name: p.biller.name, category: p.biller.category, currency: p.biller.currency },
      accountRef: p.accountRef,
      referenceLabel: p.biller.referenceLabel,
      customerName: p.customerName,
      fields: this.fieldRows(p),
      amount: Number(p.amount),
      fee: Number(p.fee),
      currency: p.currency,
      walletCurrency: p.walletCurrency,
      rate: Number(p.rate),
      amountCharged: Number(p.amountCharged),
      feeCharged: Number(p.feeCharged),
      totalCharged: Number(p.totalCharged),
      providerRef: p.providerRef,
      token: p.token,
      receiptNote: p.receiptNote,
      failureReason: p.failureReason,
      createdAt: p.createdAt,
      completedAt: p.completedAt,
      refundedAt: p.refundedAt,
      expectedBy: pending ? new Date(p.createdAt.getTime() + p.biller.settlementDelayHours * 3_600_000) : null,
      simulated: p.connectorKey === 'sandbox',
      receiptCode: p.status === 'COMPLETED' && p.completedAt ? billReceiptCode({ id: p.id, reference: p.reference, amount: p.amount, currency: p.currency, completedAt: p.completedAt }) : null,
    };
  }

  private fieldRows(p: PaymentWithBiller): Array<{ label: string; value: string }> {
    const values = (p.fields ?? {}) as Record<string, string>;
    return readFieldDefs(p.biller.fields).filter((d) => values[d.key]).map((d) => ({ label: d.label, value: values[d.key] }));
  }

  async listMine(user: AuthUserPayload, q: MyBillsQueryDto) {
    const actor = await this.actor(user.id);
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const where: Prisma.BillPaymentWhereInput = { payerId: actor.id, ...(q.status ? { status: q.status as never } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.billPayment.findMany({ where, include: { biller: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.billPayment.count({ where }),
    ]);
    return { data: rows.map((r) => this.view(r)), total, page, limit };
  }

  async getOne(user: AuthUserPayload, id: string) {
    const actor = await this.actor(user.id);
    const p = await this.prisma.billPayment.findFirst({ where: { id, payerId: actor.id }, include: { biller: true } });
    if (!p) throw new NotFoundException('Paiement de facture introuvable.');
    return this.view(p);
  }

  /**
   * Reçu PDF (lot 14b) — réservé au payeur, uniquement une fois la facture RÉGLÉE (un reçu ne se délivre pas avant le règlement).
   * Aux couleurs de la société du client ; ne contient que ce que le client voit déjà dans l'application.
   */
  async receiptPdf(user: AuthUserPayload, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const actor = await this.actor(user.id);
    const p = await this.prisma.billPayment.findFirst({ where: { id, payerId: actor.id }, include: { biller: true } });
    if (!p) throw new NotFoundException('Paiement de facture introuvable.');
    if (p.status !== 'COMPLETED' || !p.completedAt) throw new ConflictException("Le reçu est disponible une fois la facture réglée au facturier.");
    const company = await this.prisma.client.findUnique({
      where: { id: p.clientId },
      select: { name: true, address: true, city: true, phone: true, email: true, contactPhone: true, contactEmail: true, primaryColor: true },
    });
    const v = this.view(p);
    const base = String(process.env.PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
    const buffer = await renderBillReceiptPdf({
      company: {
        name: company?.name ?? 'Reçu de facture',
        address: company?.address, city: company?.city,
        phone: company?.contactPhone ?? company?.phone, email: company?.contactEmail ?? company?.email,
        color: company?.primaryColor,
      },
      receiptNumber: p.reference,
      billerName: p.biller.name,
      billerCategoryLabel: categoryLabelFr(p.biller.category),
      referenceLabel: p.biller.referenceLabel,
      accountRef: p.accountRef,
      customerName: p.customerName,
      extraFields: v.fields,
      amount: v.amount, fee: v.fee, currency: v.currency, walletCurrency: v.walletCurrency,
      amountCharged: v.amountCharged, feeCharged: v.feeCharged, totalCharged: v.totalCharged,
      providerRef: p.providerRef, token: p.token, receiptNote: p.receiptNote,
      paidAt: p.createdAt, completedAt: p.completedAt,
      payerName: `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim() || actor.email,
      verifyCode: v.receiptCode ?? p.reference,
      verifyUrl: base && v.receiptCode ? `${base}/api/bills/verify/${v.receiptCode}` : null,
      simulated: p.connectorKey === 'sandbox',
    });
    return { buffer, filename: `recu-${p.reference}.pdf` };
  }

  /** Vérification PUBLIQUE d'un reçu (code imprimé sur le reçu) : renvoie les vraies données, avec la référence masquée. */
  async verifyReceipt(raw: string) {
    const parsed = parseBillReceiptCode(raw);
    if (!parsed) return { valid: false as const };
    const p = await this.prisma.billPayment.findUnique({ where: { reference: parsed.reference }, include: { biller: { select: { name: true } } } });
    if (!p || p.status !== 'COMPLETED' || !p.completedAt) return { valid: false as const };
    if (!isValidBillSignature({ id: p.id, reference: p.reference, amount: p.amount, currency: p.currency, completedAt: p.completedAt }, parsed.signature)) return { valid: false as const };
    return {
      valid: true as const,
      biller: p.biller.name,
      amount: Number(p.amount),
      currency: p.currency,
      accountRef: maskReference(p.accountRef),
      providerRef: p.providerRef,
      completedAt: p.completedAt,
    };
  }

  // ── Mes factures enregistrées ──────────────────────────

  private async saveInternal(userId: string, biller: Biller, label: string, accountRef: string, fields: Record<string, string>, customerName: string | null) {
    try {
      const count = await this.prisma.savedBill.count({ where: { userId } });
      const exists = await this.prisma.savedBill.findUnique({ where: { userId_billerId_accountRef: { userId, billerId: biller.id, accountRef } }, select: { id: true } });
      if (!exists && count >= 30) return; // plafond silencieux : l'enregistrement est un confort, jamais un blocage de paiement
      await this.prisma.savedBill.upsert({
        where: { userId_billerId_accountRef: { userId, billerId: biller.id, accountRef } },
        create: { userId, billerId: biller.id, label: label.slice(0, 60), accountRef, fields: Object.keys(fields).length ? (fields as Prisma.InputJsonValue) : Prisma.JsonNull, customerName },
        update: { label: label.slice(0, 60), fields: Object.keys(fields).length ? (fields as Prisma.InputJsonValue) : Prisma.JsonNull, customerName },
      });
    } catch (err) {
      this.logger.warn(`Facture non enregistrée : ${(err as Error).message}`);
    }
  }

  async listSaved(user: AuthUserPayload) {
    const actor = await this.actor(user.id);
    const rows = await this.prisma.savedBill.findMany({ where: { userId: actor.id, biller: { clientId: actor.clientId } }, include: { biller: true }, orderBy: { createdAt: 'desc' }, take: 50 });
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      accountRef: r.accountRef,
      customerName: r.customerName,
      fields: r.fields ?? {},
      available: r.biller.status === 'ACTIVE',
      biller: publicBiller(r.biller),
    }));
  }

  async save(user: AuthUserPayload, dto: SaveBillDto) {
    const actor = await this.actor(user.id);
    await this.assertEnabled(actor.clientId);
    const biller = await this.activeBiller(actor, dto.billerId);
    const reference = assertReference(biller, dto.reference);
    const fields = cleanFieldValues(readFieldDefs(biller.fields), dto.fields);
    const count = await this.prisma.savedBill.count({ where: { userId: actor.id } });
    if (count >= 30) throw new BadRequestException('30 factures enregistrées au maximum : supprimez-en une.');
    await this.saveInternal(actor.id, biller, dto.label.trim(), reference, fields, dto.customerName ? maskCustomerName(dto.customerName) : null);
    return { saved: true };
  }

  async removeSaved(user: AuthUserPayload, id: string) {
    const actor = await this.actor(user.id);
    const res = await this.prisma.savedBill.deleteMany({ where: { id, userId: actor.id } });
    if (res.count !== 1) throw new NotFoundException('Facture enregistrée introuvable.');
    return { removed: true };
  }

  // Exposés pour les tests et l'administration.
  readonly _isLate = isLate;
  readonly _round = roundForCurrency;
}
