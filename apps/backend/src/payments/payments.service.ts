// apps/backend/src/payments/payments.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { OrangeMoneyService } from './orange-money.service';
import { SendwaveService } from './sendwave.service';
import {
  PaymentMethod,
  PaymentProvider,
  ProviderStatus,
  TransactionStatus,
} from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly om: OrangeMoneyService,
    private readonly sendwave: SendwaveService,
  ) {}

  async initiate(clientId: number, userId: string, dto: InitiatePaymentDto) {
    const transactionId = String(dto.transactionId ?? '').trim();
    if (!transactionId) throw new BadRequestException('transactionId manquant');

    const txLite = await this.prisma.transaction.findFirst({
      where: { id: transactionId, clientId },
      select: {
        id: true,
        senderId: true,
        status: true,
        paymentMethod: true,
        provider: true,
        providerRef: true,
        providerStatus: true,
        paidAt: true,
        cancelledAt: true,
      },
    });

    if (!txLite) throw new NotFoundException('Transaction not found');
    if (txLite.senderId !== userId) {
      throw new ForbiddenException('Transaction does not belong to this user');
    }

    // Terminal
    if (txLite.status === TransactionStatus.CANCELLED) {
      throw new BadRequestException('Paiement interdit: transaction CANCELLED');
    }
    if (txLite.status === TransactionStatus.PAID) {
      return this.status(clientId, userId, txLite.id);
    }

    // ✅ Verrou B1: paiement uniquement si VALIDATED
    if (txLite.status !== TransactionStatus.VALIDATED) {
      throw new BadRequestException(
        `Paiement interdit: transaction status=${txLite.status} (attendu: VALIDATED)`,
      );
    }

    // Compat (nouveau OU ancien)
    const method = dto.paymentMethod ?? dto.method;
    if (!method) throw new BadRequestException('paymentMethod/method manquant');

    // Idempotence: si déjà en attente sur le même provider avec providerRef, on renvoie l’état
    if (
      txLite.providerStatus === ProviderStatus.PENDING &&
      txLite.providerRef &&
      ((method === PaymentMethod.ORANGE_MONEY && txLite.provider === PaymentProvider.ORANGE_MONEY) ||
        (method === PaymentMethod.SENDWAVE && txLite.provider === PaymentProvider.SENDWAVE))
    ) {
      return this.status(clientId, userId, txLite.id);
    }

    switch (method) {
      case PaymentMethod.WALLET:
        return this.handleWallet(clientId, txLite.id);

      case PaymentMethod.ORANGE_MONEY: {
        await this.markProviderPending(
          clientId,
          txLite.id,
          PaymentMethod.ORANGE_MONEY,
          PaymentProvider.ORANGE_MONEY,
        );

        const tx = await this.prisma.transaction.findFirstOrThrow({
          where: { id: txLite.id, clientId },
        });

        return this.om.initiate(tx, { simulateSuccess: dto.simulateSuccess });
      }

      case PaymentMethod.SENDWAVE: {
        await this.markProviderPending(
          clientId,
          txLite.id,
          PaymentMethod.SENDWAVE,
          PaymentProvider.SENDWAVE,
        );

        const tx = await this.prisma.transaction.findFirstOrThrow({
          where: { id: txLite.id, clientId },
        });

        return this.sendwave.initiate(tx);
      }

      case PaymentMethod.CARD:
      default:
        throw new BadRequestException('Unsupported payment method');
    }
  }

  async status(clientId: number, userId: string, transactionId: string) {
    const id = String(transactionId ?? '').trim();
    if (!id) throw new BadRequestException('transactionId invalide');

    const tx = await this.prisma.transaction.findFirst({
      where: { id, clientId },
      select: {
        id: true,
        reference: true,
        status: true,
        paymentMethod: true,
        provider: true,
        providerRef: true,
        providerStatus: true,
        paidAt: true,
        cancelledAt: true,
        senderId: true,
        total: true,
        currency: true,
      },
    });

    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.senderId !== userId) {
      throw new ForbiddenException('Transaction does not belong to this user');
    }

    return tx;
  }

  /**
   * Wallet (dev-friendly) :
   * - Ne paie que si status=VALIDATED
   */
  private async handleWallet(clientId: number, id: string) {
    return this.prisma.$transaction(async (p) => {
      const upd = await p.transaction.updateMany({
        where: { id, clientId, status: TransactionStatus.VALIDATED },
        data: {
          status: TransactionStatus.PAID,
          paidAt: new Date(),
          cancelledAt: null,
          paymentMethod: PaymentMethod.WALLET,
          provider: PaymentProvider.DIRECT,
          providerRef: null,
          providerStatus: ProviderStatus.SUCCESS,
        },
      });

      if (upd.count !== 1) {
        throw new BadRequestException('Paiement wallet interdit (transaction non VALIDATED ou introuvable)');
      }

      return p.transaction.findFirstOrThrow({
        where: { id, clientId },
        select: {
          id: true,
          status: true,
          paymentMethod: true,
          provider: true,
          providerRef: true,
          providerStatus: true,
          paidAt: true,
        },
      });
    });
  }

  /**
   * Prépare provider/method avant appel externe
   * - borné à (id, clientId, status=VALIDATED)
   * - reset providerRef pour éviter ambiguïté en cas de retry
   */
  private async markProviderPending(
    clientId: number,
    id: string,
    method: PaymentMethod,
    provider: PaymentProvider,
  ): Promise<void> {
    const upd = await this.prisma.transaction.updateMany({
      where: { id, clientId, status: TransactionStatus.VALIDATED },
      data: {
        paymentMethod: method,
        provider,
        providerStatus: ProviderStatus.PENDING,
        providerRef: null,
      },
    });

    if (upd.count !== 1) {
      throw new BadRequestException('Paiement interdit (transaction non VALIDATED ou introuvable)');
    }
  }
}
