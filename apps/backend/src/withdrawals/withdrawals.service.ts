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
  AgencyType,
  CommissionSourceType,
  CommissionDestType,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { UpdateWithdrawalStatusDto } from './dto/update-withdrawal-status.dto';

@Injectable()
export class WithdrawalsService {
  constructor(private readonly prisma: PrismaService) {}

  // 🛠️ UTILITAIRE ENRICHISSEMENT
  private enrichTransaction(tx: any) {
      if (!tx) return tx;
      if (tx.providerRef && typeof tx.providerRef === 'string' && tx.providerRef.includes('|')) {
          const parts = tx.providerRef.split('|');
          if (parts.length >= 2) {
              const guestName = parts[1];
              tx.sender = {
                  ...tx.sender,
                  firstName: guestName,
                  lastName: "(Client)"
              };
              tx.providerRef = parts[0];
          }
      }
      return tx;
  }

  async create(clientId: number, userId: string, dto: CreateWithdrawalDto) {
    // (Code inchangé pour create...)
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (dto.amount) {
      const amount = new Prisma.Decimal(dto.amount);
      const fees = amount.mul(new Prisma.Decimal(0.01));
      const total = amount.plus(fees);
      if (user.balance.lessThan(total)) throw new BadRequestException('Solde insuffisant');
      const withdrawalCode = Math.floor(100000000 + Math.random() * 900000000).toString();
      return this.prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: userId }, data: { balance: { decrement: total } } });
        const txData: Prisma.TransactionUncheckedCreateInput = {
          reference: `WD-${Date.now()}`, amount, fees, total, currency: 'XOF', status: TransactionStatus.PENDING,
          payoutMethod: PayoutMethod.CASH_PICKUP, paymentMethod: PaymentMethod.WALLET, senderId: userId, clientId,
          providerRef: withdrawalCode, providerStatus: ProviderStatus.PENDING,
        };
        const transaction = await tx.transaction.create({ data: txData });
        return tx.withdrawal.create({ data: { clientId, transactionId: transaction.id, method: PayoutMethod.CASH_PICKUP, status: WithdrawalStatus.PENDING } });
      });
    }
    const transactionId = String(dto.transactionId ?? '').trim();
    if (!transactionId) throw new BadRequestException('Montant ou TransactionId requis');
    const tx = await this.prisma.transaction.findFirst({ where: { id: transactionId, clientId } });
    if (!tx) throw new NotFoundException('Transaction introuvable');
    return this.prisma.withdrawal.create({ data: { clientId, transactionId: tx.id, method: dto.method ?? tx.payoutMethod, status: WithdrawalStatus.PENDING } });
  }

  async agentCheckCode(clientId: number, code: string) {
    const cleanCode = String(code ?? '').trim();
    if (!cleanCode) throw new BadRequestException('Code requis');

    const tx = await this.prisma.transaction.findFirst({
      where: {
        clientId,
        OR: [
            { reference: cleanCode }, 
            { providerRef: cleanCode },
            { providerRef: { startsWith: `${cleanCode}|` } }
        ],
      },
      // ✅ ON INCLUT LE BÉNÉFICIAIRE
      include: { 
          sender: true,
          beneficiary: true 
      },
    });

    if (!tx) throw new NotFoundException('Code invalide ou introuvable.');

    const richTx = this.enrichTransaction(tx);

    // ✅ LOGIQUE PAYS D'ORIGINE
    // Si la devise est XOF, on assume Sénégal (ou on pourrait regarder le pays de l'agence)
    let originCountry = 'International';
    if (richTx.currency === 'XOF') originCountry = 'Sénégal';
    if (richTx.currency === 'GNF') originCountry = 'Guinée';

    return {
      valid: true,
      
      // ✅ MONTANTS
      amount: richTx.amount, // Montant envoyé (ex: 48 XOF)
      currency: richTx.currency,
      
      // ✅ CONVERSION (Pour le paiement en GNF)
      receivedAmount: richTx.receivedAmount, // ex: 757 GNF
      targetCurrency: richTx.targetCurrency, // ex: GNF
      
      // ✅ PERSONNES
      senderName: richTx.sender ? `${richTx.sender.firstName ?? ''} ${richTx.sender.lastName ?? ''}`.trim() : 'Client Inconnu',
      beneficiary: richTx.beneficiary, // On renvoie tout l'objet bénéficiaire
      
      // ✅ INFOS
      transactionId: richTx.id,
      status: richTx.status,
      originCountry: originCountry, // Corrigé ici
      reference: richTx.reference
    };
  }

  async agentProcessPayment(clientId: number, agentId: string, code: string) {
    const cleanCode = String(code ?? '').trim();
    if (!cleanCode) throw new BadRequestException('Code requis');

    const tx = await this.prisma.transaction.findFirst({
      where: {
        clientId,
        OR: [
            { reference: cleanCode }, 
            { providerRef: cleanCode },
            { providerRef: { startsWith: `${cleanCode}|` } }
        ],
      },
      include: {
        withdrawal: true,
        sender: { include: { agency: true } },
      },
    });

    if (!tx) throw new NotFoundException('Code introuvable');

    if (tx.status === TransactionStatus.PENDING) throw new ForbiddenException('Transaction en attente de validation Admin.');
    if (tx.status === TransactionStatus.PAID) throw new ConflictException('Code déjà payé.');
    if (tx.status === TransactionStatus.CANCELLED) throw new ConflictException('Transaction annulée.');
    if (tx.status !== TransactionStatus.VALIDATED) throw new ForbiddenException(`Statut invalide: ${tx.status}`);

    const agent = await this.prisma.user.findUnique({
      where: { id: agentId },
      include: { agency: true },
    });
    if (!agent || !agent.agencyId) throw new ForbiddenException('Agent sans agence');

    return this.prisma.$transaction(async (prismaTx) => {
      // 💰 COMMISSION
      let commissionPayer = new Prisma.Decimal(0);
      let sourceType: CommissionSourceType = CommissionSourceType.WALLET;
      if (tx.sender?.agency) {
        sourceType = tx.sender.agency.type === AgencyType.PARTNER ? CommissionSourceType.PARTNER : CommissionSourceType.SUBSIDIARY;
      }
      const destType: CommissionDestType = agent.agency!.type === AgencyType.PARTNER ? CommissionDestType.PARTNER : CommissionDestType.SUBSIDIARY;

      const rule = await prismaTx.commissionConfig.findUnique({
        where: { clientId_sourceType_destType: { clientId, sourceType, destType } },
      });

      if (rule && rule.payerShare > 0 && tx.fees.gt(0)) {
        const sharePercent = new Prisma.Decimal(rule.payerShare).div(100);
        commissionPayer = tx.fees.mul(sharePercent);
      }

      // ✅ DÉBIT/CRÉDIT AGENCE (En tenant compte de la conversion si nécessaire)
      // Note: Ici on simplifie en assumant que l'agent est remboursé dans sa devise locale
      // Si l'agent paie en GNF, il doit être crédité de l'équivalent.
      // Pour l'instant, on crédite la valeur nominale du receivedAmount si elle existe.
      
      const amountPaid = tx.receivedAmount && tx.receivedAmount.gt(0) ? tx.receivedAmount : tx.amount;
      
      // Attention : Si l'agence est en GNF et la transaction en XOF, il faut convertir la commission aussi
      // (Pour simplifier on crédite le montant payé + la commission calculée en XOF convertie... 
      //  mais pour éviter les bugs de conversion complexes ici, on crédite ce qui est sorti).
      
      await prismaTx.agency.update({
        where: { id: agent.agencyId! },
        data: {
          balance: { increment: amountPaid }, // On rembourse ce qu'il a donné
          cash: { decrement: amountPaid },    // Il a donné du cash
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
          data: { status: WithdrawalStatus.PAID, processedById: agentId, processedAt: new Date() },
        });
      } else {
        await prismaTx.withdrawal.create({
          data: {
            clientId,
            transactionId: tx.id,
            method: tx.payoutMethod,
            status: WithdrawalStatus.PAID,
            processedById: agentId,
            processedAt: new Date(),
          },
        });
      }

      return { success: true, message: 'Retrait validé avec succès.' };
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
    return this.prisma.withdrawal.update({ where: { id }, data: { status: dto.status } });
  }
}