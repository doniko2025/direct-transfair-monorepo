// apps/backend/src/withdrawals/withdrawals.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TransactionStatus, WithdrawalStatus, PayoutMethod, PaymentMethod } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { UpdateWithdrawalStatusDto } from './dto/update-withdrawal-status.dto';

@Injectable()
export class WithdrawalsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * USER — Créer une demande de retrait (Génère un code)
   */
  async create(clientId: number, userId: string, dto: CreateWithdrawalDto) {
    // 1. Vérifier solde utilisateur
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    
    // Si amount est fourni, c'est un nouveau retrait Cash-Out
    if (dto.amount) {
        const amount = new Prisma.Decimal(dto.amount);
        const fees = amount.mul(0.01);
        const total = amount.plus(fees);

        if (user.balance.lessThan(total)) {
            throw new BadRequestException('Solde insuffisant pour ce retrait');
        }

        const withdrawalCode = `DT-${Math.floor(100000 + Math.random() * 900000)}`;

        return this.prisma.$transaction(async (tx) => {
            // A. Débiter le client (Réserve les fonds)
            await tx.user.update({
                where: { id: userId },
                data: { balance: { decrement: total } }
            });

            // B. Créer la Transaction parente (PENDING)
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
                providerRef: withdrawalCode, // Le fameux code DT-XXXXXX
            };

            const transaction = await tx.transaction.create({ data: txData });

            // C. Créer l'objet Withdrawal
            return tx.withdrawal.create({
                data: {
                    clientId,
                    transactionId: transaction.id,
                    method: PayoutMethod.CASH_PICKUP,
                    status: WithdrawalStatus.PENDING,
                }
            });
        });
    }

    // Sinon, logique legacy (retrait d'une transaction existante par ID)
    const transactionId = String(dto.transactionId ?? '').trim();
    if (!transactionId) throw new BadRequestException('Montant ou TransactionId requis');
    
    const tx = await this.prisma.transaction.findFirst({ where: { id: transactionId, clientId } });
    if (!tx) throw new NotFoundException('Transaction introuvable');
    
    return this.prisma.withdrawal.create({
        data: {
            clientId,
            transactionId: tx.id,
            method: dto.method ?? tx.payoutMethod,
            status: WithdrawalStatus.PENDING,
        }
    });
  }

  /**
   * AGENT — Vérifier un code
   */
  async agentCheckCode(clientId: number, code: string) {
      // On cherche la transaction liée à ce code
      const tx = await this.prisma.transaction.findFirst({
          where: { 
              providerRef: code, 
              clientId,
              status: TransactionStatus.PENDING 
          },
          include: { sender: true }
      });

      if (!tx) throw new NotFoundException("Code invalide ou expiré");

      return {
          valid: true,
          amount: tx.amount,
          currency: tx.currency,
          senderName: tx.sender ? `${tx.sender.firstName} ${tx.sender.lastName}` : "Client Inconnu",
          transactionId: tx.id
      };
  }

  /**
   * AGENT — Payer le retrait (Cash-Out)
   */
  async agentProcessPayment(clientId: number, agentId: string, code: string) {
      // 1. Vérifier Code
      const tx = await this.prisma.transaction.findFirst({
          where: { 
              providerRef: code, 
              clientId,
              status: TransactionStatus.PENDING 
          },
          include: { withdrawal: true }
      });

      if (!tx || !tx.withdrawal) throw new NotFoundException("Code invalide ou déjà payé");

      // 2. Vérifier Agent
      const agent = await this.prisma.user.findUnique({
          where: { id: agentId },
          include: { agency: true }
      });
      if (!agent || !agent.agencyId) throw new ForbiddenException("Agent sans agence");

      // 3. Exécuter Paiement
      return this.prisma.$transaction(async (prismaTx) => {
          // A. Créditer Solde Virtuel de l'Agence (Elle a donné du cash, elle gagne du virtuel)
          await prismaTx.agency.update({
              where: { id: agent.agencyId! },
              data: { balance: { increment: tx.total } } 
          });

          // B. Marquer Transaction comme PAYÉE
          await prismaTx.transaction.update({
              where: { id: tx.id },
              data: { 
                  status: TransactionStatus.PAID,
                  paidAt: new Date(),
                  providerStatus: 'SUCCESS'
              }
          });

          // C. Marquer Retrait comme PAYÉ
          await prismaTx.withdrawal.update({
              where: { id: tx.withdrawal!.id },
              data: {
                  status: WithdrawalStatus.PAID,
                  processedById: agentId,
                  processedAt: new Date()
              }
          });

          return { success: true, message: "Retrait validé avec succès" };
      });
  }

  async listMine(clientId: number, userId: string) {
    return this.prisma.withdrawal.findMany({
      where: { clientId, transaction: { senderId: userId } },
      orderBy: { requestedAt: 'desc' },
      include: { transaction: true }
    });
  }

  async adminListAll(clientId: number) {
      return this.prisma.withdrawal.findMany({ where: { clientId } });
  }

  async adminUpdateStatus(clientId: number, adminId: string, id: string, dto: UpdateWithdrawalStatusDto) {
      return this.prisma.withdrawal.update({
          where: { id },
          data: { status: dto.status }
      });
  }
}