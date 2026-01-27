// apps/backend/src/transactions/transactions.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentProvider,
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

  // =================================================================
  // 💰 GESTION TRÉSORERIE ADMIN & MULTI-DEVISES
  // =================================================================

  // 1. TAUX DE CHANGE (Hardcodé pour la démo, à connecter à une API plus tard)
  private getExchangeRate(from: string, to: string): number {
      if (from === to) return 1;
      
      const rates: Record<string, number> = {
          'EUR_XOF': 655.957,
          'XOF_EUR': 0.001524,
          
          'EUR_GNF': 9500, // Approx
          'GNF_EUR': 0.000105,

          'XOF_GNF': 14.5, // 1 FCFA = 14.5 GNF (Exemple)
          'GNF_XOF': 0.069,
      };

      const key = `${from}_${to}`;
      if (rates[key]) return rates[key];

      throw new BadRequestException(`Taux de change introuvable pour ${from} -> ${to}`);
  }

  // 2. FUND SELF (S'injecter de l'argent)
  async fundAdminWallet(adminId: string, amount: number) {
      const amountDecimal = new Prisma.Decimal(amount);
      
      const updatedAdmin = await this.prisma.user.update({
          where: { id: adminId },
          data: { balance: { increment: amountDecimal } }
      });

      return { 
          message: "Compte Admin alimenté avec succès", 
          newBalance: updatedAdmin.balance,
          currency: "XOF" // On suppose que l'admin est en XOF pour l'instant
      };
  }

  // 3. REFILL AGENCY (Admin envoie XOF -> Agence reçoit GNF)
  async refillAgency(adminId: string, agencyId: string, amountToSend: number) {
      // A. Récupérer Admin et Agence
      const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
      const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });

      if (!admin) throw new NotFoundException("Admin introuvable");
      if (!agency) throw new NotFoundException("Agence introuvable");

      // B. Vérifier Solde Admin
      const amountOut = new Prisma.Decimal(amountToSend);
      if (admin.balance.lessThan(amountOut)) {
          throw new ForbiddenException(`Solde Admin insuffisant (${admin.balance} < ${amountOut})`);
      }

      // C. Conversion Devises
      // On suppose que l'admin est en XOF (ou une devise par défaut stockée sur le Client)
      const adminCurrency = "XOF"; 
      const agencyCurrency = agency.currency || "XOF";
      
      const rate = this.getExchangeRate(adminCurrency, agencyCurrency);
      
      // Montant reçu par l'agence = Montant envoyé * Taux
      // Ex: 1.000.000 XOF * 14.5 = 14.500.000 GNF
      const amountIn = amountOut.mul(rate);

      // D. Transaction Atomique (Débit Admin / Crédit Agence)
      await this.prisma.$transaction([
          // 1. Débiter Admin
          this.prisma.user.update({
              where: { id: adminId },
              data: { balance: { decrement: amountOut } }
          }),
          // 2. Créditer Agence
          this.prisma.agency.update({
              where: { id: agencyId },
              data: { balance: { increment: amountIn } }
          }),
          // 3. Créer Historique (Type: REFILL)
          this.prisma.transaction.create({
              data: {
                  reference: `REFILL-${Date.now()}`,
                  amount: amountOut, // Montant débité
                  fees: new Prisma.Decimal(0),
                  total: amountOut,
                  currency: adminCurrency, // Devise de départ
                  status: TransactionStatus.PAID,
                  payoutMethod: PayoutMethod.BANK_DEPOSIT, // Détourné pour dire "Interne"
                  senderId: adminId,
                  recipientId: null, // C'est une agence, pas un user
                  clientId: admin.clientId!,
                  // On pourrait stocker le montant reçu et la devise cible dans des champs meta JSON si besoin
              }
          })
      ]);

      return {
          status: "SUCCESS",
          sent: `${amountOut} ${adminCurrency}`,
          rate: rate,
          received: `${amountIn} ${agencyCurrency}`,
          agencyNewBalance: (await this.prisma.agency.findUnique({where: {id: agencyId}}))?.balance
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

    if (!agent || !agent.agencyId || !agent.agency) throw new ForbiddenException("Agent sans agence.");
    if (!agent.clientId) throw new ForbiddenException("Agent sans société.");

    const amountDecimal = new Prisma.Decimal(dto.amount);
    
    // Vérification Solde Agence
    if (agent.agency.balance.lessThan(amountDecimal)) {
        throw new ForbiddenException(`Solde caisse agence insuffisant (${agent.agency.balance} ${agent.agency.currency})`);
    }

    const cleanPhone = dto.userPhone.replace(/\s/g, '').replace('+', ''); 
    const clientUser = await this.prisma.user.findFirst({
        where: { phone: { contains: cleanPhone }, clientId: agent.clientId }
    });

    if (!clientUser) throw new NotFoundException(`Client introuvable : ${dto.userPhone}`);

    return this.prisma.$transaction(async (tx) => {
        // 1. Débiter l'Agence
        await tx.agency.update({
            where: { id: agent.agencyId! },
            data: { balance: { decrement: amountDecimal } }
        });

        // 2. Créditer le Client
        await tx.user.update({
            where: { id: clientUser.id },
            data: { balance: { increment: amountDecimal } }
        });

        // 3. Historique
        const txData: Prisma.TransactionUncheckedCreateInput = {
            reference: this.generateReference(),
            amount: amountDecimal,
            fees: new Prisma.Decimal(0),
            total: amountDecimal,
            // L'agence envoie sa propre devise
            currency: agent.agency!.currency || "XOF", 
            status: TransactionStatus.PAID,
            payoutMethod: PayoutMethod.WALLET,
            paymentMethod: PaymentMethod.CASH,
            senderId: agent.id,
            recipientId: clientUser.id,
            clientId: agent.clientId!,
            paidAt: new Date(),
        };

        return tx.transaction.create({ data: txData });
    });
  }

  // =================================================================
  // TRANSFERT STANDARD (Client -> Bénéficiaire)
  // =================================================================
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