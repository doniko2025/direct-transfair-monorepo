// apps/backend/src/transactions/transactions.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProviderStatus,
  Transaction,
  TransactionStatus,
  PayoutMethod,
  PaymentMethod,
  WithdrawalStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto, CreateDepositDto } from './dto/create-transaction.dto';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto';
import type { AuthUserPayload } from '../auth/strategies/jwt.strategy';

const TERMINAL_TX: TransactionStatus[] = [
  TransactionStatus.PAID,
  TransactionStatus.CANCELLED,
];

function assertTxTransition(from: TransactionStatus, to: TransactionStatus) {
  if (from === to) return;
  if (TERMINAL_TX.includes(from)) {
    throw new BadRequestException(`Transition interdite: ${from} -> ${to}`);
  }

  const allowed: Record<TransactionStatus, TransactionStatus[]> = {
    PENDING: [TransactionStatus.VALIDATED, TransactionStatus.CANCELLED],
    VALIDATED: [TransactionStatus.PAID, TransactionStatus.CANCELLED],
    PAID: [],
    CANCELLED: [],
  };

  if (!allowed[from]?.includes(to)) {
    throw new BadRequestException(`Transition interdite: ${from} -> ${to}`);
  }
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  // =================================================================
  // 🛑 ANNULATION & REMBOURSEMENT
  // =================================================================
  async cancel(userId: string, transactionId: string): Promise<Transaction> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { sender: { include: { agency: true } } },
    });

    if (!tx) throw new NotFoundException('Transaction introuvable');

    if (tx.senderId !== userId) {
      throw new ForbiddenException('Vous ne pouvez annuler que vos propres transactions');
    }

    if (tx.status === TransactionStatus.PAID) {
      throw new ConflictException("Impossible d'annuler : Le client a déjà retiré l'argent !");
    }
    if (tx.status === TransactionStatus.CANCELLED) {
      throw new ConflictException('Cette transaction est déjà annulée.');
    }

    return this.prisma.$transaction(async (prismaTx) => {
      // 1. REMBOURSEMENT (RE-CRÉDIT)
      if (tx.sender?.role === 'AGENT' && tx.sender.agencyId) {
        await prismaTx.agency.update({
          where: { id: tx.sender.agencyId },
          data: { balance: { increment: tx.total } }, 
        });
      } else {
        await prismaTx.user.update({
          where: { id: tx.senderId },
          data: { balance: { increment: tx.total } },
        });
      }

      const updatedTx = await prismaTx.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.CANCELLED,
          cancelledAt: new Date(),
          providerStatus: ProviderStatus.CANCELLED,
        },
      });

      await prismaTx.withdrawal.updateMany({
        where: { transactionId },
        data: { status: WithdrawalStatus.CANCELLED },
      });

      return updatedTx;
    });
  }

  // =================================================================
  // 🚀 CRÉATION TRANSACTION (ENVOI) - CORRIGÉ
  // =================================================================
  async create(senderId: string, dto: CreateTransactionDto): Promise<Transaction> {
    const user = await this.prisma.user.findUnique({
      where: { id: senderId },
      include: { agency: true },
    });

    if (!user) throw new NotFoundException('User not found');
    if (!user.clientId) throw new ForbiddenException('User must belong to a client');

    const clientId = user.clientId;
    const beneficiary = await this.prisma.beneficiary.findFirst({
      where: { id: dto.beneficiaryId, userId: senderId },
    });
    if (!beneficiary) throw new NotFoundException('Beneficiary not found');

    // ✅ FRAIS INTELLIGENTS : 0 si Wallet, 1.5% sinon
    const isWalletTransfer = dto.payoutMethod === PayoutMethod.MOBILE_MONEY || dto.payoutMethod === PayoutMethod.WALLET;
    const feeRate = isWalletTransfer ? 0 : 0.015;

    const amount = new Prisma.Decimal(dto.amount);
    const fees = amount.mul(new Prisma.Decimal(feeRate)); 
    const total = amount.plus(fees);

    // ✅ CORRECTION 1 : On type explicitement recipientUser avec 'any' pour éviter l'erreur "type never"
    let recipientUser: any = null;
    
    // Si la méthode est MOBILE_MONEY (Wallet), on cherche le compte User associé
    if (isWalletTransfer) {
        // ✅ NETTOYAGE ROBUSTE DU NUMÉRO (Garde uniquement les chiffres)
        const cleanPhone = beneficiary.phone?.replace(/[^0-9]/g, '') || '';
        
        recipientUser = await this.prisma.user.findFirst({
            where: { phone: { contains: cleanPhone }, clientId }
        });
    }

    return this.prisma.$transaction(async (tx) => {
      let currency = dto.currency;

      // 1. DÉBIT DE L'EXPÉDITEUR
      if (user.role === 'AGENT' && user.agencyId && user.agency) {
        if (user.agency.balance.lessThan(total)) {
          throw new ForbiddenException(`Solde Agence insuffisant (${user.agency.balance} < ${total})`);
        }
        await tx.agency.update({
          where: { id: user.agencyId },
          data: { 
              balance: { decrement: total }, 
              cash: { increment: total } 
          },
        });
        currency = user.agency.currency || 'XOF';
      } else {
        if (user.balance.lessThan(total)) {
          throw new ForbiddenException(`Solde insuffisant (${user.balance} < ${total})`);
        }
        await tx.user.update({
          where: { id: senderId },
          data: { balance: { decrement: total } },
        });
      }

      // ✅ CORRECTION 2, 3 & 4 : On type explicitement ces variables pour que TypeScript accepte les changements de valeurs
      let status: TransactionStatus = TransactionStatus.PENDING;
      let providerStatus: ProviderStatus = ProviderStatus.PENDING;
      let paidAt: Date | null = null;
      let withdrawalCode: string | null = null;

      if (recipientUser) {
          // ✅ C'EST UN WALLET-TO-WALLET
          await tx.user.update({
              where: { id: recipientUser.id },
              data: { balance: { increment: amount } } // Crédit du montant sans frais
          });
          
          status = TransactionStatus.PAID;
          providerStatus = ProviderStatus.SUCCESS;
          paidAt = new Date();
      } else {
          // ⚠️ C'EST DU CASH PICKUP
          const validationThreshold = new Prisma.Decimal(500000);
          status = amount.lte(validationThreshold) ? TransactionStatus.VALIDATED : TransactionStatus.PENDING;
          withdrawalCode = this.generateReference(); 
      }

      // 3. ENREGISTREMENT TRANSACTION
      const data: Prisma.TransactionUncheckedCreateInput = {
        reference: `TX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        amount,
        fees,
        total,
        currency,
        payoutMethod: dto.payoutMethod ?? PayoutMethod.CASH_PICKUP,
        status: status,
        senderId,
        beneficiaryId: beneficiary.id,
        recipientId: recipientUser ? recipientUser.id : null,
        clientId,
        providerRef: withdrawalCode, 
        providerStatus: providerStatus,
        paidAt: paidAt
      };

      const transaction = await tx.transaction.create({ data });

      return transaction;
    });
  }

  // ... (Reste inchangé) ...
  
  async deposit(agentId: string, dto: CreateDepositDto): Promise<Transaction> {
    const agent = await this.prisma.user.findUnique({
      where: { id: agentId },
      include: { agency: true },
    });

    if (!agent || !agent.agencyId || !agent.agency) {
      throw new ForbiddenException('Agent ou Agence invalide');
    }

    const amountDecimal = new Prisma.Decimal(dto.amount);
    if (agent.agency.balance.lessThan(amountDecimal)) {
      throw new ForbiddenException('Solde virtuel agence insuffisant pour effectuer ce dépôt.');
    }

    const cleanPhone = dto.userPhone.replace(/[^0-9]/g, ''); // Nettoyage amélioré
    const clientUser = await this.prisma.user.findFirst({
      where: { phone: { contains: cleanPhone }, clientId: agent.clientId },
    });

    if (!clientUser) throw new NotFoundException(`Client introuvable : ${dto.userPhone}`);

    const agencyId = agent.agencyId;
    const clientId = agent.clientId!;

    return this.prisma.$transaction(async (tx) => {
      await tx.agency.update({
        where: { id: agencyId },
        data: { 
            balance: { decrement: amountDecimal },
            cash: { increment: amountDecimal }
        },
      });

      await tx.user.update({
        where: { id: clientUser.id },
        data: { balance: { increment: amountDecimal } },
      });

      const txData: Prisma.TransactionUncheckedCreateInput = {
        reference: this.generateReference(),
        amount: amountDecimal,
        fees: new Prisma.Decimal(0),
        total: amountDecimal,
        currency: agent.agency!.currency || 'XOF',
        status: TransactionStatus.PAID,
        payoutMethod: PayoutMethod.WALLET,
        paymentMethod: PaymentMethod.CASH,
        senderId: agent.id,
        recipientId: clientUser.id,
        clientId,
        paidAt: new Date(),
        providerStatus: ProviderStatus.SUCCESS,
      };

      return tx.transaction.create({ data: txData });
    });
  }

  async adminFundSelf(user: AuthUserPayload, amount: number) {
    if (!user?.id) throw new BadRequestException('Utilisateur invalide');
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Montant positif requis');
    return this.fundAdminWallet(user.id, amount);
  }

  async fundAdminWallet(adminId: string, amount: number) {
    const updatedAdmin = await this.prisma.user.update({
      where: { id: adminId },
      data: { balance: { increment: amount } },
    });
    return { message: 'Succès', newBalance: updatedAdmin.balance };
  }

  async refillAgency(adminId: string, agencyId: string, amountToSend: number) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    if (!admin || !agency) throw new NotFoundException('Introuvable');

    const amountOut = new Prisma.Decimal(amountToSend);
    if (admin.balance.lessThan(amountOut)) throw new ForbiddenException('Solde Admin insuffisant');

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: adminId }, data: { balance: { decrement: amountOut } } }),
      this.prisma.agency.update({ where: { id: agencyId }, data: { balance: { increment: amountOut } } }),
      this.prisma.transaction.create({
        data: {
          reference: `REFILL-${Date.now()}`,
          amount: amountOut,
          fees: new Prisma.Decimal(0),
          total: amountOut,
          currency: 'XOF',
          status: TransactionStatus.PAID,
          payoutMethod: PayoutMethod.BANK_DEPOSIT,
          senderId: adminId,
          clientId: admin.clientId!,
        },
      }),
    ]);

    return { 
        status: 'SUCCESS',
        sent: amountToSend,
        received: amountToSend,
        rate: 1 
    };
  }

  async findForUser(senderId: string): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: { 
          OR: [
              { senderId }, 
              { recipientId: senderId },
              { withdrawal: { processedById: senderId } }
          ] 
      },
      orderBy: { createdAt: 'desc' },
      include: { 
          withdrawal: true,
          sender: { select: { firstName: true, lastName: true, phone: true } },
          beneficiary: true
      }
    });
  }

  async findOneForUser(id: string, senderId: string): Promise<Transaction> {
    const tx = await this.prisma.transaction.findFirst({ where: { id, senderId } });
    if (!tx) throw new NotFoundException('Transaction not found');
    return tx;
  }

  async adminFindAllForAdmin(adminId: string): Promise<Transaction[]> {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin?.clientId) return [];
    return this.prisma.transaction.findMany({
      where: { clientId: admin.clientId },
      orderBy: { createdAt: 'desc' },
      include: { sender: true, beneficiary: true, client: true, withdrawal: true },
    });
  }

  async adminUpdateStatusForAdmin(
    adminId: string,
    id: string,
    dto: UpdateTransactionStatusDto,
  ): Promise<Transaction> {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin?.clientId) throw new ForbiddenException('Admin sans société.');

    const tx = await this.prisma.transaction.findFirst({
      where: { id, clientId: admin.clientId },
      include: { withdrawal: { select: { id: true, status: true } } },
    });
    if (!tx) throw new NotFoundException('Transaction not found');

    assertTxTransition(tx.status, dto.status);

    const data: Prisma.TransactionUpdateInput =
      dto.status === TransactionStatus.PAID
        ? { status: TransactionStatus.PAID, paidAt: new Date(), providerStatus: ProviderStatus.SUCCESS }
        : { status: dto.status };

    return this.prisma.transaction.update({ where: { id }, data });
  }

  private generateReference(): string {
    const now = Date.now();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `TX-${now}-${random}`;
  }
}