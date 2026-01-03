//apps/backend/src/payments/sendwave.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaymentMethod,
  PaymentProvider,
  ProviderStatus,
  Transaction,
  TransactionStatus,
} from '@prisma/client';

@Injectable()
export class SendwaveService {
  constructor(private readonly prisma: PrismaService) {}

  async initiate(tx: Transaction) {
    const providerRef = 'SW_' + Math.floor(100000 + Math.random() * 900000);

    const upd = await this.prisma.transaction.updateMany({
      where: {
        id: tx.id,
        clientId: tx.clientId,
        status: TransactionStatus.VALIDATED, // ✅ ne jamais repasser à PENDING
      },
      data: {
        paymentMethod: PaymentMethod.SENDWAVE,
        provider: PaymentProvider.SENDWAVE,
        providerRef,
        providerStatus: ProviderStatus.PENDING,
      },
    });

    if (upd.count !== 1) throw new NotFoundException('Transaction introuvable ou non VALIDATED');

    return {
      status: 'WAITING_USER_PAYMENT',
      message: "Payez via Sendwave puis communiquez le code à l'admin.",
      providerRef,
    };
  }
}
