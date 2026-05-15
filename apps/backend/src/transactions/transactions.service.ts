// apps/backend/src/transactions/transactions.service.ts
// =========================================================
// TRANSACTIONS SERVICE v4.2
// ✅ FIX refillAgency: débite wallet clientId (société) et non userId (vide)
// ✅ FIX: availableBalance lu depuis wallet Prisma
// ✅ FIX: debit/credit max 4 arguments
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
  ProviderStatus,
  Transaction,
  TransactionStatus,
  PayoutMethod,
  PaymentMethod,
  WithdrawalStatus,
  TransactionType,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../rates/rates.service';
import { WalletsService } from '../wallets/wallets.service';
import {
  CreateTransactionDto,
  CreateDepositDto,
} from './dto/create-transaction.dto';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';

import { WalletMailService } from '../mail/channels/wallet-mail.service';
import { AgentMailService } from '../mail/channels/agent-mail.service';
import { CompanyMailService } from '../mail/channels/company-mail.service';
import { AdminMailService } from '../mail/channels/admin-mail.service';
import { PushService } from '../push/push.service';
import { SmsService } from '../sms/sms.service';

// =========================================================
// CONSTANTS
// =========================================================

const TERMINAL_TX: TransactionStatus[] = [
  TransactionStatus.PAID,
  TransactionStatus.CANCELLED,
  TransactionStatus.FAILED,
  TransactionStatus.REFUNDED,
];

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  GN: 'GNF', SN: 'XOF', CI: 'XOF', ML: 'XOF', BF: 'XOF',
  BJ: 'XOF', TG: 'XOF', NE: 'XOF', GW: 'XOF',
  FR: 'EUR', DE: 'EUR', BE: 'EUR', PT: 'EUR', ES: 'EUR',
  GB: 'GBP', US: 'USD',
};

function getCurrencyFromCountryOrText(raw?: string | null): string {
  if (!raw) return 'XOF';
  const upper = raw.toUpperCase().trim();
  if (COUNTRY_TO_CURRENCY[upper]) return COUNTRY_TO_CURRENCY[upper];
  if (upper.includes('GUIN')) return 'GNF';
  if (['SENEGAL', 'MALI', 'BENIN', 'TOGO', "COTE D'IVOIRE"].some(c => upper.includes(c))) return 'XOF';
  if (upper.includes('FRANC') || upper === 'FR') return 'EUR';
  if (upper.includes('UK') || upper === 'GB') return 'GBP';
  if (upper.includes('USA') || upper === 'US') return 'USD';
  return 'XOF';
}

function assertTxTransition(from: TransactionStatus, to: TransactionStatus) {
  if (from === to) return;
  if (TERMINAL_TX.includes(from)) {
    throw new BadRequestException(`Transition interdite: ${from} -> ${to}`);
  }
  const allowed: Partial<Record<TransactionStatus, TransactionStatus[]>> = {
    PENDING: [TransactionStatus.VALIDATED, TransactionStatus.CANCELLED, TransactionStatus.FAILED],
    VALIDATED: [TransactionStatus.PAID, TransactionStatus.CANCELLED, TransactionStatus.FAILED],
    PROCESSING: [TransactionStatus.PAID, TransactionStatus.CANCELLED, TransactionStatus.FAILED],
  };
  if (!allowed[from]?.includes(to)) {
    throw new BadRequestException(`Transition interdite: ${from} -> ${to}`);
  }
}

// =========================================================
// HELPER — Lire le solde disponible d'un wallet depuis Prisma
// =========================================================

