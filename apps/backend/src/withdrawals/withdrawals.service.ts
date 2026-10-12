// apps/backend/src/withdrawals/withdrawals.service.ts
// =========================================================
// WITHDRAWALS SERVICE v4.11 — Direct Transf'air
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
//
// ✅ v4.10 : 🚨 FIX CRITIQUE — mauvaise règle de répartition utilisée
//
//   PROBLÈME RÉSOLU (juillet 2026) :
//   agentProcessPayment() cherchait la split rule avec :
//     commissionConfig.findFirst({ where: { clientId, payoutMethod: null } })
//   sans filtrer par sourceType/destType. Or CommissionConfig a une
//   contrainte @@unique([clientId, sourceType, destType, currency]) —
//   un même client peut tout à fait avoir PLUSIEURS règles de
//   répartition différentes selon la combinaison agence d'origine /
//   agence payeuse (SUBSIDIARY→PARTNER ≠ SUBSIDIARY→SUBSIDIARY, etc.).
//   findFirst() sans ces filtres renvoie la première ligne que Prisma
//   trouve, sans ordre garanti — potentiellement la MAUVAISE règle,
//   appliquée silencieusement à CHAQUE retrait, quels que soient les
//   types d'agences réellement impliqués. commissions.service.ts
//   (getHistory()) fait ce matching correctement depuis le début ;
//   withdrawals.service.ts calcule les MÊMES montants réellement
//   VERSÉS aux agences sans le faire — désaccord entre l'affichage
//   (correct) et l'argent effectivement transféré (potentiellement
//   incorrect), sans erreur ni log visible.
//
//   CORRECTIF :
//   sourceType/destType calculés exactement comme dans
//   commissions.service.ts::getHistory() (type d'agence de
//   l'expéditeur → sourceType, type d'agence de l'agent payeur →
//   destType, WALLET/SUBSIDIARY par défaut si pas d'agence), puis
//   utilisés pour filtrer la recherche de la split rule. Si aucune
//   règle exacte n'est trouvée, repli explicite sur les mêmes
//   DEFAULT_* déjà utilisés plus bas dans ce fichier — jamais une
//   règle non vérifiée prise au hasard.
//
// ✅ v4.11 (phase 6) : sécurité et cohérence du paiement en agence
//   (1) 🚨 adminUpdateStatus() : la mise à jour se faisait par `id` seul — l'admin d'une société
//       pouvait changer le statut d'un retrait d'une AUTRE société. Elle est maintenant limitée
//       à la société de l'appelant (404 sinon).
//   (2) 🚨 agentCheckCode() / agentProcessPayment() : le code était cherché parmi TOUTES les
//       transactions de la société (dépôt, recharge, facture B2B, remise de caisse…). Un agent qui
//       connaissait une référence quelconque (elles s'affichent dans l'historique) pouvait la
//       « payer » et faire créditer sa caisse sans avoir remis de cash. Seuls les envois à retirer
//       en espèces (type TRANSFER ou SCHEDULED, mode CASH_PICKUP) sont payables.
//   (3) agentProcessPayment() : plus de repli sur une caisse d'une AUTRE devise (la caisse par défaut
//       ou la première trouvée) — créditer des GNF avec un montant en XOF fausse la caisse. Même règle
//       pour la caisse de l'agence d'envoi : sans caisse dans la devise, la part revient à la société.
//   (4) create() : le code de retrait vient de crypto.randomInt (et non Math.random) et est vérifié
//       unique avant le débit ; la demande par transactionId ne vaut que pour une transaction de
//       l'appelant (un admin de la société reste autorisé) et ne crée plus de doublon.
// =========================================================

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as crypto from 'crypto';
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
  TransactionType,
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

/** Envois payables en espèces à un guichet : TRANSFER (client / agent) et SCHEDULED (virement programmé). */
const PAYABLE_TYPES: TransactionType[] = [TransactionType.TRANSFER, TransactionType.SCHEDULED];

