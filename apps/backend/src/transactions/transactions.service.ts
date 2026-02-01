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
  if (TERMINAL_TX.includes(from)) throw new BadRequestException(`Transition interdite: ${from} -> ${to}`);
  
  const allowed: Record<TransactionStatus, TransactionStatus[]> = {
    PENDING: [TransactionStatus.VALIDATED, TransactionStatus.CANCELLED],
    VALIDATED: [TransactionStatus.PAID, TransactionStatus.CANCELLED],
    PAID: [],
    CANCELLED: [],
  };

  if (!allowed[from]?.includes(to)) throw new BadRequestException(`Transition interdite: ${from} -> ${to}`);
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  /* =========================================================
     👑 COMPATIBILITÉ (Pour admin-transactions.controller.ts)
  ========================================================= */
  
  // Cette méthode manquait et causait une erreur TypeScript
  async adminFundSelf(user: AuthUserPayload, amount: number) {
    if (!user?.id) throw new BadRequestException('Utilisateur invalide');
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Montant positif requis');
    return this.fundAdminWallet(user.id, amount);
  }

  // =================================================================
  // 💰 GESTION TRÉSORERIE ADMIN & MULTI-DEVISES
  // =================================================================

  private getExchangeRate(from: string, to: string): number {
      if (from === to) return 1;
      
      const rates: Record<string, number> = {
          'EUR_XOF': 655.957,
          'XOF_EUR': 0.001524,
          
          'EUR_GNF': 9500, 
          'GNF_EUR': 0.000105,

          'XOF_GNF': 14.5, 
          'GNF_XOF': 0.069,
      };

      const key = `${from}_${to}`;
      return rates[key] || 1;
  }

  async fundAdminWallet(adminId: string, amount: number) {
      const amountDecimal = new Prisma.Decimal(amount);
      
      const updatedAdmin = await this.prisma.user.update({
          where: { id: adminId },
          data: { balance: { increment: amountDecimal } }
      });

      return { 
          message: "Compte alimenté avec succès", 
          newBalance: updatedAdmin.balance,
          currency: "XOF" 
      };
  }

  async refillAgency(adminId: string, agencyId: string, amountToSend: number) {
      const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
      const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });

      if (!admin) throw new NotFoundException("Admin introuvable");
      if (!agency) throw new NotFoundException("Agence introuvable");

      const amountOut = new Prisma.Decimal(amountToSend);
      if (admin.balance.lessThan(amountOut)) {
          throw new ForbiddenException(`Solde Admin insuffisant (${admin.balance} < ${amountOut})`);
      }

      const adminCurrency = "XOF"; 
      const agencyCurrency = agency.currency || "XOF";
      
      const rate = this.getExchangeRate(adminCurrency, agencyCurrency);
      const amountIn = amountOut.mul(rate);

      await this.prisma.$transaction([
          this.prisma.user.update({
              where: { id: adminId },
              data: { balance: { decrement: amountOut } }
          }),
          this.prisma.agency.update({
              where: { id: agencyId },
              data: { balance: { increment: amountIn } }
          }),
          this.prisma.transaction.create({
              data: {
                  reference: `REFILL-${Date.now()}`,
                  amount: amountOut,
                  fees: new Prisma.Decimal(0),
                  total: amountOut,
                  currency: adminCurrency,
                  status: TransactionStatus.PAID,
                  payoutMethod: PayoutMethod.BANK_DEPOSIT, 
                  senderId: adminId,
                  recipientId: null, 
                  clientId: admin.clientId!,
              }
          })
      ]);

      const updatedAgency = await this.prisma.agency.findUnique({where: {id: agencyId}});

      return {
          status: "SUCCESS",
          sent: `${amountOut} ${adminCurrency}`,
          rate: rate,
          received: `${amountIn} ${agencyCurrency}`,
          agencyNewBalance: updatedAgency?.balance
      };
  }

  // =================================================================
  // ✅ DÉPÔT / CASH-IN (Agent -> Client)
  // =================================================================
  async deposit(agentId: string, dto: CreateDepositDto): Promise<Transaction> {
    const agent = await this.prisma.user.findUnique({
        where: { id: agentId },
        include: { agency: true }
    });

    // Vérifications strictes pour éviter les erreurs TypeScript "possibly null"
    if (!agent) throw new ForbiddenException("Agent inconnu");
    if (!agent.agencyId || !agent.agency) throw new ForbiddenException("Agent sans agence.");
    if (!agent.clientId) throw new ForbiddenException("Agent sans société.");

    const amountDecimal = new Prisma.Decimal(dto.amount);
    
    if (agent.agency.balance.lessThan(amountDecimal)) {
        throw new ForbiddenException(`Solde caisse agence insuffisant`);
    }

    const cleanPhone = dto.userPhone.replace(/\s/g, '').replace('+', ''); 
    const clientUser = await this.prisma.user.findFirst({
        where: { phone: { contains: cleanPhone }, clientId: agent.clientId }
    });

    if (!clientUser) throw new NotFoundException(`Client introuvable : ${dto.userPhone}`);

    // On capture les variables locales sûres pour la transaction
    const agencyId = agent.agencyId;
    const clientId = agent.clientId;
    const agencyCurrency = agent.agency.currency || "XOF";

    return this.prisma.$transaction(async (tx) => {
        await tx.agency.update({
            where: { id: agencyId },
            data: { balance: { decrement: amountDecimal } }
        });

        await tx.user.update({
            where: { id: clientUser.id },
            data: { balance: { increment: amountDecimal } }
        });

        const txData: Prisma.TransactionUncheckedCreateInput = {
            reference: this.generateReference(),
            amount: amountDecimal,
            fees: new Prisma.Decimal(0),
            total: amountDecimal,
            currency: agencyCurrency, 
            status: TransactionStatus.PAID,
            payoutMethod: PayoutMethod.WALLET,
            paymentMethod: PaymentMethod.CASH,
            senderId: agent.id,
            recipientId: clientUser.id,
            clientId: clientId, // Utilisation de la variable locale
            paidAt: new Date(),
        };

        return tx.transaction.create({ data: txData });
    });
  }

  // ... (Méthodes restantes inchangées, assurez-vous de les garder)
  
  async create(senderId: string, dto: CreateTransactionDto): Promise<Transaction> {
    const user = await this.prisma.user.findUnique({ where: { id: senderId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.clientId) throw new ForbiddenException('User must belong to a client');
    
    const clientId = user.clientId;
    const beneficiary = await this.prisma.beneficiary.findFirst({
      where: { id: dto.beneficiaryId, userId: senderId },
    });
    if (!beneficiary) throw new NotFoundException('Beneficiary not found');

    const amount = new Prisma.Decimal(dto.amount);
    const fees = amount.mul(new Prisma.Decimal(0.015));
    const total = amount.plus(fees);

    if (user.balance.lessThan(total)) throw new ForbiddenException("Solde insuffisant.");

    const data: Prisma.TransactionUncheckedCreateInput = {
      reference: this.generateReference(),
      amount, fees, total,
      currency: dto.currency,
      payoutMethod: dto.payoutMethod ?? PayoutMethod.CASH_PICKUP,
      status: TransactionStatus.PENDING,
      senderId,
      beneficiaryId: beneficiary.id,
      clientId, 
    };

    return this.prisma.transaction.create({ data });
  }

  async findForUser(senderId: string): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: { OR: [{ senderId }, { recipientId: senderId }] },
      orderBy: { createdAt: 'desc' },
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

  async adminUpdateStatusForAdmin(adminId: string, id: string, dto: UpdateTransactionStatusDto): Promise<Transaction> {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin?.clientId) throw new ForbiddenException("Admin sans société.");

    const tx = await this.prisma.transaction.findFirst({
      where: { id, clientId: admin.clientId },
      include: { withdrawal: { select: { id: true, status: true } } },
    });
    if (!tx) throw new NotFoundException('Transaction not found');

    assertTxTransition(tx.status, dto.status);

    if (dto.status === TransactionStatus.CANCELLED && tx.withdrawal?.id) {
      throw new ConflictException('Impossible d\'annuler : retrait déjà initié');
    }

    const now = new Date();
    const data: Prisma.TransactionUpdateInput = 
        dto.status === TransactionStatus.PAID ? { status: TransactionStatus.PAID, paidAt: now, providerStatus: ProviderStatus.SUCCESS } :
        dto.status === TransactionStatus.CANCELLED ? { status: TransactionStatus.CANCELLED, cancelledAt: now } :
        { status: dto.status };

    return this.prisma.transaction.update({ where: { id }, data });
  }

  private generateReference(): string {
    const now = Date.now();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `TX-${now}-${random}`;
  }
}