// apps/backend/src/bills/bills-settlement.service.ts
// =========================================================
// RÈGLEMENT D'UNE FACTURE (lot 14) — les trois issues d'un paiement « à régler », utilisées par l'administrateur (portail) ET par les
// connecteurs automatiques :
//   PROCESSING  prise en charge : « je m'en occupe » (évite que deux administrateurs règlent la même facture)
//   COMPLETED   le facturier est réglé : reçu (numéro d'opération, jeton) enregistré, le client est prévenu
//   REFUNDED    refus / échec : le client est recrédité (UNE transaction SQL : portefeuille de la société débité, client crédité)
//
// Sécurité : chaque passage d'état est pris par un UPDATE conditionnel (statut attendu) — deux appels simultanés ne règlent ni ne
// remboursent jamais deux fois. Un remboursement qui échoue (solde de la société insuffisant) annule tout : la facture reste « à régler ».
// =========================================================

import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { BillPayment, Biller } from '@prisma/client';

import { CompanySettingsService } from '../company-settings/company-settings.service';
import { formatMoney } from '../merchants/merchant-notifier.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { BillsNotifierService } from './bills-notifier.service';

export type PaymentWithBiller = BillPayment & { biller: Biller };

export interface CompleteInput {
  providerRef?: string | null;
  token?: string | null;
  receiptNote?: string | null;
  processedById?: string | null;
}

@Injectable()
export class BillsSettlementService {
  private readonly logger = new Logger(BillsSettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletsService,
    private readonly settings: CompanySettingsService,
    private readonly notifier: BillsNotifierService,
  ) {}

  private async load(id: string): Promise<PaymentWithBiller> {
    const p = await this.prisma.billPayment.findUnique({ where: { id }, include: { biller: true } });
    if (!p) throw new NotFoundException('Paiement de facture introuvable.');
    return p;
  }

  private async payerOf(payerId: string) {
    return this.prisma.user.findUnique({ where: { id: payerId }, select: { id: true, email: true, firstName: true } });
  }

  async markProcessing(id: string, processedById: string | null, providerRef?: string | null): Promise<void> {
    const res = await this.prisma.billPayment.updateMany({
      where: { id, status: 'SUBMITTED' },
      data: { status: 'PROCESSING', processedById, processedAt: new Date(), ...(providerRef ? { providerRef } : {}) },
    });
    if (res.count !== 1) throw new ConflictException('Cette facture est déjà prise en charge ou traitée.');
  }

  async complete(id: string, input: CompleteInput): Promise<PaymentWithBiller> {
    const now = new Date();
    const res = await this.prisma.billPayment.updateMany({
      where: { id, status: { in: ['SUBMITTED', 'PROCESSING'] } },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        processedAt: now,
        processedById: input.processedById ?? null,
        providerRef: input.providerRef ?? undefined,
        token: input.token ?? undefined,
        receiptNote: input.receiptNote ?? undefined,
        failureReason: null,
      },
    });
    if (res.count !== 1) throw new ConflictException('Cette facture est déjà traitée.');
    const p = await this.load(id);

    const payer = await this.payerOf(p.payerId);
    if (payer) {
      const money = formatMoney(p.amount, p.currency);
      await this.notifier.notifyUser(payer, {
        kind: 'BILL_COMPLETED',
        title: `Facture réglée : ${p.biller.name}`,
        body: `Votre facture de ${money} (${p.biller.name}, ${p.accountRef}) a été réglée.${p.token ? ` Jeton : ${p.token}.` : ''} Réf. ${p.reference}.`,
        actionUrl: `/bills/payment?id=${p.id}`,
        actionLabel: 'Mes factures',
        type: 'SUCCESS',
        email: true,
      });
    }
    return p;
  }

  /** Refuse la facture et rend l'argent au client. `refundFee` : rendre aussi les frais (réglage de la société par défaut). */
  async fail(id: string, opts: { reason: string; processedById?: string | null; refundFee?: boolean }): Promise<PaymentWithBiller> {
    const before = await this.load(id);
    const refundFee = opts.refundFee ?? (await this.settings.forClient(before.clientId)).bills.refundFeeOnFailure;
    const refundAmount = refundFee ? Number(before.totalCharged) : Number(before.amountCharged);
    const currency = before.walletCurrency;

    const [payerWallet, companyWallet] = await Promise.all([
      this.wallets.getOrCreateWallet({ userId: before.payerId, currency }),
      this.wallets.getOrCreateWallet({ clientId: before.clientId, currency }),
    ]);

    try {
      await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const claim = await tx.billPayment.updateMany({
          where: { id, status: { in: ['SUBMITTED', 'PROCESSING'] } },
          data: { status: 'REFUNDED', failureReason: opts.reason, refundedAt: now, processedAt: now, processedById: opts.processedById ?? null },
        });
        if (claim.count !== 1) throw new ConflictException('Cette facture est déjà traitée.');

        const refundTx = await tx.transaction.create({
          data: {
            reference: `${before.reference}-R`,
            type: 'BILL_REFUND',
            direction: 'INTERNAL',
            amount: refundAmount,
            fees: 0,
            total: refundAmount,
            currency,
            receivedAmount: refundAmount,
            platformCommission: 0,
            status: 'PAID',
            payoutMethod: 'WALLET',
            paymentMethod: 'WALLET',
            senderId: before.payerId,
            recipientId: before.payerId,
            clientId: before.clientId,
            note: `Remboursement facture ${before.biller.name} ${before.reference}`,
            paidAt: now,
          },
        });
        await this.wallets.debitInTx(tx, companyWallet.id, refundAmount, `Remboursement facture ${before.reference}`, refundTx.id);
        await this.wallets.creditInTx(tx, payerWallet.id, refundAmount, `Facture non réglée ${before.reference}`, refundTx.id);
        await tx.billPayment.update({ where: { id }, data: { refundTransactionId: refundTx.id } });
      });
    } catch (err) {
      if (/solde insuffisant/i.test((err as Error).message)) {
        throw new BadRequestException('Le portefeuille de la société est insuffisant pour rembourser le client : approvisionnez-le puis réessayez.');
      }
      throw err;
    }

    const p = await this.load(id);
    const payer = await this.payerOf(p.payerId);
    if (payer) {
      await this.notifier.notifyUser(payer, {
        kind: 'BILL_REFUNDED',
        title: `Facture non réglée : ${p.biller.name}`,
        body: `Votre facture de ${formatMoney(p.amount, p.currency)} (${p.biller.name}) n'a pas pu être réglée${opts.reason ? ` : ${opts.reason}` : ''}. ${formatMoney(refundAmount, currency)} ont été remis sur votre portefeuille. Réf. ${p.reference}.`,
        actionUrl: `/bills/payment?id=${p.id}`,
        actionLabel: 'Mes factures',
        type: 'WARNING',
        email: true,
      });
    }
    this.logger.log(`Facture ${p.reference} remboursée (${refundAmount} ${currency}) : ${opts.reason}`);
    return p;
  }
}