async function getWalletAvailable(
  prisma: PrismaService,
  walletId: string,
): Promise<{ id: string; balance: number; reservedBalance: number; availableBalance: number; currency: string }> {
  const w = await prisma.wallet.findUnique({ where: { id: walletId } });
  if (!w) throw new NotFoundException(`Wallet ${walletId} introuvable`);
  const bal = Number(w.balance);
  const res = Number(w.reservedBalance);
  return { id: w.id, currency: w.currency, balance: bal, reservedBalance: res, availableBalance: bal - res };
}

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ratesService: RatesService,
    private readonly walletsService: WalletsService,
    private readonly push: PushService,
    private readonly sms: SmsService,
    private readonly walletMail: WalletMailService,
    private readonly agentMail: AgentMailService,
    private readonly companyMail: CompanyMailService,
    private readonly adminMail: AdminMailService,
  ) {}

  // ========================================================
  // UTILITAIRE
  // ========================================================

  private enrichTransaction(tx: any): any {
    if (!tx) return tx;
    const cloned: any = { ...tx, sender: tx.sender ? { ...tx.sender } : tx.sender };
    const ref = cloned.providerRef;
    if (ref && typeof ref === 'string' && ref.includes('|')) {
      const parts = ref.split('|');
      if (parts.length >= 2) {
        cloned.sender = { ...cloned.sender, firstName: parts[1], lastName: '(Client)', agency: cloned.sender?.agency };
        cloned.providerRef = parts[0];
      }
    }
    return cloned;
  }

  // ========================================================
  // B2B — VIREMENT BANCAIRE
  // ========================================================

  async declareBankTransfer(adminId: string, amount: number, proofReference: string, currency: string = 'XOF') {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || !admin.clientId) throw new ForbiddenException('Admin société introuvable');

    const walletRef = await this.walletsService.getOrCreateWallet({ userId: adminId, currency });
    const wallet = await getWalletAvailable(this.prisma, walletRef.id);

    if (wallet.availableBalance < amount) {
      throw new ForbiddenException(`Solde ${currency} insuffisant pour effectuer ce virement.`);
    }

    const tx = await this.prisma.$transaction(async (prismaTx) => {
      return prismaTx.transaction.create({
        data: {
          reference: `BILL-${Date.now()}`,
          type: TransactionType.SERVICE_PAYMENT,
          amount: new Prisma.Decimal(amount),
          fees: new Prisma.Decimal(0),
          total: new Prisma.Decimal(amount),
          currency,
          status: TransactionStatus.PENDING,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          payoutMethod: PayoutMethod.WALLET,
          senderId: adminId,
          clientId: admin.clientId!,
          providerRef: proofReference,
        },
      });
    });

    await this.walletsService.debit(wallet.id, amount, `Virement B2B ${proofReference}`, tx.id);

    if (admin.email) {
      await this.companyMail.sendB2BRequestSent({
        email: admin.email,
        companyName: `${admin.firstName} ${admin.lastName}`,
        amount,
        currency,
        ref: proofReference,
      });
    }

    return tx;
  }

  async validateBankTransfer(superAdminId: string, transactionId: string) {
    const superAdmin = await this.prisma.user.findUnique({ where: { id: superAdminId } });
    if (superAdmin?.role !== 'SUPER_ADMIN') throw new ForbiddenException('Seul le Super Admin peut valider.');

    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx || tx.type !== TransactionType.SERVICE_PAYMENT) throw new NotFoundException('Facture introuvable');
    if (tx.status !== TransactionStatus.PENDING) throw new ConflictException('Transaction déjà traitée');

    const walletRef = await this.walletsService.getOrCreateWallet({ userId: superAdminId, currency: tx.currency });
    await this.walletsService.credit(walletRef.id, Number(tx.amount), `Validation B2B ${transactionId}`, transactionId);

    const result = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { status: TransactionStatus.PAID, paidAt: new Date(), providerStatus: ProviderStatus.SUCCESS },
    });

    const sender = await this.prisma.user.findUnique({ where: { id: tx.senderId } });
    if (sender?.email) {
      await this.companyMail.sendB2BValidated({
        email: sender.email,
        companyName: `${sender.firstName} ${sender.lastName}`,
        amount: Number(tx.amount),
        currency: tx.currency,
        ref: tx.providerRef ?? transactionId,
      });
    }
    await this.push.notifyTransferReceived(tx.senderId, 'Plateforme', `${tx.amount}`, tx.currency);
    return result;
  }

  async rejectBankTransfer(superAdminId: string, transactionId: string) {
    const superAdmin = await this.prisma.user.findUnique({ where: { id: superAdminId } });
    if (superAdmin?.role !== 'SUPER_ADMIN') throw new ForbiddenException('Accès refusé');

    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx || tx.status !== TransactionStatus.PENDING) throw new ConflictException('Impossible à rejeter');

    const walletRef = await this.walletsService.getOrCreateWallet({ userId: tx.senderId, currency: tx.currency });
    await this.walletsService.credit(walletRef.id, Number(tx.amount), `Remboursement B2B rejeté`, transactionId);

    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: { status: TransactionStatus.CANCELLED, cancelledAt: new Date(), providerStatus: ProviderStatus.FAILED },
    });
  }

  // ========================================================
  // ANNULATION
  // ========================================================

  async cancel(userId: string, transactionId: string): Promise<Transaction> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { sender: true },
    });
    if (!tx) throw new NotFoundException('Transaction introuvable');
    if (tx.senderId !== userId) throw new ForbiddenException('Vous ne pouvez annuler que vos propres transactions');
    if (tx.status === TransactionStatus.PAID) throw new ConflictException("Impossible : le client a déjà retiré l'argent");
    if (tx.status === TransactionStatus.CANCELLED) throw new ConflictException('Déjà annulée');

    const walletRef = await this.walletsService.getOrCreateWallet({ userId, currency: tx.currency });
    await this.walletsService.credit(walletRef.id, Number(tx.total), `Remboursement annulation ${tx.reference}`, transactionId);

    return this.prisma.$transaction(async (prismaTx) => {
      const updated = await prismaTx.transaction.update({
        where: { id: transactionId },
        data: { status: TransactionStatus.CANCELLED, cancelledAt: new Date(), providerStatus: ProviderStatus.CANCELLED },
      });
      await prismaTx.withdrawal.updateMany({
        where: { transactionId },
        data: { status: WithdrawalStatus.CANCELLED },
      });
      return updated;
    });
  }

  // ========================================================
  // CRÉATION TRANSACTION
  // ========================================================

  async create(senderId: string, dto: CreateTransactionDto): Promise<Transaction> {
    const user = await this.prisma.user.findUnique({
      where: { id: senderId },
      include: { wallets: { where: { isActive: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.clientId) throw new ForbiddenException('User must belong to a client');

    const clientId = user.clientId;

    const beneficiary = dto.beneficiaryId
      ? await this.prisma.beneficiary.findFirst({ where: { id: dto.beneficiaryId } })
      : null;

    if (dto.beneficiaryId && !beneficiary) throw new NotFoundException('Beneficiary not found');

    const currency = dto.currency;
    const userWallet = user.wallets.find((w) => w.currency === currency);
    if (!userWallet) {
      throw new ForbiddenException(`Vous n'avez pas de wallet ${currency}. Créez-en un d'abord.`);
    }

    const isWalletTransfer = dto.payoutMethod === PayoutMethod.MOBILE_MONEY || dto.payoutMethod === PayoutMethod.WALLET;
    const feeRate = isWalletTransfer ? 0 : 0.015;
    const amount = new Prisma.Decimal(dto.amount);
    const fees = amount.mul(new Prisma.Decimal(feeRate));
    const total = amount.plus(fees);

    const available = Number(userWallet.balance) - Number(userWallet.reservedBalance);
    if (available < Number(total)) {
      throw new ForbiddenException(`Solde ${currency} insuffisant. Disponible : ${available}`);
    }

    let recipientUser: any = null;
    if (isWalletTransfer && beneficiary?.phone) {
      const cleanPhone = beneficiary.phone.replace(/[^0-9]/g, '');
      recipientUser = await this.prisma.user.findFirst({
        where: { phone: { contains: cleanPhone }, clientId },
        include: { wallets: { where: { isActive: true } } },
      });
    }

    const targetCurrency = beneficiary?.country
      ? getCurrencyFromCountryOrText(beneficiary.country)
      : currency;

    const convertedAmount = await this.ratesService.convert(Number(amount), currency, targetCurrency);
    const receivedAmount = new Prisma.Decimal(convertedAmount);
    const exchangeRate = Number(amount) > 0 ? convertedAmount / Number(amount) : 1;

    const transactionRef = this.generateReference();
    let status: TransactionStatus = TransactionStatus.PENDING;
    let paidAt: Date | null = null;
    let storedRef: string | null = transactionRef;

    if (recipientUser) {
      status = TransactionStatus.PAID;
      paidAt = new Date();
    } else {
      const threshold = new Prisma.Decimal(500000);
      status = amount.lte(threshold) ? TransactionStatus.VALIDATED : TransactionStatus.PENDING;
      if (dto.senderFirstName) {
        storedRef = `${transactionRef}|${dto.senderFirstName} ${dto.senderLastName ?? ''}`;
      }
    }

    await this.walletsService.debit(userWallet.id, Number(total), `Envoi ${transactionRef}`);

    if (recipientUser) {
      const recipientWallet = recipientUser.wallets?.find((w: any) => w.currency === targetCurrency);
      if (recipientWallet) {
        await this.walletsService.credit(recipientWallet.id, convertedAmount, `Réception de ${user.firstName} ${user.lastName}`);
      }
    }

    const transaction = await this.prisma.transaction.create({
      data: {
        reference: transactionRef,
        amount,
        fees,
        total,
        currency,
        targetCurrency,
        receivedAmount,
        exchangeRate,
        payoutMethod: dto.payoutMethod ?? PayoutMethod.CASH_PICKUP,
        status,
        senderId,
        beneficiaryId: beneficiary?.id ?? null,
        recipientId: recipientUser?.id ?? null,
        clientId,
        providerRef: storedRef,
        providerStatus: recipientUser ? ProviderStatus.SUCCESS : ProviderStatus.PENDING,
        paidAt,
      },
    });

    await this.push.notifyTransferSent(senderId, beneficiary?.fullName ?? 'Bénéficiaire', `${amount}`, currency);

    if (recipientUser?.id) {
      await this.push.notifyTransferReceived(recipientUser.id, `${user.firstName} ${user.lastName}`, `${receivedAmount}`, targetCurrency);
    }

    return transaction;
  }

  // ========================================================
  // DÉPÔT AGENT
  // ========================================================

  async deposit(agentId: string, dto: CreateDepositDto): Promise<Transaction> {
    const agent = await this.prisma.user.findUnique({
      where: { id: agentId },
      include: { wallets: { where: { isActive: true } } },
    });

    if (!agent || !agent.agencyId) throw new ForbiddenException('Agent ou Agence invalide');
    if (!agent.clientId) throw new ForbiddenException('Agence sans client associé');

    const agencyWallets = await this.prisma.wallet.findMany({
      where: { agencyId: agent.agencyId, isActive: true },
    });
    const agencyWallet = agencyWallets[0];
    if (!agencyWallet) throw new ForbiddenException('Wallet agence introuvable');

    const amountDec = new Prisma.Decimal(dto.amount);
    const available = Number(agencyWallet.balance) - Number(agencyWallet.reservedBalance);
    if (available < Number(amountDec)) throw new ForbiddenException('Solde agence insuffisant');

    const cleanPhone = (dto.userPhone ?? '').replace(/[^0-9]/g, '');
    const clientUser = await this.prisma.user.findFirst({
      where: { phone: { contains: cleanPhone }, clientId: agent.clientId },
      include: { wallets: { where: { isActive: true } } },
    });
    if (!clientUser) throw new NotFoundException(`Client introuvable : ${dto.userPhone}`);

    const currency = agencyWallet.currency;
    const clientWalletRef = await this.walletsService.getOrCreateWallet({ userId: clientUser.id, currency });

    await this.walletsService.debit(agencyWallet.id, Number(amountDec), `Dépôt → ${clientUser.phone}`);
    await this.walletsService.credit(clientWalletRef.id, Number(amountDec), `Dépôt agent`);

    const result = await this.prisma.transaction.create({
      data: {
        reference: this.generateReference(),
        amount: amountDec,
        fees: new Prisma.Decimal(0),
        total: amountDec,
        currency,
        status: TransactionStatus.PAID,
        payoutMethod: PayoutMethod.WALLET,
        paymentMethod: PaymentMethod.CASH,
        senderId: agent.id,
        recipientId: clientUser.id,
        clientId: agent.clientId,
        paidAt: new Date(),
        providerStatus: ProviderStatus.SUCCESS,
        providerRef: `DEP-${Date.now()}`,
      },
    });

    await this.push.notifyTransferReceived(clientUser.id, 'Agence', `${dto.amount}`, currency);

    const updatedAgencyWallet = await this.prisma.wallet.findUnique({ where: { id: agencyWallet.id } });
    if (updatedAgencyWallet && Number(updatedAgencyWallet.balance) < 50000) {
      await this.push.notifyLowBalance(agentId, currency, `${updatedAgencyWallet.balance}`);
    }

    return result;
  }

  // ========================================================
  // TRÉSORERIE ADMIN
  // ========================================================

  async adminFundSelf(user: AuthUserPayload, amount: number | string) {
    if (!user?.id) throw new BadRequestException('Utilisateur invalide');
    return this.fundAdminWallet(user.id, amount);
  }

  async fundAdminWallet(adminId: string, amount: number | string, currency: string = 'XOF') {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) throw new BadRequestException('Montant invalide');

    const walletRef = await this.walletsService.getOrCreateWallet({ userId: adminId, currency });
    return this.walletsService.credit(walletRef.id, amt, `Auto-alimentation admin`);
  }

  // ========================================================
  // RECHARGE AGENCE — ✅ FIX : débite clientId, pas userId
  // ========================================================

  async refillAgency(adminId: string, agencyId: string, amount: number, currency: string = 'XOF') {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    if (!admin || !agency) throw new NotFoundException('Introuvable');
    if (!admin.clientId) throw new ForbiddenException('Admin sans société associée');

    // ✅ CORRECTION CLEF : wallet de la SOCIÉTÉ (clientId)
    // treasury/admin/inject crédite getOrCreateWallet({ clientId }) → même wallet ici
    const adminWalletRef = await this.walletsService.getOrCreateWallet({
      clientId: admin.clientId,
      currency,
    });
    const adminWallet = await getWalletAvailable(this.prisma, adminWalletRef.id);

    if (adminWallet.availableBalance < amount) {
      throw new ForbiddenException(
        `Solde ${currency} insuffisant. Disponible : ${adminWallet.availableBalance}`,
      );
    }

    const agencyWalletRef = await this.walletsService.getOrCreateWallet({ agencyId, currency });

    const txRef = `REFILL-${Date.now()}`;

    await this.prisma.$transaction(async () => {
      await this.walletsService.debit(adminWallet.id, amount, `Recharge agence ${agency.name}`, txRef);
      await this.walletsService.credit(agencyWalletRef.id, amount, `Recharge de l'admin`, txRef);
      await this.prisma.transaction.create({
        data: {
          reference: txRef,
          type: TransactionType.AGENCY_REFILL,
          amount: new Prisma.Decimal(amount),
          fees: new Prisma.Decimal(0),
          total: new Prisma.Decimal(amount),
          currency,
          status: TransactionStatus.PAID,
          payoutMethod: PayoutMethod.BANK_DEPOSIT,
          senderId: adminId,
          clientId: admin.clientId!,
          paidAt: new Date(),
        },
      });
    });

    return { status: 'SUCCESS', sent: amount, currency };
  }

  // ========================================================
  // LECTURE
  // ========================================================

  async findForUser(userId: string): Promise<any[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, clientId: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const clientFilter = user.role === 'SUPER_ADMIN' ? {} : { clientId: user.clientId ?? -1 };

    const transactions = await this.prisma.transaction.findMany({
      where: {
        ...clientFilter,
        OR: [{ senderId: userId }, { recipientId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        withdrawal: true,
        sender: { select: { id: true, firstName: true, lastName: true, phone: true } },
        beneficiary: true,
      },
    });

    return transactions.map((t) => this.enrichTransaction(t));
  }

  async findOneForUser(id: string, userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, clientId: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const clientFilter = user.role === 'SUPER_ADMIN' ? {} : { clientId: user.clientId ?? -1 };

    const tx = await this.prisma.transaction.findFirst({
      where: {
        ...clientFilter,
        id,
        OR: [{ senderId: userId }, { recipientId: userId }],
      },
      include: {
        withdrawal: true,
        sender: { select: { id: true, firstName: true, lastName: true, phone: true } },
        beneficiary: true,
      },
    });

    if (!tx) throw new NotFoundException('Transaction not found');
    return this.enrichTransaction(tx);
  }

  async adminFindAllForAdmin(adminId: string): Promise<any[]> {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    let transactions: any[] = [];

    if (admin?.role === 'SUPER_ADMIN') {
      transactions = await this.prisma.transaction.findMany({
        orderBy: { createdAt: 'desc' },
        include: { sender: true, beneficiary: true, client: true, withdrawal: true },
      });
    } else if (admin?.clientId) {
      transactions = await this.prisma.transaction.findMany({
        where: { clientId: admin.clientId },
        orderBy: { createdAt: 'desc' },
        include: { sender: true, beneficiary: true, client: true, withdrawal: true },
      });
    }

    return transactions.map((t) => this.enrichTransaction(t));
  }

  async adminUpdateStatusForAdmin(adminId: string, id: string, dto: UpdateTransactionStatusDto): Promise<Transaction> {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin) throw new ForbiddenException('Utilisateur inconnu');

    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException('Transaction not found');

    if (admin.role !== 'SUPER_ADMIN' && tx.clientId !== admin.clientId) {
      throw new ForbiddenException('Accès refusé à cette transaction.');
    }

    assertTxTransition(tx.status, dto.status);

    if (dto.status === TransactionStatus.CANCELLED) {
      const walletRef = await this.walletsService.getOrCreateWallet({ userId: tx.senderId, currency: tx.currency });
      await this.walletsService.credit(walletRef.id, Number(tx.total), `Remboursement annulation admin ${tx.reference}`, id);

      return this.prisma.$transaction(async (prismaTx) => {
        const updated = await prismaTx.transaction.update({
          where: { id },
          data: { status: TransactionStatus.CANCELLED, cancelledAt: new Date(), providerStatus: ProviderStatus.CANCELLED },
        });
        await prismaTx.withdrawal.updateMany({
          where: { transactionId: id },
          data: { status: WithdrawalStatus.CANCELLED },
        });
        return updated;
      });
    }

    const data: Prisma.TransactionUpdateInput =
      dto.status === TransactionStatus.PAID
        ? { status: TransactionStatus.PAID, paidAt: new Date(), providerStatus: ProviderStatus.SUCCESS }
        : { status: dto.status };

    return this.prisma.transaction.update({ where: { id }, data });
  }

  private generateReference(): string {
    return Math.floor(100000000 + Math.random() * 900000000).toString();
  }
}