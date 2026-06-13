// apps/backend/src/transactions/transactions.service.ts
// =========================================================
// TRANSACTIONS SERVICE v4.15 — Direct Transf'air
// =========================================================
// ✅ v4.12 : FIX ForbiddenException dans $transaction → 500
// ✅ v4.13-A : FIX acquireAdvisoryLock int32 signé (| 0)
// ✅ v4.13-B : FIX P2002 référence en doublon → 409
// ✅ v4.13-C : Notifications in-app + emails sur tous les flux
// ✅ v4.14 : FUSION complète en un seul fichier
//
// ✅ v4.15 : FIX CRITIQUE acquireAdvisoryLock
//   PROBLÈME : le driver `pg` (node-postgres) encode TOUJOURS les
//   integers JS en int8 (bigint 64 bits) vers PostgreSQL,
//   quelle que soit la valeur réelle ou le | 0 appliqué en JS.
//   → pg_advisory_xact_lock(int4, int4) ne trouve aucune surcharge
//     correspondant à (int8, int8) → "function does not exist" → 500
//
//   CAUSE PROFONDE DU | 0 INSUFFISANT :
//   | 0 en JS garantit que la valeur tient en int32 SIGNÉ (plage
//   [-2^31 ; 2^31-1]), mais n'affecte pas le OID de type envoyé
//   sur le fil TCP : le driver envoie toujours TypeOID=20 (int8)
//   au lieu de TypeOID=23 (int4). PostgreSQL ne trouve donc pas
//   la surcharge pg_advisory_xact_lock(int4, int4).
//
//   CORRECTIF : cast explicite ::int4 dans la requête SQL.
//   PostgreSQL applique une coercition int8→int4 explicite,
//   trouve la bonne surcharge, et l'appel réussit.
//   Les valeurs tiennent dans int4 grâce au | 0 (conservé).
// =========================================================

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CurrencyCode,
  Prisma,
  ProviderStatus,
  Transaction,
  TransactionStatus,
  PayoutMethod,
  PaymentMethod,
  WithdrawalStatus,
  TransactionType,
} from '@prisma/client';

import { PrismaService }  from '../prisma/prisma.service';
import { RatesService }   from '../rates/rates.service';
import { WalletsService } from '../wallets/wallets.service';
import {
  CreateTransactionDto,
  CreateDepositDto,
} from './dto/create-transaction.dto';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';

// ── Mail channels ─────────────────────────────────────────
import { WalletMailService }  from '../mail/channels/wallet-mail.service';
import { AgentMailService }   from '../mail/channels/agent-mail.service';
import { CompanyMailService } from '../mail/channels/company-mail.service';
import { AdminMailService }   from '../mail/channels/admin-mail.service';
import { PushService }        from '../push/push.service';
import { SmsService }         from '../sms/sms.service';

// ── Notifiers in-app ──────────────────────────────────────
import { NotificationsService }   from '../notifications/notifications.service';
import { WalletNotifierService }  from '../notifications/channels/wallet-notifier.service';
import { AgentNotifierService }   from '../notifications/channels/agent-notifier.service';
import { CompanyNotifierService } from '../notifications/channels/company-notifier.service';
import { AdminNotifierService }   from '../notifications/channels/admin-notifier.service';

// ── Constantes ────────────────────────────────────────────

const TERMINAL_TX: TransactionStatus[] = [
  TransactionStatus.PAID,
  TransactionStatus.CANCELLED,
  TransactionStatus.FAILED,
  TransactionStatus.REFUNDED,
];

const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  GN: CurrencyCode.GNF,
  SN: CurrencyCode.XOF, CI: CurrencyCode.XOF, ML: CurrencyCode.XOF,
  BF: CurrencyCode.XOF, BJ: CurrencyCode.XOF, TG: CurrencyCode.XOF,
  NE: CurrencyCode.XOF, GW: CurrencyCode.XOF,
  FR: CurrencyCode.EUR, DE: CurrencyCode.EUR, BE: CurrencyCode.EUR,
  PT: CurrencyCode.EUR, ES: CurrencyCode.EUR,
  GB: CurrencyCode.GBP,
  US: CurrencyCode.USD,
};

function getCurrencyFromCountryOrText(raw?: string | null): CurrencyCode {
  if (!raw) return CurrencyCode.XOF;
  const upper = raw.toUpperCase().trim();
  if (COUNTRY_TO_CURRENCY[upper]) return COUNTRY_TO_CURRENCY[upper];
  if (upper.includes('GUIN')) return CurrencyCode.GNF;
  if (['SENEGAL', 'MALI', 'BENIN', 'TOGO', "COTE D'IVOIRE"].some(c => upper.includes(c))) return CurrencyCode.XOF;
  if (upper.includes('FRANC') || upper === 'FR') return CurrencyCode.EUR;
  if (upper.includes('UK') || upper === 'GB') return CurrencyCode.GBP;
  if (upper.includes('USA') || upper === 'US') return CurrencyCode.USD;
  return CurrencyCode.XOF;
}

