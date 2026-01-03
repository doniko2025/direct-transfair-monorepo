// src/transactions/transactions.service.ts
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
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto';

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

  const ok = allowed[from]?.includes(to);
  if (!ok) throw new BadRequestException(`Transition interdite: ${from} -> ${to}`);
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  // USER — Création transaction
  async create(senderId: string, dto: CreateTransactionDto): Promise<Transaction> {
    const user = await this.prisma.user.findUnique({ where: { id: senderId } });
    if (!user) throw new NotFoundException('User not found');

    const clientId = user.clientId;

    const beneficiary = await this.prisma.beneficiary.findFirst({
      where: { id: dto.beneficiaryId, userId: senderId },
    });
    if (!beneficiary) throw new NotFoundException('Beneficiary not found for this user');

    if (beneficiary.clientId !== clientId) {
      throw new ForbiddenException('Beneficiary does not belong to this client');
    }

    const amount = new Prisma.Decimal(dto.amount);
    const fees = amount.mul(new Prisma.Decimal(0.03));
    const total = amount.plus(fees);

    const data: Prisma.TransactionUncheckedCreateInput = {
      reference: this.generateReference(),
      amount,
      fees,
      total,
      currency: dto.currency,
      payoutMethod: dto.payoutMethod ?? PayoutMethod.CASH_PICKUP,
      status: TransactionStatus.PENDING,
      senderId,
      beneficiaryId: beneficiary.id,
      clientId,
      // paymentMethod/provider/providerStatus ont des defaults Prisma
    };

    return this.prisma.transaction.create({ data });
  }

  async findForUser(senderId: string): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: { senderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneForUser(id: string, senderId: string): Promise<Transaction> {
    const tx = await this.prisma.transaction.findFirst({ where: { id, senderId } });
    if (!tx) throw new NotFoundException('Transaction not found');
    return tx;
  }

  // ADMIN — Liste
  async adminFindAllForAdmin(adminId: string): Promise<Transaction[]> {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin user not found');

    return this.prisma.transaction.findMany({
      where: { clientId: admin.clientId },
      orderBy: { createdAt: 'desc' },
      include: { sender: true, beneficiary: true, client: true, withdrawal: true },
    });
  }

  // ADMIN — Changement statut transaction (verrouillé)
  async adminUpdateStatusForAdmin(
    adminId: string,
    id: string,
    dto: UpdateTransactionStatusDto,
  ): Promise<Transaction> {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin user not found');

    const tx = await this.prisma.transaction.findFirst({
      where: { id, clientId: admin.clientId },
      include: { withdrawal: { select: { id: true, status: true } } },
    });
    if (!tx) throw new NotFoundException('Transaction not found');

    const from = tx.status;
    const to = dto.status;

    assertTxTransition(from, to);

    // Règle: on ne peut pas annuler si un retrait existe déjà
    if (to === TransactionStatus.CANCELLED && tx.withdrawal?.id) {
      throw new ConflictException('Annulation interdite: un retrait existe déjà pour cette transaction');
    }

    // Règles de “PAID” selon provider (évite les ambiguïtés financières)
    if (to === TransactionStatus.PAID) {
      if (from !== TransactionStatus.VALIDATED) {
        throw new BadRequestException('Marquage PAID interdit: la transaction doit être VALIDATED');
      }

      // Orange Money: statut PAID doit provenir du flux paiement (provider SUCCESS)
      if (tx.provider === PaymentProvider.ORANGE_MONEY && tx.providerStatus !== ProviderStatus.SUCCESS) {
        throw new BadRequestException('Marquage PAID interdit: Orange Money doit être SUCCESS via le flux paiement');
      }

      // Sendwave: autorisé (paiement manuel confirmé par admin)
      // Wallet/DIRECT: autorisé (paiement direct)
    }

    const now = new Date();

    const data: Prisma.TransactionUpdateInput = (() => {
      switch (to) {
        case TransactionStatus.VALIDATED:
          return {
            status: TransactionStatus.VALIDATED,
            paidAt: null,
            cancelledAt: null,
            // On garde provider/providerRef/providerStatus tels quels
          };

        case TransactionStatus.PAID:
          return {
            status: TransactionStatus.PAID,
            paidAt: now,
            cancelledAt: null,
            // Si l’admin valide un paiement (ex: Sendwave), on fige providerStatus=SUCCESS
            providerStatus: ProviderStatus.SUCCESS,
          };

        case TransactionStatus.CANCELLED:
          return {
            status: TransactionStatus.CANCELLED,
            cancelledAt: now,
            paidAt: null,
            // Optionnel: on pourrait mettre providerStatus=FAILED si un provider était engagé
          };

        default:
          throw new BadRequestException(`Statut non supporté: ${String(to)}`);
      }
    })();

    return this.prisma.transaction.update({
      where: { id },
      data,
    });
  }

  private generateReference(): string {
    const now = Date.now();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `TX-${now}-${random}`;
  }
}
