// apps/backend/src/withdrawals/withdrawals.service.ts
// =========================================================
// WITHDRAWALS SERVICE v4.2
// ✅ FIX CRITIQUE : agentProcessPayment — après le paiement,
//    CRÉDITER le wallet agence du montant de la commission
//    (avant : seul le débit était fait, jamais le crédit commissions)
// ✅ FIX : le débit agence est correct (l'agent remet du cash au client)
//    mais la commission doit être recréditée sur le même wallet
// ✅ Reste identique à v4.1 sinon
// =========================================================

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
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
import { WalletsService } from '../wallets/wallets.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { UpdateWithdrawalStatusDto } from './dto/update-withdrawal-status.dto';

// Taux de commission agent par défaut (40% des frais)
// Si des règles sont configurées dans CommissionConfig, elles prévalent
const DEFAULT_AGENT_COMMISSION_RATE = 0.40;

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

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
        tx.sender  = { ...tx.sender, firstName: parts[1], lastName: '(Client)' };
        tx.providerRef = parts[0];
      }
    }
    return tx;
  }

  // ========================================================
  // CRÉATION — Demande de retrait (CLIENT)
  // ========================================================

  async create(clientId: number, userId: string, dto: CreateWithdrawalDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // ─── RETRAIT PAR MONTANT ─────────────────────────────
    if (dto.amount) {
      const amount   = new Prisma.Decimal(dto.amount);
      const fees     = amount.mul(new Prisma.Decimal(0.015)); // 1.5% frais
      const total    = amount.plus(fees);
      const currency = user.primaryCurrency ?? 'XOF';

      const walletRef = await this.walletsService.getOrCreateWallet({ userId, currency });
      const walletRaw = await this.prisma.wallet.findUnique({ where: { id: walletRef.id } });
      if (!walletRaw) throw new NotFoundException('Wallet introuvable');

      const available = Number(walletRaw.balance) - Number(walletRaw.reservedBalance);
      if (available < Number(total)) {
        throw new BadRequestException(
          `Solde ${currency} insuffisant. Disponible : ${available}`,
        );
      }

      const withdrawalCode = Math.floor(
        100000000 + Math.random() * 900000000,
      ).toString();

      await this.walletsService.debit(
        walletRef.id,
        Number(total),
        `Demande retrait ${withdrawalCode}`,
      );

      return this.prisma.$transaction(async (tx) => {
        const txData: Prisma.TransactionUncheckedCreateInput = {
          reference:      `WD-${Date.now()}`,
          amount,
          fees,
          total,
          currency,
          status:         TransactionStatus.PENDING,
          payoutMethod:   PayoutMethod.CASH_PICKUP,
          paymentMethod:  PaymentMethod.WALLET,
          senderId:       userId,
          clientId,
          providerRef:    withdrawalCode,
          providerStatus: ProviderStatus.PENDING,
        };

        const transaction = await tx.transaction.create({ data: txData });

        return tx.withdrawal.create({
          data: {
            clientId,
            transactionId: transaction.id,
            method:        PayoutMethod.CASH_PICKUP,
            status:        WithdrawalStatus.PENDING,
          },
        });
      });
    }

    // ─── RETRAIT PAR TRANSACTION ID ──────────────────────
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
        method:        dto.method ?? tx.payoutMethod,
        status:        WithdrawalStatus.PENDING,
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
      valid:           true,
      amount:          richTx.amount,
      currency:        richTx.currency,
      receivedAmount:  richTx.receivedAmount,
      targetCurrency:  richTx.targetCurrency,
      senderName:      richTx.sender
        ? `${richTx.sender.firstName ?? ''} ${richTx.sender.lastName ?? ''}`.trim()
        : 'Client Inconnu',
      beneficiary:     richTx.beneficiary,
      transactionId:   richTx.id,
      status:          richTx.status,
      originCountry,
      reference:       richTx.reference,
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
      include: {
        withdrawal: true,
        sender: { include: { agency: true } },
      },
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
      where:   { id: agentId },
      include: { agency: true },
    });
    if (!agent || !agent.agencyId || !agent.agency) {
      throw new ForbiddenException('Agent sans agence');
    }

    // ─── Wallet agence ────────────────────────────────────
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
        `Wallet agence ${payoutCurrency} introuvable.`,
      );
    }

    // Montant à remettre au client
    const amountPaid =
      tx.receivedAmount && Number(tx.receivedAmount) > 0
        ? Number(tx.receivedAmount)
        : Number(tx.amount);


    // ─── Calcul commission ────────────────────────────────
    // L'agent qui remet le cash gagne une commission sur les frais
    const fees = Number(tx.fees ?? 0);
    const commissionAmount = fees > 0 ? fees * DEFAULT_AGENT_COMMISSION_RATE : 0;

    // Vérifier s'il y a une règle configurée pour cette agence
    let finalCommission = commissionAmount;
    try {
      const rule = await this.prisma.commissionConfig.findFirst({
        where: { clientId },
      });
      if (rule) {
        finalCommission = (fees * rule.payerShare) / 100;
      }
    } catch {
      // Fallback sur le taux par défaut
    }

    this.logger.log(
      `Paiement retrait ${cleanCode} — Agent: ${agentId} — Montant: ${amountPaid} ${payoutCurrency} — Commission: ${finalCommission}`,
    );

    return this.prisma.$transaction(async (prismaTx) => {

      // 1. Marquer la transaction comme PAID
      const updated = await prismaTx.transaction.updateMany({
        where: {
          id: tx.id,
          clientId,
          status: TransactionStatus.VALIDATED,
        },
        data: {
          status:         TransactionStatus.PAID,
          paidAt:         new Date(),
          providerStatus: ProviderStatus.SUCCESS,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException('Transaction déjà traitée par un autre agent.');
      }

      // 2. ✅ CRÉDIT agence — logique agent de transfert
      //    L'agent avance le cash physique au client.
      //    En échange, son wallet électronique est crédité du montant
      //    + sa part de commission.
      //    Exemple : solde 200 000, retrait 15 000, commission 90 XOF
      //    → nouveau solde = 200 000 + 15 000 + 90 = 215 090 XOF
      const totalCredit = amountPaid + finalCommission;

      await prismaTx.wallet.update({
        where: { id: agencyWallet.id },
        data:  { balance: { increment: new Prisma.Decimal(totalCredit) } },
      });

      // Ledger : une entrée CREDIT pour le montant remboursé
      await prismaTx.ledgerEntry.create({
        data: {
          walletId:      agencyWallet.id,
          transactionId: tx.id,
          type:          'CREDIT',
          amount:        new Prisma.Decimal(amountPaid),
          currency:      agencyWallet.currency,
          description:   `Remboursement retrait ${cleanCode} — cash remis au client`,
          balanceAfter:  new Prisma.Decimal(
            Number(agencyWallet.balance) + amountPaid,
          ),
        },
      });

      // Ledger : une entrée CREDIT séparée pour la commission
      if (finalCommission > 0) {
        await prismaTx.ledgerEntry.create({
          data: {
            walletId:      agencyWallet.id,
            transactionId: tx.id,
            type:          'CREDIT',
            amount:        new Prisma.Decimal(finalCommission),
            currency:      agencyWallet.currency,
            description:   `Commission retrait ${cleanCode} (${Math.round(DEFAULT_AGENT_COMMISSION_RATE * 100)}% des frais)`,
            balanceAfter:  new Prisma.Decimal(
              Number(agencyWallet.balance) + totalCredit,
            ),
          },
        });

        this.logger.log(
          `Commission créditée: ${finalCommission} ${agencyWallet.currency} → Agence ${agent.agencyId}`,
        );
      }

      // 4. Mettre à jour ou créer le withdrawal
      if (tx.withdrawal) {
        await prismaTx.withdrawal.update({
          where: { id: tx.withdrawal.id },
          data: {
            status:          WithdrawalStatus.PAID,
            processedById:   agentId,
            processedAt:     new Date(),
          },
        });
      } else {
        await prismaTx.withdrawal.create({
          data: {
            clientId,
            transactionId:   tx.id,
            method:          tx.payoutMethod,
            status:          WithdrawalStatus.PAID,
            processedById:   agentId,
            processedAt:     new Date(),
          },
        });
      }

      return {
        success:    true,
        message:    'Retrait validé avec succès.',
        commission: finalCommission,
        currency:   agencyWallet.currency,
      };
    });
  }

  // ========================================================
  // LECTURE
  // ========================================================

  async listMine(clientId: number, userId: string) {
    return this.prisma.withdrawal.findMany({
      where:     { clientId, transaction: { senderId: userId } },
      orderBy:   { requestedAt: 'desc' },
      include:   { transaction: true },
    });
  }

  async adminListAll(clientId: number) {
    return this.prisma.withdrawal.findMany({
      where:   { clientId },
      orderBy: { requestedAt: 'desc' },
      include: {
        transaction: { include: { sender: true, beneficiary: true } },
      },
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
      data:  { status: dto.status },
    });
  }
}