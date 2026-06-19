// apps/backend/src/withdrawals/withdrawals.service.ts
// =========================================================
// WITHDRAWALS SERVICE v4.9 — Direct Transf'air
// ✅ v4.3 : commission calculée sur fees convertis en devise payout
// ✅ v4.4 : Notifications in-app + emails
// ✅ v4.5 : listByAgent()
// ✅ v4.6 : FIX commission = 0 (mauvaise règle retournée par findFirst)
// ✅ v4.7 : DISTRIBUTION COMPLÈTE DES COMMISSIONS
//   Dès que le retrait est traité, 3 parts sont versées automatiquement :
//   ┌────────────────────────────────────────────────────────┐
//   │  Part           │ Destinataire                         │
//   ├────────────────────────────────────────────────────────│
//   │  payerShare %   │ Wallet agence qui paye le cash       │
//   │  senderShare %  │ Wallet agence d'origine du client    │
//   │                 │  → company admin si pas d'agence     │
//   │                 │  → agence payeuse si même agence     │
//   │  platformShare% │ Wallet company admin (société)       │
//   └────────────────────────────────────────────────────────┘
// ✅ v4.8 : NOTIFICATIONS COMPLÈTES
//   Ajouts dans agentProcessPayment() — tout en .catch(() => {})
//   pour ne jamais bloquer le flux de paiement :
//
//   ① Notification client expéditeur (tx.senderId) :
//      "Le cash a été retiré par [bénéficiaire]" via
//      walletNotifier.notifyTransferSent() avec mention du retrait.
//      + email walletMail si senderId a un email (requête async).
//
//   ② Notification agence d'envoi (si différente de l'agence payeuse)
//      quand finalSenderCommission > 0 → agentNotifier sur le
//      premier agent trouvé dans l'agence expéditrice.
//
//   ③ Alerte solde faible : si balance agence payeuse < 50 000
//      après paiement → agentNotifier.notifyLowBalance().
//
//   Ajout dans create() :
//   ④ Notification in-app walletNotifier.notifyCodeReady() quand
//      le code de retrait est généré (en plus de l'email existant).
//
// ✅ v4.9 : FIX TS5076 — "Les opérations '??' et '||' ne peuvent pas
//   être mélangées sans parenthèses" (ligne ~546, calcul de
//   beneficiaryName dans agentProcessPayment()).
//   → Le nom complet du sender (firstName + lastName trim) est
//   maintenant calculé dans une variable intermédiaire
//   `senderFullName`, puis utilisé comme fallback via un seul
//   opérateur `??`. Logique identique, juste rendue explicite
//   pour satisfaire TypeScript.
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
const DEFAULT_PAYER_SHARE    = 40;
const DEFAULT_SENDER_SHARE   = 20;
const DEFAULT_PLATFORM_SHARE = 40;

