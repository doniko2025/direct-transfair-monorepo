// apps/backend/src/withdrawals/withdrawals.service.ts
// =========================================================
// WITHDRAWALS SERVICE v4.1
// ✅ Plus de user.balance ni agency.cash (schéma v4 = Wallets)
// ✅ Débit via Wallet lors de la demande de retrait
// ✅ Logique agent inchangée côté business
// ✅ FIX: availableBalance lu après getWalletById (wallet sérialisé)
// =========================================================

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
import { WalletsService } from '../wallets/wallets.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { UpdateWithdrawalStatusDto } from './dto/update-withdrawal-status.dto';

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletsService: WalletsService,
  ) {}

  // ========================================================
  // UTILITAIRE
  // ========================================================

  private enrichTransaction(tx: any) {
    if (!tx) return tx;
    if (
      tx.providerRef &&
      typeof tx.providerRef === 'string' &&
      tx.providerRef.includes('|')
    ) {
      const parts = tx.providerRef.split('|');
      if (parts.length >= 2) {
        tx.sender = { ...tx.sender, firstName: parts[1], lastName: '(Client)' };
        tx.providerRef = parts[0];
      }
    }
    return tx;
  }

  // ========================================================
  // CRÉATION — Demande de retrait
  // ========================================================

  async create(clientId: number, userId: string, dto: CreateWithdrawalDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // ─── RETRAIT PAR MONTANT ────────────────────────────
    if (dto.amount) {
      const amount = new Prisma.Decimal(dto.amount);
      const fees = amount.mul(new Prisma.Decimal(0.01));
      const total = amount.plus(fees);

      const currency = user.primaryCurrency ?? 'XOF';

      // ✅ FIX: getOrCreateWallet retourne { id, currency }
      // On doit récupérer le wallet complet pour lire availableBalance
      const walletRef = await this.walletsService.getOrCreateWallet({ userId, currency });
      const wallet = await this.walletsService.getWalletById(walletRef.id, userId).catch(async () => {
        // fallback: lire directement en base
        return this.prisma.wallet.findUnique({ where: { id: walletRef.id } }).then(w => {
          if (!w) throw new NotFoundException('Wallet introuvable');
          const bal = Number(w.balance);
          const res = Number(w.reservedBalance);
          return { id: w.id, currency: w.currency, balance: bal, reservedBalance: res, availableBalance: bal - res, isDefault: w.isDefault, isActive: w.isActive };
        });
      });

      if (wallet.availableBalance < Number(total)) {
        throw new BadRequestException(
          `Solde ${currency} insuffisant. Disponible : ${wallet.availableBalance}`,
        );
      }

      const withdrawalCode = Math.floor(
        100000000 + Math.random() * 900000000,
      ).toString();

      await this.walletsService.debit(
        wallet.id,
        Number(total),
        `Demande retrait ${withdrawalCode}`,
      );

      return this.prisma.$transaction(async (tx) => {
        const txData: Prisma.TransactionUncheckedCreateInput = {
          reference: `WD-${Date.now()}`,
          amount,
          fees,
          total,
          currency,
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

    // ─── RETRAIT PAR TRANSACTION ID ─────────────────────
    const transactionId = String(dto.transactionId ?? '').trim();
    if (!transactionId) {
      throw new BadRequestException('Montant ou TransactionId requis');
    }

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

  // ========================================================
  // AGENT — Vérifier un code de retrait
  // ========================================================

  async agentCheckCode(clientId: number, code: string) {
    const cleanCode = String(code ?? '').trim();
    if (!cleanCode) throw new BadRequestException('Code requis');

    const tx = await this.prisma.transaction.findFirst({
      where: {
        clientId,
        OR: [
          { reference: cleanCode },
          { providerRef: cleanCode },
          { providerRef: { startsWith: `${cleanCode}|` } },
        ],
      },
      include: { sender: true, beneficiary: true },
    });

    if (!tx) throw new NotFoundException('Code invalide ou introuvable.');

    const richTx = this.enrichTransaction({ ...tx });

    const originCountry =
      tx.currency === 'GNF' ? 'Guinée'
      : tx.currency === 'XOF' ? 'Zone UEMOA'
      : tx.currency === 'EUR' ? 'Europe'
      : tx.currency === 'GBP' ? 'Royaume-Uni'
      : 'International';

    return {
      valid: true,
      amount: richTx.amount,
      currency: richTx.currency,
      receivedAmount: richTx.receivedAmount,
      targetCurrency: richTx.targetCurrency,
      senderName: richTx.sender
        ? `${richTx.sender.firstName ?? ''} ${richTx.sender.lastName ?? ''}`.trim()
        : 'Client Inconnu',
      beneficiary: richTx.beneficiary,
      transactionId: richTx.id,
      status: richTx.status,
      originCountry,
      reference: richTx.reference,
    };
  }

  // ========================================================
  // AGENT — Valider un paiement (Cash-Out)
  // ========================================================

  async agentProcessPayment(clientId: number, agentId: string, code: string) {
    const cleanCode = String(code ?? '').trim();
    if (!cleanCode) throw new BadRequestException('Code requis');

    const tx = await this.prisma.transaction.findFirst({
      where: {
        clientId,
        OR: [
          { reference: cleanCode },
          { providerRef: cleanCode },
          { providerRef: { startsWith: `${cleanCode}|` } },
        ],
      },
      include: { withdrawal: true, sender: { include: { agency: true } } },
    });

    if (!tx) throw new NotFoundException('Code introuvable');

    if (tx.status === TransactionStatus.PENDING)
      throw new ForbiddenException('Transaction en attente de validation Admin.');
    if (tx.status === TransactionStatus.PAID)
      throw new ConflictException('Code déjà payé.');
    if (tx.status === TransactionStatus.CANCELLED)
      throw new ConflictException('Transaction annulée.');
    if (tx.status !== TransactionStatus.VALIDATED)
      throw new ForbiddenException(`Statut invalide: ${tx.status}`);

    const agent = await this.prisma.user.findUnique({
      where: { id: agentId },
      include: { agency: true },
    });
    if (!agent || !agent.agencyId || !agent.agency) {
      throw new ForbiddenException('Agent sans agence');
    }

    const agencyWallets = await this.prisma.wallet.findMany({
      where: { agencyId: agent.agencyId, isActive: true },
    });

    const payoutCurrency = tx.targetCurrency ?? tx.currency;
    const agencyWallet =
      agencyWallets.find((w) => w.currency === payoutCurrency) ??
      agencyWallets.find((w) => w.isDefault) ??
      agencyWallets[0];

    if (!agencyWallet) {
      throw new ForbiddenException(
        `Wallet agence ${payoutCurrency} introuvable. Contactez votre admin.`,
      );
    }

    const amountPaid =
      tx.receivedAmount && Number(tx.receivedAmount) > 0
        ? Number(tx.receivedAmount)
        : Number(tx.amount);

    const agencyAvailable = Number(agencyWallet.balance) - Number(agencyWallet.reservedBalance);
    if (agencyAvailable < amountPaid) {
      throw new ForbiddenException(
        `Solde agence ${payoutCurrency} insuffisant (disponible: ${agencyAvailable}, requis: ${amountPaid})`,
      );
    }

    return this.prisma.$transaction(async (prismaTx) => {
      const updated = await prismaTx.transaction.updateMany({
        where: { id: tx.id, clientId, status: TransactionStatus.VALIDATED },
        data: {
          status: TransactionStatus.PAID,
          paidAt: new Date(),
          providerStatus: ProviderStatus.SUCCESS,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException('Transaction déjà traitée par un autre agent.');
      }

      await prismaTx.wallet.update({
        where: { id: agencyWallet.id },
        data: { balance: { decrement: new Prisma.Decimal(amountPaid) } },
      });

      await prismaTx.ledgerEntry.create({
        data: {
          walletId: agencyWallet.id,
          transactionId: tx.id,
          type: 'DEBIT',
          amount: new Prisma.Decimal(amountPaid),
          currency: agencyWallet.currency,
          description: `Paiement retrait ${cleanCode}`,
          balanceAfter: new Prisma.Decimal(Number(agencyWallet.balance) - amountPaid),
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

  // ========================================================
  // LECTURE
  // ========================================================

  async listMine(clientId: number, userId: string) {
    return this.prisma.withdrawal.findMany({
      where: { clientId, transaction: { senderId: userId } },
      orderBy: { requestedAt: 'desc' },
      include: { transaction: true },
    });
  }

  async adminListAll(clientId: number) {
    return this.prisma.withdrawal.findMany({
      where: { clientId },
      orderBy: { requestedAt: 'desc' },
      include: { transaction: { include: { sender: true, beneficiary: true } } },
    });
  }

  async adminUpdateStatus(
    clientId: number,
    adminId: string,
    id: string,
    dto: UpdateWithdrawalStatusDto,
  ) {
    return this.prisma.withdrawal.update({
      where: { id },
      data: { status: dto.status },
    });
  }
}