function assertTxTransition(from: TransactionStatus, to: TransactionStatus) {
  if (from === to) return;
  if (TERMINAL_TX.includes(from)) {
    throw new BadRequestException(`Transition interdite: ${from} -> ${to}`);
  }
  const allowed: Partial<Record<TransactionStatus, TransactionStatus[]>> = {
    PENDING:    [TransactionStatus.VALIDATED, TransactionStatus.CANCELLED, TransactionStatus.FAILED],
    VALIDATED:  [TransactionStatus.PAID,      TransactionStatus.CANCELLED, TransactionStatus.FAILED],
    PROCESSING: [TransactionStatus.PAID,      TransactionStatus.CANCELLED, TransactionStatus.FAILED],
  };
  if (!allowed[from]?.includes(to)) {
    throw new BadRequestException(`Transition interdite: ${from} -> ${to}`);
  }
}

// Codes internes pour exceptions lancées DANS $transaction
// → jamais de HttpException à l'intérieur, converties après
const TX_ERROR = {
  WALLET_NOT_FOUND:            'TX_ERR_WALLET_NOT_FOUND',
  INSUFFICIENT_BALANCE_PREFIX: 'TX_ERR_INSUFFICIENT_BALANCE:',
} as const;

// ── Service ───────────────────────────────────────────────

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly prisma:               PrismaService,
    private readonly ratesService:         RatesService,
    private readonly walletsService:       WalletsService,
    private readonly push:                 PushService,
    private readonly sms:                  SmsService,
    // Mail channels
    private readonly walletMail:           WalletMailService,
    private readonly agentMail:            AgentMailService,
    private readonly companyMail:          CompanyMailService,
    private readonly adminMail:            AdminMailService,
    // Notifiers in-app
    private readonly notificationsService: NotificationsService,
    private readonly walletNotifier:       WalletNotifierService,
    private readonly agentNotifier:        AgentNotifierService,
    private readonly companyNotifier:      CompanyNotifierService,
    private readonly adminNotifier:        AdminNotifierService,
  ) {}

  // ── Enrichissement ────────────────────────────────────

  private enrichTransaction(tx: any): any {
    if (!tx) return tx;
    const cloned: any = { ...tx, sender: tx.sender ? { ...tx.sender } : tx.sender };
    const ref = cloned.providerRef;
    if (cloned.type === 'AGENCY_REFILL') return cloned;
    if (ref && typeof ref === 'string' && ref.includes('|')) {
      const parts = ref.split('|');
      if (parts.length >= 2) {
        cloned.sender = {
          ...cloned.sender,
          firstName: parts[1],
          lastName:  '(Client)',
          agency:    cloned.sender?.agency,
        };
        cloned.providerRef = parts[0];
      }
    }
    return cloned;
  }

  // ── Advisory lock key ─────────────────────────────────

  private walletLockKey(id: string): bigint {
    let hash = 0n;
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31n + BigInt(id.charCodeAt(i))) & 0x7FFFFFFFFFFFFFFFn;
    }
    return hash;
  }

  // ── Advisory lock ─────────────────────────────────────
  //
  // ✅ FIX v4.15 : ::int4 dans le SQL (v4.13-A avec | 0 était insuffisant)
  //
  // Le driver node-postgres envoie toujours les integers JS avec
  // TypeOID=20 (int8/bigint) sur le fil, indépendamment de leur valeur.
  // pg_advisory_xact_lock(int4, int4) exige TypeOID=23 ou une coercition
  // explicite. Sans ::int4, PostgreSQL ne trouve aucune surcharge → 500.
  //
  // Le | 0 est conservé pour garantir que les valeurs tiennent en int4.
  // Le ::int4 dans le SQL force la coercition côté PostgreSQL.
  private async acquireAdvisoryLock(
    prismaTx: Prisma.TransactionClient,
    walletId: string,
  ): Promise<void> {
    const lockKey  = this.walletLockKey(walletId);
    // | 0 : garantit que la valeur est dans la plage int32 signé
    const lockHigh = (Number((lockKey >> 32n) & 0xFFFFFFFFn)) | 0;
    const lockLow  = (Number(lockKey & 0xFFFFFFFFn)) | 0;

    // ✅ FIX v4.15 : ::int4 — force la coercition int8→int4 côté PostgreSQL
    await prismaTx.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock($1::int4, $2::int4)',
      lockHigh,
      lockLow,
    );
  }

  // ========================================================
  // B2B — Déclaration virement société → SuperAdmin
  // ========================================================

  async declareBankTransfer(
    adminId: string,
    amount: number,
    proofReference: string,
    currency: string = 'XOF',
  ) {
    const currencyCode = currency.toUpperCase() as CurrencyCode;

    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || !admin.clientId) throw new ForbiddenException('Admin société introuvable');

    const walletRef = await this.walletsService.getOrCreateWallet({
      clientId: admin.clientId,
      currency: currencyCode,
    });

    // ✅ FIX v4.12 — Vérification solde AVANT $transaction
    const preCheckWallet = await this.prisma.wallet.findUnique({
      where: { id: walletRef.id },
    });

    if (!preCheckWallet) throw new NotFoundException('Wallet société introuvable');

    const preAvailable =
      Number(preCheckWallet.balance) - Number(preCheckWallet.reservedBalance ?? 0);

    if (preAvailable < amount) {
      throw new ForbiddenException(
        `Solde ${currencyCode} insuffisant. ` +
        `Disponible : ${preAvailable.toLocaleString('fr-FR')} ${currencyCode}. ` +
        `Alimentez d'abord votre compte via Trésorerie > Alimenter en ${currencyCode}.`,
      );
    }

    // Section atomique — aucune HttpException à l'intérieur
    let newTx: Transaction;
    try {
      newTx = await this.prisma.$transaction(async (prismaTx) => {
        await this.acquireAdvisoryLock(prismaTx, walletRef.id);

        const wallet = await prismaTx.wallet.findUnique({ where: { id: walletRef.id } });
        if (!wallet) throw new Error(TX_ERROR.WALLET_NOT_FOUND);

        const available =
          Number(wallet.balance) - Number(wallet.reservedBalance ?? 0);

        if (available < amount) {
          throw new Error(
            `${TX_ERROR.INSUFFICIENT_BALANCE_PREFIX}${available}:${currencyCode}`,
          );
        }

        const reference = `BILL-${Date.now()}`;

        const created = await prismaTx.transaction.create({
          data: {
            reference,
            type:          TransactionType.SERVICE_PAYMENT,
            amount:        new Prisma.Decimal(amount),
            fees:          new Prisma.Decimal(0),
            total:         new Prisma.Decimal(amount),
            currency:      currencyCode,
            status:        TransactionStatus.PENDING,
            paymentMethod: PaymentMethod.BANK_TRANSFER,
            payoutMethod:  PayoutMethod.WALLET,
            senderId:      adminId,
            clientId:      admin.clientId!,
            providerRef:   proofReference,
          },
        });

        const updatedWallet = await prismaTx.wallet.update({
          where: { id: walletRef.id },
          data:  { balance: { decrement: new Prisma.Decimal(amount) } },
        });

        await prismaTx.ledgerEntry.create({
          data: {
            walletId:      walletRef.id,
            type:          'DEBIT',
            amount:        new Prisma.Decimal(amount),
            currency:      currencyCode,
            description:   `Virement B2B ${proofReference}`,
            transactionId: created.id,
            balanceAfter:  updatedWallet.balance,
          },
        });

        return created;
      });

    } catch (e: any) {
      const msg: string = e?.message ?? '';

      if (msg === TX_ERROR.WALLET_NOT_FOUND) {
        throw new NotFoundException('Wallet société introuvable');
      }
      if (msg.startsWith(TX_ERROR.INSUFFICIENT_BALANCE_PREFIX)) {
        const parts = msg.replace(TX_ERROR.INSUFFICIENT_BALANCE_PREFIX, '').split(':');
        const avail = Number(parts[0]);
        const cur   = parts[1] ?? currencyCode;
        throw new ForbiddenException(
          `Solde insuffisant (concurrence détectée). ` +
          `Disponible : ${avail.toLocaleString('fr-FR')} ${cur}.`,
        );
      }
      // ✅ FIX v4.13-B : P2002 → référence déjà utilisée → 409
      if (e?.code === 'P2002' || msg.toLowerCase().includes('unique constraint')) {
        throw new ConflictException(
          `La référence "${proofReference}" est déjà utilisée. ` +
          `Veuillez saisir une référence bancaire différente.`,
        );
      }
      throw e;
    }

    // ── Notifications + emails (non-bloquants) ────────────

    if (admin.email) {
      this.companyMail.sendB2BRequestSent({
        email:       admin.email,
        companyName: `${admin.firstName} ${admin.lastName}`,
        amount,
        currency:    currencyCode,
        ref:         proofReference,
      }).catch((err) => {
        this.logger.warn(`Email B2B declare non envoyé : ${err?.message}`);
      });
    }

    this.companyNotifier.notifyB2BTransferSent(
      adminId,
      `${amount.toLocaleString('fr-FR')} ${currencyCode}`,
    ).catch(() => {});

    this.prisma.user.findFirst({
      where:  { role: 'SUPER_ADMIN' },
      select: { id: true },
    }).then((superAdmin) => {
      if (superAdmin) {
        this.adminNotifier.notifyNewB2BRequest(
          superAdmin.id,
          `${admin.firstName ?? ''} ${admin.lastName ?? ''}`.trim(),
          `${amount.toLocaleString('fr-FR')} ${currencyCode}`,
          newTx.id,
        ).catch(() => {});
      }
    }).catch(() => {});

    return newTx;
  }

  // ========================================================
  // B2B — Validation par Super Admin
  // ========================================================

  async validateBankTransfer(superAdminId: string, transactionId: string) {
    const superAdmin = await this.prisma.user.findUnique({ where: { id: superAdminId } });
    if (superAdmin?.role !== 'SUPER_ADMIN') throw new ForbiddenException('Seul le Super Admin peut valider.');

    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx || tx.type !== TransactionType.SERVICE_PAYMENT) throw new NotFoundException('Facture introuvable');
    if (tx.status !== TransactionStatus.PENDING) throw new ConflictException('Transaction déjà traitée');

    const walletRef = await this.walletsService.getOrCreateWallet({
      clientId: superAdmin.clientId!,
      currency: tx.currency,
    });
    await this.walletsService.credit(
      walletRef.id,
      Number(tx.amount),
      `Validation B2B ${transactionId}`,
      transactionId,
    );

    const result = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status:         TransactionStatus.PAID,
        paidAt:         new Date(),
        providerStatus: ProviderStatus.SUCCESS,
      },
    });

    this.prisma.user.findUnique({ where: { id: tx.senderId } })
      .then((sender) => {
        if (sender?.email) {
          this.companyMail.sendB2BValidated({
            email:       sender.email,
            companyName: `${sender.firstName} ${sender.lastName}`,
            amount:      Number(tx.amount),
            currency:    tx.currency,
            ref:         tx.providerRef ?? transactionId,
          }).catch((err) => {
            this.logger.warn(`Email B2B validé non envoyé : ${err?.message}`);
          });
        }
      })
      .catch(() => {});

    this.push.notifyTransferReceived(
      tx.senderId, 'Plateforme', `${tx.amount}`, tx.currency,
    ).catch(() => {});

    this.companyNotifier.notifyB2BTransferValidated(
      tx.senderId,
      `${Number(tx.amount).toLocaleString('fr-FR')} ${tx.currency}`,
    ).catch(() => {});

    return result;
  }

  // ========================================================
  // B2B — Rejet par Super Admin
  // ========================================================

  async rejectBankTransfer(superAdminId: string, transactionId: string) {
    const superAdmin = await this.prisma.user.findUnique({ where: { id: superAdminId } });
    if (superAdmin?.role !== 'SUPER_ADMIN') throw new ForbiddenException('Accès refusé');

    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx || tx.status !== TransactionStatus.PENDING) throw new ConflictException('Impossible à rejeter');

    const walletRef = await this.walletsService.getOrCreateWallet({
      userId:   tx.senderId,
      currency: tx.currency,
    });
    await this.walletsService.credit(
      walletRef.id,
      Number(tx.amount),
      `Remboursement B2B rejeté`,
      transactionId,
    );

    const result = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status:         TransactionStatus.CANCELLED,
        cancelledAt:    new Date(),
        providerStatus: ProviderStatus.FAILED,
      },
    });

    this.push.notifyTransferReceived(
      tx.senderId, 'Plateforme', `${tx.amount}`, tx.currency,
    ).catch(() => {});

    this.companyNotifier.notifyB2BRejected(
      tx.senderId,
      `${Number(tx.amount).toLocaleString('fr-FR')} ${tx.currency}`,
    ).catch(() => {});

    this.prisma.user.findUnique({ where: { id: tx.senderId } })
      .then((sender) => {
        if (sender?.email) {
          this.companyMail.sendB2BRejected({
            email:       sender.email,
            companyName: `${sender.firstName ?? ''} ${sender.lastName ?? ''}`.trim(),
            amount:      Number(tx.amount),
            currency:    tx.currency,
            ref:         tx.providerRef ?? transactionId,
            userId:      sender.id,
          }).catch((err) => {
            this.logger.warn(`Email B2B rejeté non envoyé : ${err?.message}`);
          });
        }
      })
      .catch(() => {});

    return result;
  }

  // ========================================================
  // Annulation client
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
        data:  {
          status:         TransactionStatus.CANCELLED,
          cancelledAt:    new Date(),
          providerStatus: ProviderStatus.CANCELLED,
        },
      });
      await prismaTx.withdrawal.updateMany({
        where: { transactionId },
        data:  { status: WithdrawalStatus.CANCELLED },
      });
      return updated;
    });
  }

 // ========================================================
  // Création transfert (client → bénéficiaire)
  // ========================================================

  async create(senderId: string, dto: CreateTransactionDto): Promise<Transaction> {
    const user = await this.prisma.user.findUnique({
      where:   { id: senderId },
      include: { wallets: { where: { isActive: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.clientId) throw new ForbiddenException('User must belong to a client');

    const clientId = user.clientId;

    const beneficiary = dto.beneficiaryId
      ? await this.prisma.beneficiary.findFirst({ where: { id: dto.beneficiaryId } })
      : null;

    if (dto.beneficiaryId && !beneficiary) throw new NotFoundException('Beneficiary not found');

    const currency   = dto.currency.toUpperCase() as CurrencyCode;
    const userWallet = user.wallets.find((w) => w.currency === currency);
    if (!userWallet) {
      throw new ForbiddenException(`Vous n'avez pas de wallet ${currency}. Créez-en un d'abord.`);
    }

    const isWalletTransfer =
      dto.payoutMethod === PayoutMethod.MOBILE_MONEY ||
      dto.payoutMethod === PayoutMethod.WALLET;

    // ✅ v4.16 : taux dynamique configuré par l'admin via fees.tsx
    //   Avant : hardcodé à 0.015 (1.5%) pour tout le monde
    //   Après : lu depuis commission_configs (payoutMethod IS SET)
    //   Fallback : 1.5% si aucune config admin en base
    let feeRatePct  = 0;
    let fixedFeeAmt = 0;

    if (!isWalletTransfer) {
      try {
        const feeConfig = await this.prisma.commissionConfig.findFirst({
          where: {
            clientId,
            payoutMethod: dto.payoutMethod ?? 'CASH_PICKUP',
            isActive: true,
          },
        });
        if (feeConfig) {
          feeRatePct  = (feeConfig as any).feeRate  ?? 1.5;
          fixedFeeAmt = (feeConfig as any).fixedFee ?? 0;
        } else {
          feeRatePct = 1.5; // fallback si l'admin n'a pas encore configuré
        }
      } catch {
        feeRatePct = 1.5; // fallback si la migration n'est pas encore appliquée
      }
    }

    const amount = new Prisma.Decimal(dto.amount);
    const fees   = amount
      .mul(new Prisma.Decimal(feeRatePct / 100))
      .plus(new Prisma.Decimal(fixedFeeAmt));
    const total  = amount.plus(fees);

    const available = Number(userWallet.balance) - Number(userWallet.reservedBalance);
    if (available < Number(total)) {
      throw new ForbiddenException(`Solde ${currency} insuffisant. Disponible : ${available}`);
    }

    let recipientUser: any = null;
    if (isWalletTransfer && beneficiary?.phone) {
      const cleanPhone = beneficiary.phone.replace(/[^0-9]/g, '');
      recipientUser = await this.prisma.user.findFirst({
        where:   { phone: { contains: cleanPhone }, clientId },
        include: { wallets: { where: { isActive: true } } },
      });
    }

    const targetCurrency: CurrencyCode = beneficiary?.country
      ? getCurrencyFromCountryOrText(beneficiary.country)
      : currency;

    const convertedAmount = await this.ratesService.convert(Number(amount), currency, targetCurrency);
    const receivedAmount  = new Prisma.Decimal(convertedAmount);
    const exchangeRate    = Number(amount) > 0 ? convertedAmount / Number(amount) : 1;

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
      const recipientWalletRef = await this.walletsService.getOrCreateWallet({
        userId:   recipientUser.id,
        currency: targetCurrency,
      });
      await this.walletsService.credit(
        recipientWalletRef.id,
        convertedAmount,
        `Réception de ${user.firstName} ${user.lastName}`,
      );
    }

    const transaction = await this.prisma.transaction.create({
      data: {
        reference:      transactionRef,
        amount, fees, total,
        currency,
        targetCurrency,
        receivedAmount,
        exchangeRate,
        payoutMethod:   dto.payoutMethod ?? PayoutMethod.CASH_PICKUP,
        status,
        senderId,
        beneficiaryId:  beneficiary?.id ?? null,
        recipientId:    recipientUser?.id ?? null,
        clientId,
        providerRef:    storedRef,
        providerStatus: recipientUser ? ProviderStatus.SUCCESS : ProviderStatus.PENDING,
        paidAt,
      },
    });

    await this.push.notifyTransferSent(senderId, beneficiary?.fullName ?? 'Bénéficiaire', `${amount}`, currency);
    if (recipientUser?.id) {
      await this.push.notifyTransferReceived(
        recipientUser.id,
        `${user.firstName} ${user.lastName}`,
        `${receivedAmount}`,
        targetCurrency,
      );
    }

    const recipientDisplayName = beneficiary?.fullName ??
      (recipientUser
        ? `${recipientUser.firstName ?? ''} ${recipientUser.lastName ?? ''}`.trim()
        : 'Bénéficiaire');

    this.walletNotifier.notifyTransferSent(
      senderId,
      recipientDisplayName,
      `${Number(amount).toLocaleString('fr-FR')} ${currency}`,
    ).catch(() => {});

    if (recipientUser?.id) {
      this.walletNotifier.notifyTransferReceived(
        recipientUser.id,
        `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        `${Number(receivedAmount).toLocaleString('fr-FR')} ${targetCurrency}`,
      ).catch(() => {});
    }

    if (user.email) {
      this.walletMail.sendTransferConfirmation({
        email:           user.email,
        senderFirstName: user.firstName ?? '',
        recipientName:   recipientDisplayName,
        amount:          Number(amount),
        currency,
        fees:            Number(fees),
        txRef:           transactionRef,
        pickupCode:      recipientUser ? undefined : transactionRef,
        userId:          senderId,
        transactionId:   transaction.id,
      }).catch((err) => {
        this.logger.warn(`Email transfert non envoyé : ${err?.message}`);
      });
    }

    if (recipientUser?.email) {
      this.walletMail.sendMoneyReceived({
        email:              recipientUser.email,
        recipientFirstName: recipientUser.firstName ?? '',
        senderName:         `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        amount:             Number(receivedAmount),
        currency:           targetCurrency,
        txRef:              transactionRef,
        userId:             recipientUser.id,
        transactionId:      transaction.id,
      }).catch((err) => {
        this.logger.warn(`Email réception non envoyé : ${err?.message}`);
      });
    }

    return transaction;
  }
  // Dépôt agent → client
  // ========================================================

  async deposit(agentId: string, dto: CreateDepositDto): Promise<Transaction> {
    const agent = await this.prisma.user.findUnique({
      where:   { id: agentId },
      include: { wallets: { where: { isActive: true } } },
    });

    if (!agent || !agent.agencyId) throw new ForbiddenException('Agent ou Agence invalide');
    if (!agent.clientId)           throw new ForbiddenException('Agence sans client associé');

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
      where:   { phone: { contains: cleanPhone }, clientId: agent.clientId },
      include: { wallets: { where: { isActive: true } } },
    });
    if (!clientUser) throw new NotFoundException(`Client introuvable : ${dto.userPhone}`);

    const currency        = agencyWallet.currency as CurrencyCode;
    const clientWalletRef = await this.walletsService.getOrCreateWallet({ userId: clientUser.id, currency });

    await this.walletsService.debit(agencyWallet.id, Number(amountDec), `Dépôt → ${clientUser.phone}`);
    await this.walletsService.credit(clientWalletRef.id, Number(amountDec), `Dépôt agent`);

    const result = await this.prisma.transaction.create({
      data: {
        reference:      this.generateReference(),
        amount:         amountDec,
        fees:           new Prisma.Decimal(0),
        total:          amountDec,
        currency,
        status:         TransactionStatus.PAID,
        payoutMethod:   PayoutMethod.WALLET,
        paymentMethod:  PaymentMethod.CASH,
        senderId:       agent.id,
        recipientId:    clientUser.id,
        clientId:       agent.clientId,
        paidAt:         new Date(),
        providerStatus: ProviderStatus.SUCCESS,
        providerRef:    `DEP-${Date.now()}`,
      },
    });

    await this.push.notifyTransferReceived(clientUser.id, 'Agence', `${dto.amount}`, currency);

    const updatedAgencyWallet = await this.prisma.wallet.findUnique({ where: { id: agencyWallet.id } });
    if (updatedAgencyWallet && Number(updatedAgencyWallet.balance) < 50000) {
      await this.push.notifyLowBalance(agentId, currency, `${updatedAgencyWallet.balance}`);
      this.agentNotifier.notifyLowBalance(agentId, Number(updatedAgencyWallet.balance)).catch(() => {});
    }

    this.walletNotifier.notifyDepositReceived(
      clientUser.id,
      `${Number(dto.amount).toLocaleString('fr-FR')} ${currency}`,
    ).catch(() => {});

    this.agentNotifier.notifyDepositProcessed(
      agentId,
      `${Number(dto.amount).toLocaleString('fr-FR')} ${currency}`,
      `${clientUser.firstName ?? ''} ${clientUser.lastName ?? ''}`.trim(),
    ).catch(() => {});

    if (clientUser.email) {
      this.walletMail.sendMoneyReceived({
        email:              clientUser.email,
        recipientFirstName: clientUser.firstName ?? '',
        senderName:         'Agence',
        amount:             Number(dto.amount),
        currency,
        txRef:              result.reference,
        userId:             clientUser.id,
        transactionId:      result.id,
      }).catch((err) => {
        this.logger.warn(`Email dépôt client non envoyé : ${err?.message}`);
      });
    }

    if (agent.email) {
      this.agentMail.sendDepositSummary({
        email:       agent.email,
        agentName:   `${agent.firstName ?? ''} ${agent.lastName ?? ''}`.trim(),
        clientName:  `${clientUser.firstName ?? ''} ${clientUser.lastName ?? ''}`.trim(),
        amount:      Number(dto.amount),
        currency,
        newBalance:  Number(updatedAgencyWallet?.balance ?? agencyWallet.balance),
        userId:      agentId,
      }).catch((err) => {
        this.logger.warn(`Email dépôt agent non envoyé : ${err?.message}`);
      });
    }

    return result;
  }

  // ========================================================
  // Trésorerie Admin
  // ========================================================

  async adminFundSelf(user: AuthUserPayload, amount: number | string) {
    if (!user?.id) throw new BadRequestException('Utilisateur invalide');
    return this.fundAdminWallet(user.id, amount);
  }

  async fundAdminWallet(adminId: string, amount: number | string, currency: string = 'XOF') {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) throw new BadRequestException('Montant invalide');
    const currencyCode = currency.toUpperCase() as CurrencyCode;
    const walletRef    = await this.walletsService.getOrCreateWallet({ userId: adminId, currency: currencyCode });
    return this.walletsService.credit(walletRef.id, amt, `Auto-alimentation admin`);
  }

  // ========================================================
  // Recharge agence
  // ========================================================

  async refillAgency(adminId: string, agencyId: string, amount: number, currency: string = 'XOF') {
    this.logger.debug(`refillAgency START | adminId=${adminId} agencyId=${agencyId} amount=${amount} currency=${currency}`);

    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin)          throw new NotFoundException('Admin introuvable');
    if (!admin.clientId) throw new ForbiddenException('Admin sans société associée');

    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new NotFoundException(`Agence ${agencyId} introuvable`);

    if (admin.role !== 'SUPER_ADMIN' && agency.clientId !== admin.clientId) {
      throw new ForbiddenException('Cette agence ne vous appartient pas');
    }

    const currencyCode   = currency.toUpperCase() as CurrencyCode;
    const adminWalletRef = await this.walletsService.getOrCreateWallet({
      clientId: admin.clientId,
      currency: currencyCode,
    });

    const adminWallet = await this.prisma.wallet.findUnique({ where: { id: adminWalletRef.id } });
    if (!adminWallet) {
      throw new NotFoundException(`Wallet société (clientId=${admin.clientId}, ${currencyCode}) introuvable`);
    }

    const available = Number(adminWallet.balance) - Number(adminWallet.reservedBalance ?? 0);

    if (available < amount) {
      throw new ForbiddenException(
        `Solde ${currencyCode} insuffisant. ` +
        `Disponible : ${available.toLocaleString('fr-FR')} ${currencyCode} — ` +
        `Demandé : ${amount.toLocaleString('fr-FR')} ${currencyCode}. ` +
        `Rechargez d'abord votre compte via Trésorerie > Recharger.`,
      );
    }

    const agencyWalletRef = await this.walletsService.getOrCreateWallet({ agencyId, currency: currencyCode });

    await this.walletsService.debit(adminWallet.id, amount, `Recharge agence ${agency.name} (${agencyId})`);
    await this.walletsService.credit(agencyWalletRef.id, amount, `Recharge admin → ${agency.name}`);

    const txRef = `REFILL-${Date.now()}`;

    await this.prisma.transaction.create({
      data: {
        reference:      txRef,
        type:           TransactionType.AGENCY_REFILL,
        amount:         new Prisma.Decimal(amount),
        fees:           new Prisma.Decimal(0),
        total:          new Prisma.Decimal(amount),
        currency:       currencyCode,
        status:         TransactionStatus.PAID,
        payoutMethod:   PayoutMethod.BANK_DEPOSIT,
        paymentMethod:  PaymentMethod.WALLET,
        senderId:       adminId,
        clientId:       admin.clientId!,
        paidAt:         new Date(),
        providerStatus: ProviderStatus.SUCCESS,
        providerRef:    `${txRef}|AGENCY:${agencyId}`,
      },
    });

    const successResult = {
      status: 'SUCCESS', sent: amount, currency: currencyCode, agencyId, txRef,
      agencyWalletId: agencyWalletRef.id,
    };

    this.prisma.user.findMany({
      where:  { agencyId, role: 'AGENT' },
      select: { id: true, email: true, firstName: true, lastName: true },
    }).then(async (agents) => {
      const agencyWalletUpdated = await this.prisma.wallet.findUnique({
        where: { id: agencyWalletRef.id },
      }).catch(() => null);

      for (const agent of agents) {
        this.notificationsService.create(
          agent.id,
          'Rechargement reçu 🔋',
          `Votre agence a été rechargée de ${amount.toLocaleString('fr-FR')} ${currencyCode}.`,
          'SUCCESS',
        ).catch(() => {});

        if (agent.email) {
          this.agentMail.sendAgencyRefilled({
            email:      agent.email,
            agentName:  `${agent.firstName ?? ''} ${agent.lastName ?? ''}`.trim(),
            agencyName: agency.name,
            amount,
            currency:   currencyCode,
            newBalance: Number(agencyWalletUpdated?.balance ?? amount),
            userId:     agent.id,
          }).catch(() => {});
        }
      }
    }).catch(() => {});

    return successResult;
  }

  // ========================================================
  // Lecture
  // ========================================================

  private async buildUserTransactionFilter(userId: string): Promise<{
    where: Prisma.TransactionWhereInput;
    user: { id: string; role: string; clientId: number | null; agencyId: string | null };
  }> {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, role: true, clientId: true, agencyId: true },
    });
    if (!user) throw new NotFoundException('User not found');

    if (user.role === 'SUPER_ADMIN') return { where: {}, user };

    if (user.role === 'COMPANY_ADMIN') {
      return { where: { clientId: user.clientId ?? -1 }, user };
    }

    if (user.role === 'AGENT') {
      const processedWithdrawals = await this.prisma.withdrawal.findMany({
        where:  { processedById: userId },
        select: { transactionId: true },
      });
      const processedTxIds = processedWithdrawals
        .filter((w) => w.transactionId != null)
        .map((w)  => w.transactionId as string);

      const orClauses: Prisma.TransactionWhereInput[] = [
        { senderId:    userId },
        { recipientId: userId },
      ];

      if (user.agencyId) {
        orClauses.push({
          type:        TransactionType.AGENCY_REFILL,
          providerRef: { contains: user.agencyId },
        });
      }

      if (processedTxIds.length > 0) {
        orClauses.push({ id: { in: processedTxIds } });
      }

      return { where: { clientId: user.clientId ?? -1, OR: orClauses }, user };
    }

    return {
      where: {
        clientId: user.clientId ?? -1,
        OR: [{ senderId: userId }, { recipientId: userId }],
      },
      user,
    };
  }

  async findForUser(userId: string): Promise<any[]> {
    const { where } = await this.buildUserTransactionFilter(userId);
    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        withdrawal:  true,
        sender:      { select: { id: true, firstName: true, lastName: true, phone: true } },
        beneficiary: true,
      },
    });
    return transactions.map((t) => this.enrichTransaction(t));
  }

  async findOneForUser(id: string, userId: string): Promise<any> {
    const { where } = await this.buildUserTransactionFilter(userId);
    const tx = await this.prisma.transaction.findFirst({
      where: { ...where, id },
      include: {
        withdrawal:  true,
        sender:      { select: { id: true, firstName: true, lastName: true, phone: true } },
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
        where:   { clientId: admin.clientId },
        orderBy: { createdAt: 'desc' },
        include: { sender: true, beneficiary: true, client: true, withdrawal: true },
      });
    }

    return transactions.map((t) => this.enrichTransaction(t));
  }

  async adminUpdateStatusForAdmin(
    adminId: string,
    id: string,
    dto: UpdateTransactionStatusDto,
  ): Promise<Transaction> {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin) throw new ForbiddenException('Utilisateur inconnu');

    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException('Transaction not found');

    if (admin.role !== 'SUPER_ADMIN' && tx.clientId !== admin.clientId) {
      throw new ForbiddenException('Accès refusé à cette transaction.');
    }

    assertTxTransition(tx.status, dto.status);

    if (dto.status === TransactionStatus.CANCELLED) {
      const walletRef = await this.walletsService.getOrCreateWallet({
        userId:   tx.senderId,
        currency: tx.currency,
      });
      await this.walletsService.credit(
        walletRef.id,
        Number(tx.total),
        `Remboursement annulation admin ${tx.reference}`,
        id,
      );

      return this.prisma.$transaction(async (prismaTx) => {
        const updated = await prismaTx.transaction.update({
          where: { id },
          data: {
            status:         TransactionStatus.CANCELLED,
            cancelledAt:    new Date(),
            providerStatus: ProviderStatus.CANCELLED,
          },
        });
        await prismaTx.withdrawal.updateMany({
          where: { transactionId: id },
          data:  { status: WithdrawalStatus.CANCELLED },
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