// Seuil d'alerte solde faible agence (en devise payout)
const LOW_BALANCE_THRESHOLD = 50_000;

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

      // ── Notification in-app ──────────────────────────────
      // ✅ v4.8 ① : notifyCodeReady dès la création du code
      this.walletNotifier.notifyCodeReady(
        userId,
        'votre bénéficiaire',
        `${Number(amount).toLocaleString('fr-FR')} ${currency}`,
        withdrawalCode,
      ).catch(() => {});

      // ── Email ────────────────────────────────────────────
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

    // ── Récupération transaction ──────────────────────────
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
        withdrawal:  true,
        sender:      { include: { agency: true } },
        beneficiary: true,
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

    // ── Agent et agence ───────────────────────────────────
    const agent = await this.prisma.user.findUnique({
      where:   { id: agentId },
      include: { agency: true },
    });
    if (!agent || !agent.agencyId || !agent.agency) {
      throw new ForbiddenException('Agent sans agence');
    }

    const payoutCurrency = tx.targetCurrency ?? tx.currency;

    const agencyWallets = await this.prisma.wallet.findMany({
      where: { agencyId: agent.agencyId, isActive: true },
    });
    const agencyWallet =
      agencyWallets.find((w) => w.currency === payoutCurrency) ??
      agencyWallets.find((w) => w.isDefault) ??
      agencyWallets[0];

    if (!agencyWallet) {
      throw new ForbiddenException(`Wallet agence ${payoutCurrency} introuvable.`);
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

    // ── Calcul split rule ─────────────────────────────────
    let payerSharePct    = DEFAULT_PAYER_SHARE;
    let senderSharePct   = DEFAULT_SENDER_SHARE;
    let platformSharePct = DEFAULT_PLATFORM_SHARE;

    try {
      const splitRule = await this.prisma.commissionConfig.findFirst({
        where: { clientId, payoutMethod: null },
      });
      if (splitRule) {
        payerSharePct    = splitRule.payerShare;
        senderSharePct   = splitRule.senderShare;
        platformSharePct = splitRule.platformShare;
      }
    } catch (e) {
      this.logger.warn(`Split rule indisponible — defaults : ${(e as any)?.message}`);
    }

    // ── Montants bruts ────────────────────────────────────
    const payerCommission    = feesInPayoutCurrency * payerSharePct    / 100;
    const senderCommission   = feesInPayoutCurrency * senderSharePct   / 100;
    const platformCommission = feesInPayoutCurrency * platformSharePct / 100;

    // ── Résolution destinataires ──────────────────────────
    const senderAgencyId = (tx.sender as any)?.agencyId ?? null;
    const isSameAgency   = senderAgencyId && senderAgencyId === agent.agencyId;
    const senderIsClient = !senderAgencyId;

    let finalPayerCommission    = payerCommission;
    let finalSenderCommission   = senderCommission;
    let finalPlatformCommission = platformCommission;

    if (senderIsClient) {
      finalPlatformCommission += senderCommission;
      finalSenderCommission    = 0;
    } else if (isSameAgency) {
      finalPayerCommission  += senderCommission;
      finalSenderCommission  = 0;
    }

    // ── Wallet company admin ──────────────────────────────
    let companyWallet: { id: string; balance: Prisma.Decimal } | null = null;
    if (finalPlatformCommission > 0) {
      try {
        companyWallet = await this.walletsService.getOrCreateWallet({
          clientId, currency: payoutCurrency,
        }) as any;
      } catch (e) {
        this.logger.warn(`Wallet company introuvable : ${(e as any)?.message}`);
        finalPlatformCommission = 0;
      }
    }

    // ── Wallet agence d'envoi ─────────────────────────────
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
          this.logger.warn(`Wallet agence envoi ${senderAgencyId} introuvable → revient company`);
          if (companyWallet) finalPlatformCommission += finalSenderCommission;
          finalSenderCommission = 0;
        }
      } catch (e) {
        this.logger.warn(`Erreur wallet agence envoi : ${(e as any)?.message}`);
        finalSenderCommission = 0;
      }
    }

    this.logger.log(
      `\n┌─── DISTRIBUTION COMMISSIONS — retrait ${cleanCode} ───────────────\n` +
      `│  Frais bruts : ${rawFees} ${tx.currency}\n` +
      `│  Frais convertis : ${feesInPayoutCurrency.toFixed(2)} ${payoutCurrency}\n` +
      `│  Agence payeuse : ${finalPayerCommission.toFixed(2)} ${payoutCurrency}\n` +
      `│  Agence d'envoi : ${finalSenderCommission.toFixed(2)} ${payoutCurrency}\n` +
      `│  Company admin  : ${finalPlatformCommission.toFixed(2)} ${payoutCurrency}\n` +
      `│  Cash remis     : ${amountPaid} ${payoutCurrency}\n` +
      `└──────────────────────────────────────────────────────────────`,
    );

    // ── Transaction atomique ──────────────────────────────
    const result = await this.prisma.$transaction(async (prismaTx) => {

      // Verrouillage optimiste
      const updated = await prismaTx.transaction.updateMany({
        where: { id: tx.id, clientId, status: TransactionStatus.VALIDATED },
        data:  { status: TransactionStatus.PAID, paidAt: new Date(), providerStatus: ProviderStatus.SUCCESS },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Transaction déjà traitée par un autre agent.');
      }

      // ── CRÉDIT 1 : Agence payeuse (cash + commission) ──
      const totalPayerCredit = amountPaid + finalPayerCommission;
      await prismaTx.wallet.update({
        where: { id: agencyWallet.id },
        data:  { balance: { increment: new Prisma.Decimal(totalPayerCredit) } },
      });
      await prismaTx.ledgerEntry.create({
        data: {
          walletId: agencyWallet.id, transactionId: tx.id, type: 'CREDIT',
          amount: new Prisma.Decimal(amountPaid), currency: agencyWallet.currency,
          description: `Remboursement cash retrait ${cleanCode}`,
          balanceAfter: new Prisma.Decimal(Number(agencyWallet.balance) + amountPaid),
        },
      });
      if (finalPayerCommission > 0) {
        await prismaTx.ledgerEntry.create({
          data: {
            walletId: agencyWallet.id, transactionId: tx.id, type: 'CREDIT',
            amount: new Prisma.Decimal(finalPayerCommission), currency: agencyWallet.currency,
            description: `Commission paiement ${cleanCode} (${payerSharePct}${isSameAgency ? `+${senderSharePct}` : ''}%)`,
            balanceAfter: new Prisma.Decimal(Number(agencyWallet.balance) + totalPayerCredit),
          },
        });
      }

      // ── CRÉDIT 2 : Agence d'envoi (si différente) ──────
      if (finalSenderCommission > 0 && senderAgencyWallet) {
        await prismaTx.wallet.update({
          where: { id: senderAgencyWallet.id },
          data:  { balance: { increment: new Prisma.Decimal(finalSenderCommission) } },
        });
        await prismaTx.ledgerEntry.create({
          data: {
            walletId: senderAgencyWallet.id, transactionId: tx.id, type: 'CREDIT',
            amount: new Prisma.Decimal(finalSenderCommission), currency: payoutCurrency,
            description: `Commission envoi ${cleanCode} (${senderSharePct}%)`,
            balanceAfter: new Prisma.Decimal(Number(senderAgencyWallet.balance) + finalSenderCommission),
          },
        });
      }

      // ── CRÉDIT 3 : Company admin (plateforme) ───────────
      if (finalPlatformCommission > 0 && companyWallet) {
        await prismaTx.wallet.update({
          where: { id: companyWallet.id },
          data:  { balance: { increment: new Prisma.Decimal(finalPlatformCommission) } },
        });
        await prismaTx.ledgerEntry.create({
          data: {
            walletId: companyWallet.id, transactionId: tx.id, type: 'CREDIT',
            amount: new Prisma.Decimal(finalPlatformCommission), currency: payoutCurrency,
            description: `Commission plateforme ${cleanCode} (${platformSharePct}%${senderIsClient ? `+${senderSharePct}%↑client` : ''})`,
            balanceAfter: new Prisma.Decimal(Number(companyWallet.balance) + finalPlatformCommission),
          },
        });
      }

      // ── Withdrawal ──────────────────────────────────────
      if (tx.withdrawal) {
        await prismaTx.withdrawal.update({
          where: { id: tx.withdrawal.id },
          data:  { status: WithdrawalStatus.PAID, processedById: agentId, processedAt: new Date() },
        });
      } else {
        await prismaTx.withdrawal.create({
          data: {
            clientId, transactionId: tx.id, method: tx.payoutMethod,
            status: WithdrawalStatus.PAID, processedById: agentId, processedAt: new Date(),
          },
        });
      }

      return {
        success: true,
        message: 'Retrait validé. Commissions distribuées.',
        currency: payoutCurrency,
        amountPaid,
        feesConverted: feesInPayoutCurrency,
        commissions: {
          payerAgency:  { amount: finalPayerCommission,   share: payerSharePct },
          senderAgency: { amount: finalSenderCommission,  share: senderIsClient ? 0 : senderSharePct },
          companyAdmin: { amount: finalPlatformCommission, share: platformSharePct + (senderIsClient ? senderSharePct : 0) },
        },
      };
    });

    // =========================================================
    // ✅ v4.8 — NOTIFICATIONS POST-TRANSACTION (non-bloquant)
    // =========================================================

    // Lecture du nouveau solde agence (pour les alertes)
    const agencyWalletUpdated = await this.prisma.wallet
      .findUnique({ where: { id: agencyWallet.id } })
      .catch(() => null);

    // ✅ v4.9 : nom complet du sender calculé séparément pour éviter
    // le mélange '??' / '||' (TS5076). Un seul '??' final.
    const senderFullName =
      `${(tx.sender as any)?.firstName ?? ''} ${(tx.sender as any)?.lastName ?? ''}`.trim();

    const beneficiaryName =
      (tx as any).beneficiary?.fullName ??
      (senderFullName || 'Le bénéficiaire');

    // ── ① Notifier l'expéditeur (client) que le cash a été retiré ──
    if (tx.senderId) {
      this.walletNotifier.notifyTransferSent(
        tx.senderId,
        `${beneficiaryName} (retrait validé ✓)`,
        `${amountPaid.toLocaleString('fr-FR')} ${payoutCurrency}`,
        cleanCode,
      ).catch(() => {});

      // Email de confirmation au client expéditeur (async, non-bloquant)
      this.prisma.user
        .findUnique({ where: { id: tx.senderId }, select: { email: true, firstName: true } })
        .then((sender) => {
          if (sender?.email) {
            this.walletMail.sendMoneyReceived({
              email:              sender.email,
              recipientFirstName: sender.firstName ?? '',
              senderName:         `Agence ${agent.agency?.name ?? ''} (${agent.firstName ?? ''})`,
              amount:             amountPaid,
              currency:           payoutCurrency,
              txRef:              cleanCode,
              userId:             tx.senderId!,
              transactionId:      tx.id,
            }).catch((err) => {
              this.logger.warn(`Email confirmation retrait client non envoyé : ${err?.message}`);
            });
          }
        })
        .catch(() => {});
    }

    // ── ② Notifier l'agence d'envoi (si différente + commission > 0) ──
    if (finalSenderCommission > 0 && senderAgencyId && !isSameAgency) {
      this.prisma.user
        .findFirst({
          where:  { agencyId: senderAgencyId, role: 'AGENT', isActive: true },
          select: { id: true },
        })
        .then((senderAgent) => {
          if (senderAgent) {
            this.agentNotifier.notifyWithdrawalProcessed(
              senderAgent.id,
              `${finalSenderCommission.toFixed(0)} ${payoutCurrency}`,
              `${finalSenderCommission.toFixed(0)} ${payoutCurrency}`,
            ).catch(() => {});
          }
        })
        .catch(() => {});
    }

    // ── ③ Notification agent (commission reçue) ─────────
    this.agentNotifier.notifyWithdrawalProcessed(
      agentId,
      `${amountPaid.toLocaleString('fr-FR')} ${payoutCurrency}`,
      `${finalPayerCommission.toFixed(0)} ${payoutCurrency}`,
    ).catch(() => {});

    // ── Email agent ──────────────────────────────────────
    if (agent.email) {
      this.agentMail.sendWithdrawalProcessed({
        email:      agent.email,
        agentName:  `${agent.firstName ?? ''} ${agent.lastName ?? ''}`.trim(),
        clientName: beneficiaryName,
        amount:     amountPaid,
        currency:   payoutCurrency,
        newBalance: Number(agencyWalletUpdated?.balance ?? agencyWallet.balance),
        code:       cleanCode,
        userId:     agentId,
      }).catch((err) => {
        this.logger.warn(`Email agent non envoyé : ${err?.message}`);
      });
    }

    // ── ④ Alerte solde faible agence payeuse ────────────
    if (
      agencyWalletUpdated &&
      Number(agencyWalletUpdated.balance) < LOW_BALANCE_THRESHOLD
    ) {
      this.agentNotifier.notifyLowBalance(
        agentId,
        Number(agencyWalletUpdated.balance),
      ).catch(() => {});

      this.logger.warn(
        `⚠️  Solde agence ${agent.agency.name} bas : ` +
        `${Number(agencyWalletUpdated.balance)} ${payoutCurrency}`,
      );
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