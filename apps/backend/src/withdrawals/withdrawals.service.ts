// apps/backend/src/withdrawals/withdrawals.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TransactionStatus,
  WithdrawalStatus,
  PayoutMethod,
  PaymentMethod,
  ProviderStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { UpdateWithdrawalStatusDto } from './dto/update-withdrawal-status.dto';

@Injectable()
export class WithdrawalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(clientId: number, userId: string, dto: CreateWithdrawalDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.amount) {
      const amount = new Prisma.Decimal(dto.amount);
      const fees = amount.mul(new Prisma.Decimal(0.01));
      const total = amount.plus(fees);

      if (user.balance.lessThan(total)) throw new BadRequestException('Solde insuffisant');

      const withdrawalCode = `DT-${Math.floor(100000 + Math.random() * 900000)}`;

      return this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { balance: { decrement: total } },
        });

        const txData: Prisma.TransactionUncheckedCreateInput = {
          reference: `WD-${Date.now()}`,
          amount,
          fees,
          total,
          currency: 'XOF',
          status: TransactionStatus.PENDING,
          payoutMethod: PayoutMethod.CASH_PICKUP,
          paymentMethod: PaymentMethod.WALLET,
          senderId: userId,
          clientId,
          providerRef: withdrawalCode,
          providerStatus: ProviderStatus.PENDING,
        };

        const transaction = await tx.transaction.create({ data: txData });

        return tx.withdrawal.create({
          data: {
            clientId,
            transactionId: transaction.id,
            method: PayoutMethod.CASH_PICKUP,
            status: WithdrawalStatus.PENDING,
          },
        });
      });
    }

    const transactionId = String(dto.transactionId ?? '').trim();
    if (!transactionId) throw new BadRequestException('Montant ou TransactionId requis');

    const tx = await this.prisma.transaction.findFirst({
      where: { id: transactionId, clientId },
    });
    if (!tx) throw new NotFoundException('Transaction introuvable');

    return this.prisma.withdrawal.create({
      data: {
        clientId,
        transactionId: tx.id,
        method: dto.method ?? tx.payoutMethod,
        status: WithdrawalStatus.PENDING,
      },
    });
  }

  async agentCheckCode(clientId: number, code: string) {
    const cleanCode = String(code ?? '').trim();
    if (!cleanCode) throw new BadRequestException('Code requis');

    const tx = await this.prisma.transaction.findFirst({
      where: {
        clientId,
        OR: [{ reference: cleanCode }, { providerRef: cleanCode }],
      },
      include: { sender: true },
    });

    if (!tx) throw new NotFoundException('Code invalide ou introuvable.');

    return {
      valid: true,
      amount: tx.amount,
      currency: tx.currency,
      senderName: tx.sender ? `${tx.sender.firstName ?? ''} ${tx.sender.lastName ?? ''}`.trim() : 'Client Inconnu',
      transactionId: tx.id,
      status: tx.status,
    };
  }

  async agentProcessPayment(clientId: number, agentId: string, code: string) {
    const cleanCode = String(code ?? '').trim();
    if (!cleanCode) throw new BadRequestException('Code requis');

    const tx = await this.prisma.transaction.findFirst({
      where: {
        clientId,
        OR: [{ reference: cleanCode }, { providerRef: cleanCode }],
      },
      include: { withdrawal: true },
    });

    if (!tx) throw new NotFoundException('Code introuvable');

    if (tx.status === TransactionStatus.PENDING) {
      throw new ForbiddenException('Transaction en attente de validation Admin. Paiement impossible.');
    }
    if (tx.status === TransactionStatus.PAID) {
      throw new ConflictException('Code déjà payé.');
    }
    if (tx.status === TransactionStatus.CANCELLED) {
      throw new ConflictException('Transaction annulée.');
    }
    if (tx.status !== TransactionStatus.VALIDATED) {
      throw new ForbiddenException(`Statut invalide pour paiement: ${tx.status}`);
    }

    const agent = await this.prisma.user.findUnique({
      where: { id: agentId },
      include: { agency: true },
    });
    if (!agent || !agent.agencyId) throw new ForbiddenException('Agent sans agence');

    return this.prisma.$transaction(async (prismaTx) => {
      // ✅ Mise à jour des soldes : Virtuel augmente, Physique baisse
      await prismaTx.agency.update({
        where: { id: agent.agencyId! },
        data: { 
            balance: { increment: tx.total }, 
            cash: { decrement: tx.amount }    
        },
      });

      await prismaTx.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.PAID,
          paidAt: new Date(),
          providerStatus: ProviderStatus.SUCCESS,
        },
      });

      if (tx.withdrawal) {
        await prismaTx.withdrawal.update({
          where: { id: tx.withdrawal.id },
          data: {
            status: WithdrawalStatus.PAID,
            processedById: agentId,
            processedAt: new Date(),
          },
        });
      }

      return { success: true, message: 'Retrait validé avec succès' };
    });
  }

  async listMine(clientId: number, userId: string) {
    return this.prisma.withdrawal.findMany({
      where: { clientId, transaction: { senderId: userId } },
      orderBy: { requestedAt: 'desc' },
      include: { transaction: true },
    });
  }

  async adminListAll(clientId: number) {
    return this.prisma.withdrawal.findMany({ where: { clientId } });
  }

  async adminUpdateStatus(clientId: number, adminId: string, id: string, dto: UpdateWithdrawalStatusDto) {
    return this.prisma.withdrawal.update({
      where: { id },
      data: { status: dto.status },
    });
  }
}