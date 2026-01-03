//apps/backend/src/payments/orange-money.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaymentMethod,
  PaymentProvider,
  ProviderStatus,
  Transaction,
  TransactionStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';

type InitiateOpts = { simulateSuccess?: boolean };

@Injectable()
export class OrangeMoneyService {
  constructor(private readonly prisma: PrismaService) {}

  async initiate(tx: Transaction, opts: InitiateOpts = {}) {
    const providerRef = 'OM_' + randomUUID().slice(0, 8).toUpperCase();

    const upd = await this.prisma.transaction.updateMany({
      where: {
        id: tx.id,
        clientId: tx.clientId,
        status: TransactionStatus.VALIDATED, // ✅ ne jamais repasser à PENDING
      },
      data: {
        paymentMethod: PaymentMethod.ORANGE_MONEY,
        provider: PaymentProvider.ORANGE_MONEY,
        providerRef,
        providerStatus: ProviderStatus.PENDING,
      },
    });

    if (upd.count !== 1) throw new NotFoundException('Transaction introuvable ou non VALIDATED');

    const simulateSuccess = opts.simulateSuccess !== false;

    // Mock async : succès/échec
    setTimeout(() => {
      const now = new Date();

      void this.prisma.transaction
        .updateMany({
          where: {
            id: tx.id,
            clientId: tx.clientId,
            status: TransactionStatus.VALIDATED,
            providerRef,
            providerStatus: ProviderStatus.PENDING,
          },
          data: simulateSuccess
            ? {
                status: TransactionStatus.PAID,
                paidAt: now,
                cancelledAt: null,
                providerStatus: ProviderStatus.SUCCESS,
              }
            : {
                // on reste VALIDATED (payable) mais on marque l’échec provider
                paidAt: null,
                providerStatus: ProviderStatus.FAILED,
              },
        })
        .catch(() => {});
    }, 2000);

    return { provider: 'ORANGE_MONEY', providerRef, providerStatus: 'PENDING' };
  }
}