/** Filtre commun à agentCheckCode() et agentProcessPayment() : un code ne désigne qu'un envoi à retirer en cash. */
function payableCodeWhere(clientId: number, cleanCode: string): Prisma.TransactionWhereInput {
  return {
    clientId,
    type:         { in: PAYABLE_TYPES },
    payoutMethod: PayoutMethod.CASH_PICKUP,
    OR: [
      { reference: cleanCode },
      { providerRef: cleanCode },
      { providerRef: { startsWith: `${cleanCode}|` } },
    ],
  };
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

  /** Code de retrait à 9 chiffres (CSPRNG), libre dans reference et providerRef. */
  private async uniqueWithdrawalCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = crypto.randomInt(100_000_000, 1_000_000_000).toString();
      const clash = await this.prisma.transaction.findFirst({
        where: { OR: [{ reference: code }, { providerRef: code }, { providerRef: { startsWith: `${code}|` } }] },
        select: { id: true },
      });
      if (!clash) return code;
    }
    throw new ServiceUnavailableException('Impossible de générer un code de retrait unique, réessayez.');
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

      const withdrawalCode = await this.uniqueWithdrawalCode();

      await this.walletsService.debit(
        walletRef.id,
        Number(total),
        `Demande retrait ${withdrawalCode}`,
      );

      const withdrawal = await this.prisma.$transaction(async (tx) => {
        const txData: Prisma.TransactionUncheckedCreateInput = {
          reference:      `WD-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`, // ✅ v4.11 : suffixe aléatoire (unicité)
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

    const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'COMPANY_ADMIN';
    const tx = await this.prisma.transaction.findFirst({
      where: { id: transactionId, clientId, ...(isAdmin ? {} : { senderId: userId }) },
    });
    if (!tx) throw new NotFoundException('Transaction introuvable');

    // Withdrawal.transactionId est unique : une seconde demande renvoie la première au lieu d'une erreur 500.
    const already = await this.prisma.withdrawal.findUnique({ where: { transactionId: tx.id } });
    if (already) return already;

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
      where: payableCodeWhere(clientId, cleanCode), // ✅ v4.11 : envois cash uniquement
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
      where: payableCodeWhere(clientId, cleanCode), // ✅ v4.11 : envois cash uniquement
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
    // ✅ v4.11 : uniquement la caisse de la devise payée (plus de repli sur une autre devise).
    const agencyWallet = agencyWallets.find((w) => w.currency === payoutCurrency);

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

    // ✅ v4.10 — FIX (voir changelog en tête de fichier) : sourceType/
    // destType calculés exactement comme commissions.service.ts::
    // getHistory(), pour matcher la BONNE split rule au lieu de la
    // première trouvée par Prisma.
    let sourceT: CommissionSourceType = CommissionSourceType.WALLET;
    const senderAgencyForSplit = (tx.sender as any)?.agency;
    if (senderAgencyForSplit) {
      sourceT = senderAgencyForSplit.type === AgencyType.PARTNER
        ? CommissionSourceType.PARTNER
        : CommissionSourceType.SUBSIDIARY;
    }
    let destT: CommissionDestType = CommissionDestType.SUBSIDIARY;
    if (agent.agency) {
      destT = agent.agency.type === AgencyType.PARTNER
        ? CommissionDestType.PARTNER
        : CommissionDestType.SUBSIDIARY;
    }

    // ── Calcul split rule ─────────────────────────────────
    let payerSharePct    = DEFAULT_PAYER_SHARE;
    let senderSharePct   = DEFAULT_SENDER_SHARE;
    let platformSharePct = DEFAULT_PLATFORM_SHARE;

    try {
      // ✅ v4.10 — filtre désormais sur sourceType/destType, plus de
      // findFirst() "à l'aveugle" sur juste { clientId, payoutMethod: null }.
      const splitRule = await this.prisma.commissionConfig.findFirst({
        where: { clientId, payoutMethod: null, sourceType: sourceT, destType: destT },
      });
      if (splitRule) {
        payerSharePct    = splitRule.payerShare;
        senderSharePct   = splitRule.senderShare;
        platformSharePct = splitRule.platformShare;
      } else {
        this.logger.warn(
          `Aucune split rule pour clientId=${clientId} sourceType=${sourceT} destType=${destT} ` +
          `— repli sur les valeurs par défaut (${DEFAULT_PAYER_SHARE}/${DEFAULT_SENDER_SHARE}/${DEFAULT_PLATFORM_SHARE}).`,
        );
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
        // ✅ v4.11 : uniquement la caisse de la devise payée (sinon la part revient à la société, ci-dessous).
        senderAgencyWallet = (
          senderWallets.find((w) => w.currency === payoutCurrency) ?? null
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
      `│  sourceType/destType : ${sourceT} → ${destT}\n` +
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
    // ✅ v4.11 : limité à la société de l'appelant (l'id seul ne suffit pas).
    const updated = await this.prisma.withdrawal.updateMany({
      where: { id, clientId },
      data:  { status: dto.status },
    });
    if (updated.count !== 1) throw new NotFoundException('Retrait introuvable');
    return this.prisma.withdrawal.findUniqueOrThrow({ where: { id } });
  }
}