// apps/backend/src/withdrawals/withdrawals.service.ts
// =========================================================
// WITHDRAWALS SERVICE v4.7 — Direct Transf'air
// ✅ v4.3 : commission calculée sur fees convertis en devise payout
// ✅ v4.4 : Notifications in-app + emails
// ✅ v4.5 : listByAgent()
// ✅ v4.6 : FIX commission = 0 (mauvaise règle retournée par findFirst)
// ✅ v4.7 : DISTRIBUTION COMPLÈTE DES COMMISSIONS
//
//   Dès que le retrait est traité, 3 parts sont versées automatiquement :
//
//   ┌─────────────────────────────────────────────────────────┐
//   │  Part            │ Destinataire                         │
//   ├─────────────────────────────────────────────────────────│
//   │  payerShare  %   │ Wallet agence qui paye le cash       │
//   │  senderShare %   │ Wallet agence d'origine du client    │
//   │                  │  → company admin si pas d'agence     │
//   │                  │  → agence payeuse si même agence     │
//   │  platformShare % │ Wallet company admin (société)       │
//   └─────────────────────────────────────────────────────────┘
//
//   ⚠️  Les wallets clients (rôle CLIENT/WALLET) ne perçoivent
//       JAMAIS de commission — uniquement admins et agents.
//
//   Defaults si aucune règle configurée :
//     payerShare = 40%, senderShare = 20%, platformShare = 40%
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

import { PrismaService }  from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { RatesService }   from '../rates/rates.service';
import { CreateWithdrawalDto }       from './dto/create-withdrawal.dto';
import { UpdateWithdrawalStatusDto } from './dto/update-withdrawal-status.dto';

import { WalletNotifierService } from '../notifications/channels/wallet-notifier.service';
import { AgentNotifierService }  from '../notifications/channels/agent-notifier.service';
import { WalletMailService }     from '../mail/channels/wallet-mail.service';
import { AgentMailService }      from '../mail/channels/agent-mail.service';

// ── Defaults si aucune split rule configurée ──────────────
const DEFAULT_PAYER_SHARE    = 40; // % agence qui paye le cash
const DEFAULT_SENDER_SHARE   = 20; // % agence d'origine
const DEFAULT_PLATFORM_SHARE = 40; // % company admin

// ── Type interne pour la résolution des wallets ───────────
interface CommissionTarget {
  walletId:    string;
  amount:      number;
  currency:    string;
  description: string;
  balanceBefore: number;
}

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    private readonly prisma:         PrismaService,
    private readonly walletsService: WalletsService,
    private readonly ratesService:   RatesService,
    private readonly walletNotifier: WalletNotifierService,
    private readonly agentNotifier:  AgentNotifierService,
    private readonly walletMail:     WalletMailService,
    private readonly agentMail:      AgentMailService,
  ) {}

  // ── Enrichissement providerRef ────────────────────────────
  private enrichTransaction(tx: any) {
    if (!tx) return tx;
    if (
      tx.providerRef &&
      typeof tx.providerRef === 'string' &&
      tx.providerRef.includes('|')
    ) {
      const parts = tx.providerRef.split('|');
      if (parts.length >= 2) {
        tx.sender      = { ...tx.sender, firstName: parts[1], lastName: '(Client)' };
        tx.providerRef = parts[0];
      }
    }
    return tx;
  }

  // =========================================================
  // CRÉATION — Demande de retrait (CLIENT)
  // =========================================================

  async create(clientId: number, userId: string, dto: CreateWithdrawalDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // ── Chemin 1 : montant fourni → débit wallet + création transaction ──
    if (dto.amount) {
      const amount   = new Prisma.Decimal(dto.amount);
      const fees     = amount.mul(new Prisma.Decimal(0.015));
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

      const withdrawal = await this.prisma.$transaction(async (tx) => {
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

      this.walletNotifier.notifyWithdrawal(
        userId,
        `${Number(amount).toLocaleString('fr-FR')} ${currency}`,
      ).catch(() => {});

      if (user.email) {
        this.walletMail.sendWithdrawalRequested({
          email:     user.email,
          firstName: user.firstName ?? '',
          amount:    Number(amount),
          currency,
          code:      withdrawalCode,
          userId,
        }).catch((err) => {
          this.logger.warn(`Email retrait non envoyé : ${err?.message}`);
        });
      }

      return withdrawal;
    }

    // ── Chemin 2 : transactionId fourni ──────────────────────
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

  // =========================================================
  // AGENT — Vérifier un code de retrait
  // =========================================================

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
      valid:          true,
      amount:         richTx.amount,
      currency:       richTx.currency,
      receivedAmount: richTx.receivedAmount,
      targetCurrency: richTx.targetCurrency,
      senderName:     richTx.sender
        ? `${richTx.sender.firstName ?? ''} ${richTx.sender.lastName ?? ''}`.trim()
        : 'Client Inconnu',
      beneficiary:    richTx.beneficiary,
      transactionId:  richTx.id,
      status:         richTx.status,
      originCountry,
      reference:      richTx.reference,
    };
  }

  // =========================================================
  // AGENT — Valider un paiement (Cash-Out)
  // =========================================================

  async agentProcessPayment(clientId: number, agentId: string, code: string) {
    const cleanCode = String(code ?? '').trim();
    if (!cleanCode) throw new BadRequestException('Code requis');

    // ── Récupération transaction avec toutes les relations ──
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
        sender:     { include: { agency: true } },
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

    // ── Agent et son agence ───────────────────────────────
    const agent = await this.prisma.user.findUnique({
      where:   { id: agentId },
      include: { agency: true },
    });
    if (!agent || !agent.agencyId || !agent.agency) {
      throw new ForbiddenException('Agent sans agence');
    }

    // ── Wallet agence du payeur ───────────────────────────
    const payoutCurrency = tx.targetCurrency ?? tx.currency;

    const agencyWallets = await this.prisma.wallet.findMany({
      where: { agencyId: agent.agencyId, isActive: true },
    });
    const agencyWallet =
      agencyWallets.find((w) => w.currency === payoutCurrency) ??
      agencyWallets.find((w) => w.isDefault) ??
      agencyWallets[0];

    if (!agencyWallet) {
      throw new ForbiddenException(
        `Wallet agence ${payoutCurrency} introuvable.`,
      );
    }

    const amountPaid =
      tx.receivedAmount && Number(tx.receivedAmount) > 0
        ? Number(tx.receivedAmount)
        : Number(tx.amount);

    // ── Conversion des frais en devise payout (v4.3) ─────
    const rawFees = Number(tx.fees ?? 0);
    let feesInPayoutCurrency = rawFees;

    if (rawFees > 0 && tx.currency !== payoutCurrency) {
      try {
        feesInPayoutCurrency = await this.ratesService.convert(
          rawFees, tx.currency, payoutCurrency,
        );
        this.logger.log(
          `Conversion frais: ${rawFees} ${tx.currency} → ` +
          `${feesInPayoutCurrency.toFixed(4)} ${payoutCurrency}`,
        );
      } catch {
        feesInPayoutCurrency = 0;
        this.logger.warn(
          `Conversion frais impossible (${tx.currency}→${payoutCurrency}) — commissions = 0`,
        );
      }
    }

    // =======================================================
    // ✅ v4.7 — CALCUL DES 3 PARTS DE COMMISSION
    // =======================================================

    // ── 1. Lecture de la split rule (exclure les fee configs) ─
    // FIX v4.6 : payoutMethod: null → uniquement les règles de répartition
    // (sans ce filtre, findFirst retournait une fee config avec payerShare=0)
    let payerSharePct    = DEFAULT_PAYER_SHARE;
    let senderSharePct   = DEFAULT_SENDER_SHARE;
    let platformSharePct = DEFAULT_PLATFORM_SHARE;

    try {
      const splitRule = await this.prisma.commissionConfig.findFirst({
        where: {
          clientId,
          payoutMethod: null, // ← exclure les fee configs
        },
      });
      if (splitRule) {
        payerSharePct    = splitRule.payerShare;
        senderSharePct   = splitRule.senderShare;
        platformSharePct = splitRule.platformShare;
        this.logger.log(
          `Split rule trouvée — payer:${payerSharePct}% ` +
          `sender:${senderSharePct}% platform:${platformSharePct}%`,
        );
      } else {
        this.logger.log(
          `Aucune split rule → defaults ` +
          `payer:${payerSharePct}% sender:${senderSharePct}% platform:${platformSharePct}%`,
        );
      }
    } catch (e) {
      this.logger.warn(
        `Lecture split rule impossible — defaults appliqués : ${(e as any)?.message}`,
      );
    }

    // ── 2. Montants bruts ─────────────────────────────────
    const payerCommission    = feesInPayoutCurrency * payerSharePct    / 100;
    const senderCommission   = feesInPayoutCurrency * senderSharePct   / 100;
    const platformCommission = feesInPayoutCurrency * platformSharePct / 100;

    // ── 3. Résolution des destinataires ───────────────────
    //
    // Règles métier :
    //  - Wallet CLIENT → jamais de commission (uniquement admins et agents)
    //  - Agence d'envoi = agence de paiement → la même agence cumule les 2 parts
    //  - Client sans agence (wallet pur) → sa part (senderShare) va à la company
    //
    const senderAgencyId = (tx.sender as any)?.agencyId ?? null;
    const isSameAgency   = senderAgencyId && senderAgencyId === agent.agencyId;
    const senderIsClient = !senderAgencyId; // pas d'agence → client wallet

    // Part finale de l'agence payeuse
    let finalPayerCommission  = payerCommission;
    // Part finale de l'agence d'envoi
    let finalSenderCommission = senderCommission;
    // Part finale de la company (admin société)
    let finalPlatformCommission = platformCommission;

    if (senderIsClient) {
      // Client wallet sans agence → senderShare revient à la company
      finalPlatformCommission += senderCommission;
      finalSenderCommission    = 0;
      this.logger.log(
        `Sender = client wallet (pas d'agence) → ` +
        `senderShare (${senderCommission.toFixed(2)}) ajouté à platformCommission`,
      );
    } else if (isSameAgency) {
      // Même agence envoie et paye → cumul payer + sender
      finalPayerCommission  += senderCommission;
      finalSenderCommission  = 0;
      this.logger.log(
        `Même agence (envoi et paiement) → ` +
        `commission cumulée: ${finalPayerCommission.toFixed(2)} ${payoutCurrency}`,
      );
    }

    // ── 4. Wallet company admin ───────────────────────────
    let companyWallet: { id: string; balance: Prisma.Decimal } | null = null;
    if (finalPlatformCommission > 0) {
      try {
        companyWallet = await this.walletsService.getOrCreateWallet({
          clientId,
          currency: payoutCurrency,
        }) as any;
      } catch (e) {
        this.logger.warn(
          `Wallet company introuvable (clientId=${clientId}, ${payoutCurrency}) : ` +
          `${(e as any)?.message} — platformCommission non versée`,
        );
        finalPlatformCommission = 0;
      }
    }

    // ── 5. Wallet agence d'envoi (si différente) ─────────
    let senderAgencyWallet: { id: string; balance: Prisma.Decimal } | null = null;
    if (finalSenderCommission > 0 && senderAgencyId) {
      try {
        const senderWallets = await this.prisma.wallet.findMany({
          where: { agencyId: senderAgencyId, isActive: true },
        });
        senderAgencyWallet = (
          senderWallets.find((w) => w.currency === payoutCurrency) ??
          senderWallets.find((w) => (w as any).isDefault) ??
          senderWallets[0] ??
          null
        ) as any;

        if (!senderAgencyWallet) {
          // Wallet agence d'envoi introuvable → revient à la company
          this.logger.warn(
            `Wallet agence d'envoi ${senderAgencyId} introuvable ` +
            `→ senderShare revient à la company`,
          );
          if (companyWallet) {
            finalPlatformCommission += finalSenderCommission;
          }
          finalSenderCommission = 0;
        }
      } catch (e) {
        this.logger.warn(
          `Erreur récupération wallet agence d'envoi : ${(e as any)?.message}`,
        );
        finalSenderCommission = 0;
      }
    }

    // ── Récapitulatif avant transaction ───────────────────
    this.logger.log(
      `\n┌─── DISTRIBUTION COMMISSIONS — retrait ${cleanCode} ───────────────\n` +
      `│  Frais bruts : ${rawFees} ${tx.currency}\n` +
      `│  Frais convertis : ${feesInPayoutCurrency.toFixed(2)} ${payoutCurrency}\n` +
      `│  ── Parts ──\n` +
      `│  Agence payeuse (${agent.agency.name}) : ${finalPayerCommission.toFixed(2)} ${payoutCurrency}\n` +
      `│  Agence d'envoi (${senderAgencyId ?? 'aucune'}) : ${finalSenderCommission.toFixed(2)} ${payoutCurrency}\n` +
      `│  Company admin : ${finalPlatformCommission.toFixed(2)} ${payoutCurrency}\n` +
      `│  Montant cash remis : ${amountPaid} ${payoutCurrency}\n` +
      `└──────────────────────────────────────────────────────────────`,
    );

    // =======================================================
    // ✅ SECTION ATOMIQUE — tout ou rien
    // =======================================================

    const result = await this.prisma.$transaction(async (prismaTx) => {

      // ── Verrouillage optimiste : un seul agent peut traiter ──
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
        throw new ConflictException(
          'Transaction déjà traitée par un autre agent.',
        );
      }

      // ────────────────────────────────────────────────────
      // CRÉDIT 1 : Agence payeuse (remboursement cash + commission)
      // ────────────────────────────────────────────────────
      const totalPayerCredit = amountPaid + finalPayerCommission;

      await prismaTx.wallet.update({
        where: { id: agencyWallet.id },
        data:  { balance: { increment: new Prisma.Decimal(totalPayerCredit) } },
      });

      // Ledger — remboursement montant cash
      await prismaTx.ledgerEntry.create({
        data: {
          walletId:      agencyWallet.id,
          transactionId: tx.id,
          type:          'CREDIT',
          amount:        new Prisma.Decimal(amountPaid),
          currency:      agencyWallet.currency,
          description:   `Remboursement cash retrait ${cleanCode}`,
          balanceAfter:  new Prisma.Decimal(
            Number(agencyWallet.balance) + amountPaid,
          ),
        },
      });

      // Ledger — commission agence payeuse
      if (finalPayerCommission > 0) {
        await prismaTx.ledgerEntry.create({
          data: {
            walletId:      agencyWallet.id,
            transactionId: tx.id,
            type:          'CREDIT',
            amount:        new Prisma.Decimal(finalPayerCommission),
            currency:      agencyWallet.currency,
            description:   `Commission paiement ${cleanCode} (${payerSharePct}${isSameAgency ? `+${senderSharePct}` : ''}%)`,
            balanceAfter:  new Prisma.Decimal(
              Number(agencyWallet.balance) + totalPayerCredit,
            ),
          },
        });
      }

      // ────────────────────────────────────────────────────
      // CRÉDIT 2 : Agence d'envoi (si différente de la payeuse)
      // ────────────────────────────────────────────────────
      if (finalSenderCommission > 0 && senderAgencyWallet) {
        await prismaTx.wallet.update({
          where: { id: senderAgencyWallet.id },
          data:  { balance: { increment: new Prisma.Decimal(finalSenderCommission) } },
        });

        await prismaTx.ledgerEntry.create({
          data: {
            walletId:      senderAgencyWallet.id,
            transactionId: tx.id,
            type:          'CREDIT',
            amount:        new Prisma.Decimal(finalSenderCommission),
            currency:      payoutCurrency,
            description:   `Commission envoi ${cleanCode} (${senderSharePct}%)`,
            balanceAfter:  new Prisma.Decimal(
              Number(senderAgencyWallet.balance) + finalSenderCommission,
            ),
          },
        });
      }

      // ────────────────────────────────────────────────────
      // CRÉDIT 3 : Wallet company admin (part plateforme)
      // ────────────────────────────────────────────────────
      if (finalPlatformCommission > 0 && companyWallet) {
        await prismaTx.wallet.update({
          where: { id: companyWallet.id },
          data:  { balance: { increment: new Prisma.Decimal(finalPlatformCommission) } },
        });

        await prismaTx.ledgerEntry.create({
          data: {
            walletId:      companyWallet.id,
            transactionId: tx.id,
            type:          'CREDIT',
            amount:        new Prisma.Decimal(finalPlatformCommission),
            currency:      payoutCurrency,
            description:   `Commission plateforme ${cleanCode} (${platformSharePct}%${senderIsClient ? `+${senderSharePct}%↑client` : ''})`,
            balanceAfter:  new Prisma.Decimal(
              Number(companyWallet.balance) + finalPlatformCommission,
            ),
          },
        });
      }

      // ── Mise à jour du withdrawal ──────────────────────
      if (tx.withdrawal) {
        await prismaTx.withdrawal.update({
          where: { id: tx.withdrawal.id },
          data: {
            status:        WithdrawalStatus.PAID,
            processedById: agentId,
            processedAt:   new Date(),
          },
        });
      } else {
        await prismaTx.withdrawal.create({
          data: {
            clientId,
            transactionId: tx.id,
            method:        tx.payoutMethod,
            status:        WithdrawalStatus.PAID,
            processedById: agentId,
            processedAt:   new Date(),
          },
        });
      }

      return {
        success:              true,
        message:              'Retrait validé. Commissions distribuées.',
        currency:             payoutCurrency,
        amountPaid,
        feesConverted:        feesInPayoutCurrency,
        commissions: {
          payerAgency:      { amount: finalPayerCommission,    share: payerSharePct },
          senderAgency:     { amount: finalSenderCommission,   share: senderIsClient ? 0 : senderSharePct },
          companyAdmin:     { amount: finalPlatformCommission, share: platformSharePct + (senderIsClient ? senderSharePct : 0) },
        },
      };
    });

    // ── Notifications post-transaction (non-bloquant) ─────
    const agencyWalletUpdated = await this.prisma.wallet
      .findUnique({ where: { id: agencyWallet.id } })
      .catch(() => null);

    this.agentNotifier.notifyWithdrawalProcessed(
      agentId,
      `${amountPaid.toLocaleString('fr-FR')} ${payoutCurrency}`,
      `${finalPayerCommission.toFixed(0)} ${payoutCurrency}`,
    ).catch(() => {});

    if (agent.email) {
      this.agentMail.sendWithdrawalProcessed({
        email:      agent.email,
        agentName:  `${agent.firstName ?? ''} ${agent.lastName ?? ''}`.trim(),
        clientName: tx.sender
          ? `${(tx.sender as any).firstName ?? ''} ${(tx.sender as any).lastName ?? ''}`.trim()
          : 'Client',
        amount:     amountPaid,
        currency:   payoutCurrency,
        newBalance: Number(agencyWalletUpdated?.balance ?? agencyWallet.balance),
        code:       cleanCode,
        userId:     agentId,
      }).catch((err) => {
        this.logger.warn(`Email agent non envoyé : ${err?.message}`);
      });
    }

    return result;
  }

  // =========================================================
  // LECTURE
  // =========================================================

  async listMine(clientId: number, userId: string) {
    return this.prisma.withdrawal.findMany({
      where:   { clientId, transaction: { senderId: userId } },
      orderBy: { requestedAt: 'desc' },
      include: { transaction: true },
    });
  }

  async listByAgent(clientId: number, agentId: string) {
    return this.prisma.withdrawal.findMany({
      where:   { clientId, processedById: agentId },
      include: {
        transaction: { include: { sender: true, beneficiary: true } },
      },
      orderBy: { processedAt: 'desc' },
      take:    50,
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
    adminId:  string,
    id:       string,
    dto:      UpdateWithdrawalStatusDto,
  ) {
    return this.prisma.withdrawal.update({
      where: { id },
      data:  { status: dto.status },
    });
  }
}