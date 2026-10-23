// apps/backend/src/withdrawals/withdrawals.service.ts
// =========================================================
// WITHDRAWALS SERVICE v4.15 — Direct Transf'air
// ✅ v4.15 : (1) PAYS DE PAIEMENT. Un code ne se paie que dans le pays de destination de l'envoi (Transaction.receiveCountry,
//    repli : pays du bénéficiaire). Une agence d'un autre pays — même si sa devise est la même, le XOF étant partagé par huit
//    pays — est refusée avec un message qui indique le pays de destination (pickup-rules.ts). Appliqué à la VÉRIFICATION du code
//    (agentCheckCode, qui reçoit maintenant l'agent) comme au PAIEMENT.
//    (2) EXPIRATION. Un code de plus de 5 mois n'est plus vérifiable ni payable, même avant le passage du cron qui annule
//    l'envoi et rembourse l'expéditeur (TransactionsService.expireUnclaimed).
//    (3) Le crédit de commission vers la société / l'agence d'envoi n'est plus bloqué par le gel d'un wallet (voir wallets v5.8) :
//    un wallet gelé ne doit pas empêcher un retrait déjà autorisé d'être payé.
// ✅ v4.14 (audit point 4) : un retrait rejeté / annulé / échoué / expiré n'est plus payable en agence.
//    (1) agentCheckCode() et agentProcessPayment() refusent un code dont le retrait n'est ni PENDING ni APPROVED ;
//    (2) le passage du retrait à PAID est conditionné à ce statut, dans la même transaction SQL que le paiement
//        (un admin qui rejette au même instant qu'un agent paie ne peut plus laisser un retrait « rejeté » payé) ;
//    (3) adminUpdateStatus() : REJECTED / CANCELLED / FAILED / EXPIRED ferment AUSSI la transaction et rembourse
//        l'expéditeur, atomiquement (TransactionsService.closeFromWithdrawal). Avant, seul le statut du retrait
//        changeait : la transaction restait VALIDATED (payable) et l'expéditeur n'était jamais remboursé.
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
//
// ✅ v4.12 (phase 6) : create() supprimé avec POST /withdrawals (retrait cash demandé par un client
//   depuis son wallet). Aucun écran ne l'appelait, il ignorait le barème de frais (1,5 % codé en dur) et
//   débitait le wallet hors transaction. Les retraits en agence passent par un envoi cash (TRANSFER) et
//   les routes agent/check et agent/pay. La table Withdrawal et les routes de lecture ne changent pas.
//
// ✅ v4.13 (phase 6, lot 2c) : commissions exactes et statut manuel encadré
//   (1) Répartition calculée par splitFees() : chaque part arrondie à la devise, la part de la société est le
//       reste — payeur + envoi + société = frais, sans centime créé ou perdu (avant : flottants non arrondis).
//   (2) Taux de change indisponible pour convertir les frais → erreur 503 explicite. Avant : toutes les
//       commissions étaient mises à 0 sans prévenir, définitivement (le retrait passait à PAID).
//   (3) Crédits (cash avancé, commission payeuse, envoi, société) via WalletsService.creditInTx : wallet verrouillé,
//       solde relu sous verrou, balanceAfter exact. Avant : balanceAfter calculé à partir d'un solde lu hors transaction.
//   (4) Agence d'envoi = agence enregistrée sur l'envoi (Transaction.agencyId), repli sur l'agence de l'expéditeur ;
//       son type est lu en base (avant : relation chargée de l'expéditeur, périmée si l'agent a changé d'agence).
//   (5) Wallet société introuvable → erreur (avant : part de la société mise à 0 en silence).
//   (6) adminUpdateStatus() : PAID interdit à la main (le cash et les commissions ne bougent que via agent/pay),
//       statuts finaux figés, transition conditionnelle, journal d'audit.
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
import {
  Prisma,
  TransactionStatus,
  WithdrawalStatus,
  PayoutMethod,
  ProviderStatus,
  AgencyType,
  CommissionSourceType,
  CommissionDestType,
  TransactionType,
} from '@prisma/client';

import { PrismaService }  from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { TransactionsService } from '../transactions/transactions.service';
import { toIso2 } from '../fee-schedule/countries';
import { assertPayableInCountry, destinationCountryOf, isPickupExpired } from '../transactions/pickup-rules';
import { RatesService }   from '../rates/rates.service';
import { UpdateWithdrawalStatusDto } from './dto/update-withdrawal-status.dto';
import { defaultShares, type Shares } from '../commission-rules/commission-rule-defaults';
import { splitFees } from '../commission-rules/commission-split';
import { roundToCurrency } from '../fee-schedule/fee-engine';

import { WalletNotifierService } from '../notifications/channels/wallet-notifier.service';
import { AgentNotifierService }  from '../notifications/channels/agent-notifier.service';
import { WalletMailService }     from '../mail/channels/wallet-mail.service';
import { AgentMailService }      from '../mail/channels/agent-mail.service';

// Seuil d'alerte solde faible agence (en devise payout)
const LOW_BALANCE_THRESHOLD = 50_000;

/** Statuts qu'un admin peut poser à la main (jamais PAID : voir adminUpdateStatus). */
const MANUAL_TARGETS: WithdrawalStatus[] = [
  WithdrawalStatus.APPROVED,
  WithdrawalStatus.REJECTED,
  WithdrawalStatus.FAILED,
  WithdrawalStatus.CANCELLED,
  WithdrawalStatus.EXPIRED,
];

/** Statuts de transaction depuis lesquels un code peut encore expirer. */
const PAYABLE_STATUSES: TransactionStatus[] = [TransactionStatus.PENDING, TransactionStatus.VALIDATED];

/** Statuts de retrait depuis lesquels un paiement en agence reste possible. */
const PAYABLE_WITHDRAWAL: WithdrawalStatus[] = [WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED];

/** Statuts manuels qui ferment le retrait : la transaction est close et l'expéditeur remboursé. */
const CLOSING_TARGETS: WithdrawalStatus[] = [
  WithdrawalStatus.REJECTED,
  WithdrawalStatus.FAILED,
  WithdrawalStatus.CANCELLED,
  WithdrawalStatus.EXPIRED,
];

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
    private readonly transactions:   TransactionsService,
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
  // AGENT — Vérifier un code de retrait
  // =========================================================

  async agentCheckCode(clientId: number, code: string, agentId?: string) {
    const cleanCode = String(code ?? '').trim();
    if (!cleanCode) throw new BadRequestException('Code requis');

    const tx = await this.prisma.transaction.findFirst({
      where: payableCodeWhere(clientId, cleanCode), // ✅ v4.11 : envois cash uniquement
      include: { sender: true, beneficiary: true, withdrawal: { select: { status: true } } },
    });

    if (!tx) throw new NotFoundException('Code invalide ou introuvable.');
    // ✅ v4.14 : un retrait rejeté / annulé / échoué / expiré n'est plus vérifiable comme payable.
    if (tx.withdrawal && !PAYABLE_WITHDRAWAL.includes(tx.withdrawal.status)) {
      throw new ConflictException(`Retrait ${tx.withdrawal.status.toLowerCase()} : ce code ne peut plus être payé.`);
    }
    // ✅ v4.15 — code expiré (5 mois) : informé dès la vérification.
    if (tx.status === TransactionStatus.EXPIRED || (PAYABLE_STATUSES.includes(tx.status) && isPickupExpired(tx))) {
      throw new ConflictException('Ce code a expiré : l\'envoi est annulé et l\'expéditeur est remboursé automatiquement.');
    }
    // ✅ v4.15 — pays de paiement : l'agent est informé dès la vérification que ce code se paie dans un autre pays.
    if (agentId) {
      const agent = await this.prisma.user.findUnique({ where: { id: agentId }, include: { agency: true } });
      if (!agent?.agency) throw new ForbiddenException('Agent sans agence');
      assertPayableInCountry({
        destinationCountry: destinationCountryOf(tx),
        payerCountry:       toIso2(agent.agency.country ?? null),
        payoutCurrency:     tx.targetCurrency ?? tx.currency,
        payerCurrency:      agent.agency.primaryCurrency ?? null,
      });
    }

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
    if (tx.status === TransactionStatus.EXPIRED)
      throw new ConflictException('Ce code a expiré : l\'envoi est annulé et l\'expéditeur est remboursé.');
    if (tx.status !== TransactionStatus.VALIDATED)
      throw new ForbiddenException(`Statut invalide: ${tx.status}`);
    // ✅ v4.14 (audit point 4) : le statut du RETRAIT compte aussi — un retrait rejeté / annulé / échoué / expiré ne se paie pas.
    if (tx.withdrawal && !PAYABLE_WITHDRAWAL.includes(tx.withdrawal.status)) {
      throw new ConflictException(`Retrait ${tx.withdrawal.status.toLowerCase()} : ce code ne peut plus être payé.`);
    }

    // ✅ v4.15 — code expiré (5 mois) : refusé même avant le passage du cron d'expiration.
    if (isPickupExpired(tx)) {
      throw new ConflictException('Ce code a expiré : l\'envoi est annulé et l\'expéditeur est remboursé automatiquement.');
    }

    // ── Agent et agence ───────────────────────────────────
    const agent = await this.prisma.user.findUnique({
      where:   { id: agentId },
      include: { agency: true },
    });
    if (!agent || !agent.agencyId || !agent.agency) {
      throw new ForbiddenException('Agent sans agence');
    }

    const payoutCurrency = tx.targetCurrency ?? tx.currency;

    // ✅ v4.15 — pays de paiement : un code ne se paie que dans le pays de destination de l'envoi.
    assertPayableInCountry({
      destinationCountry: destinationCountryOf(tx),
      payerCountry:       toIso2(agent.agency.country ?? null),
      payoutCurrency,
      payerCurrency:      agent.agency.primaryCurrency ?? null,
    });

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

    // ── Conversion des frais en devise payout ────────────
    // ✅ v4.13 : un taux indisponible bloque le paiement (503) au lieu de mettre toutes les commissions à 0
    // en silence : le retrait est payé plus tard, avec ses commissions, plutôt que sans.
    const rawFees = Number(tx.fees ?? 0);
    let feesInPayoutCurrency = rawFees;

    if (rawFees > 0 && tx.currency !== payoutCurrency) {
      try {
        feesInPayoutCurrency = await this.ratesService.convert(rawFees, tx.currency, payoutCurrency);
      } catch (e) {
        this.logger.error(
          `Conversion des frais impossible (${tx.currency}→${payoutCurrency}) pour le code ${cleanCode} : ${(e as Error)?.message}`,
        );
        throw new ServiceUnavailableException(
          `Taux de change ${tx.currency} → ${payoutCurrency} indisponible : le retrait ne peut pas être payé pour le moment. Réessayez dans quelques instants.`,
        );
      }
    }

    // ── Agence d'envoi ───────────────────────────────────
    // ✅ v4.13 (M13) : l'agence enregistrée sur l'envoi (celle de l'agent AU MOMENT de l'envoi) prime sur
    // l'agence actuelle de l'expéditeur, qui a pu changer depuis. Son type (filiale / partenaire) donne la
    // règle de répartition ; sans agence, l'expéditeur est un client wallet.
    const senderAgencyId: string | null = tx.agencyId ?? (tx.sender as any)?.agencyId ?? null;
    let sourceT: CommissionSourceType = CommissionSourceType.WALLET;
    if (senderAgencyId) {
      const senderAgency = await this.prisma.agency.findFirst({
        where:  { id: senderAgencyId, clientId },
        select: { type: true },
      });
      sourceT = senderAgency?.type === AgencyType.PARTNER
        ? CommissionSourceType.PARTNER
        : CommissionSourceType.SUBSIDIARY;
    }
    const destT: CommissionDestType = agent.agency.type === AgencyType.PARTNER
      ? CommissionDestType.PARTNER
      : CommissionDestType.SUBSIDIARY;

    // ── Règle de répartition (v4.10 : filtrée sur sourceType / destType) ─
    let shares: Shares = defaultShares();
    const splitRule = await this.prisma.commissionConfig.findFirst({
      where:   { clientId, payoutMethod: null, sourceType: sourceT, destType: destT },
      orderBy: { updatedAt: 'desc' },
    });
    if (splitRule) {
      shares = {
        payerShare:    splitRule.payerShare,
        senderShare:   splitRule.senderShare,
        platformShare: splitRule.platformShare,
      };
    } else {
      this.logger.warn(
        `Aucune règle de répartition pour clientId=${clientId} ${sourceT} → ${destT} ` +
        `— valeurs par défaut (${shares.payerShare}/${shares.senderShare}/${shares.platformShare}).`,
      );
    }
    const payerSharePct    = shares.payerShare;
    const senderSharePct   = shares.senderShare;
    const platformSharePct = shares.platformShare;

    // ── Montants (arrondis à la devise, la société prend le reste) ──
    const senderIsClient = !senderAgencyId;
    const isSameAgency   = !!senderAgencyId && senderAgencyId === agent.agencyId;

    const split = splitFees({
      fees: feesInPayoutCurrency, currency: payoutCurrency, shares, senderIsClient, sameAgency: isSameAgency,
    });
    let finalPayerCommission    = split.payer;
    let finalSenderCommission   = split.sender;
    let finalPlatformCommission = split.platform;

    // ── Wallet agence d'envoi (si une part lui revient) ──
    let senderAgencyWallet: { id: string } | null = null;
    if (finalSenderCommission > 0 && senderAgencyId) {
      const senderWallets = await this.prisma.wallet.findMany({
        where: { agencyId: senderAgencyId, isActive: true },
      });
      // ✅ v4.11 : uniquement la caisse de la devise payée ; sinon la part revient à la société.
      senderAgencyWallet = senderWallets.find((w) => w.currency === payoutCurrency) ?? null;
      if (!senderAgencyWallet) {
        this.logger.warn(`Caisse ${payoutCurrency} de l'agence d'envoi ${senderAgencyId} introuvable → part versée à la société`);
        finalPlatformCommission = roundToCurrency(finalPlatformCommission + finalSenderCommission, payoutCurrency);
        finalSenderCommission = 0;
      }
    }

    // ── Wallet société (une erreur bloque le paiement : plus de part de la société perdue en silence) ──
    let companyWallet: { id: string } | null = null;
    if (finalPlatformCommission > 0) {
      companyWallet = await this.walletsService.getOrCreateWallet({ clientId, currency: payoutCurrency });
    }

    this.logger.log(
      `Distribution retrait ${cleanCode} : ${sourceT}→${destT} | frais ${rawFees} ${tx.currency} = ` +
      `${feesInPayoutCurrency} ${payoutCurrency} | payeuse ${finalPayerCommission} | envoi ${finalSenderCommission} | ` +
      `société ${finalPlatformCommission} | cash ${amountPaid}`,
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

      // ✅ v4.13 : crédits via WalletsService.creditInTx — verrou du wallet, solde relu sous verrou et
      // balanceAfter exact dans le journal (avant : calculé depuis un solde lu hors transaction).

      // ── CRÉDIT 1 : Agence payeuse (cash avancé + commission) ──
      if (amountPaid > 0) {
        await this.walletsService.creditInTx(
          prismaTx, agencyWallet.id, amountPaid, `Remboursement cash retrait ${cleanCode}`, tx.id,
        );
      }
      if (finalPayerCommission > 0) {
        await this.walletsService.creditInTx(
          prismaTx, agencyWallet.id, finalPayerCommission,
          `Commission paiement ${cleanCode} (${payerSharePct}${isSameAgency ? `+${senderSharePct}` : ''}%)`, tx.id,
        );
      }

      // ── CRÉDIT 2 : Agence d'envoi (si différente) ──────
      if (finalSenderCommission > 0 && senderAgencyWallet) {
        await this.walletsService.creditInTx(
          prismaTx, senderAgencyWallet.id, finalSenderCommission,
          `Commission envoi ${cleanCode} (${senderSharePct}%)`, tx.id, { allowFrozen: true }, // v4.15 : un tiers gelé ne bloque pas le paiement
        );
      }

      // ── CRÉDIT 3 : Société (plateforme) ─────────────────
      if (finalPlatformCommission > 0 && companyWallet) {
        await this.walletsService.creditInTx(
          prismaTx, companyWallet.id, finalPlatformCommission,
          `Commission plateforme ${cleanCode} (${platformSharePct}%${senderIsClient ? `+${senderSharePct}%↑client` : ''})`, tx.id, { allowFrozen: true }, // v4.15
        );
      }

      // ── Withdrawal ──────────────────────────────────────
      if (tx.withdrawal) {
        // ✅ v4.14 : conditionné au statut payable — si un admin vient de rejeter ce retrait, le paiement (et tous les
        // crédits ci-dessus, annulés avec la transaction SQL) est refusé.
        const withdrawalClaimed = await prismaTx.withdrawal.updateMany({
          where: { id: tx.withdrawal.id, status: { in: PAYABLE_WITHDRAWAL } },
          data:  { status: WithdrawalStatus.PAID, processedById: agentId, processedAt: new Date() },
        });
        if (withdrawalClaimed.count !== 1) {
          throw new ConflictException('Ce retrait vient d\'être clos par un administrateur : paiement refusé.');
        }
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
          payerAgency:  { amount: finalPayerCommission,   share: payerSharePct + (isSameAgency ? senderSharePct : 0) },
          senderAgency: { amount: finalSenderCommission,  share: finalSenderCommission > 0 ? senderSharePct : 0 },
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

  /**
   * ✅ v4.13 : statut manuel encadré.
   *   - « PAID » ne se pose jamais à la main : un retrait n'est payé que par l'agent qui remet le cash
   *     (agentProcessPayment), seul chemin qui déplace l'argent et distribue les commissions ;
   *   - un retrait déjà payé ou clos (rejeté, échoué, annulé, expiré) n'est plus modifiable ;
   *   - la transition est conditionnelle (updateMany sur le statut courant) : deux admins simultanés
   *     ou un paiement concurrent ne s'écrasent pas ;
   *   - chaque changement est journalisé.
   */
  async adminUpdateStatus(
    clientId: number,
    adminId:  string,
    id:       string,
    dto:      UpdateWithdrawalStatusDto,
  ) {
    if (!MANUAL_TARGETS.includes(dto.status)) {
      throw new BadRequestException(
        dto.status === WithdrawalStatus.PAID
          ? 'Un retrait ne passe à « payé » que lorsqu\'un agent remet le cash avec le code. Il ne peut pas être marqué payé à la main.'
          : `Statut « ${dto.status} » non applicable manuellement.`,
      );
    }

    const before = await this.prisma.withdrawal.findFirst({ where: { id, clientId }, select: { status: true } });
    if (!before) throw new NotFoundException('Retrait introuvable');

    if (before.status !== WithdrawalStatus.PENDING && before.status !== WithdrawalStatus.APPROVED) {
      throw new ConflictException(`Ce retrait est déjà « ${before.status} » : son statut n'est plus modifiable.`);
    }

    // ✅ v4.14 (audit point 4) : fermer un retrait ferme aussi la transaction et rembourse l'expéditeur (atomique).
    if (CLOSING_TARGETS.includes(dto.status)) {
      const w = await this.prisma.withdrawal.findFirst({ where: { id, clientId }, select: { transactionId: true } });
      if (!w) throw new NotFoundException('Retrait introuvable');
      await this.transactions.closeFromWithdrawal(clientId, adminId, w.transactionId, dto.status);
      try {
        await this.prisma.auditLog.create({
          data: {
            userId: adminId, clientId, action: 'WITHDRAWAL_PROCESS', entity: 'Withdrawal', entityId: id,
            details: { from: before.status, to: dto.status, transactionClosedAndRefunded: true } as Prisma.InputJsonValue, successful: true,
          },
        });
      } catch (err) {
        this.logger.error(`Journal d'audit non écrit (retrait ${id}) : ${(err as Error).message}`);
      }
      return this.prisma.withdrawal.findUniqueOrThrow({ where: { id } });
    }

    // ✅ v4.11 : limité à la société de l'appelant ; v4.13 : et au statut lu ci-dessus.
    const updated = await this.prisma.withdrawal.updateMany({
      where: { id, clientId, status: before.status },
      data:  { status: dto.status },
    });
    if (updated.count !== 1) throw new ConflictException('Ce retrait vient d\'être modifié par un autre utilisateur. Rechargez la page.');

    try {
      await this.prisma.auditLog.create({
        data: {
          userId: adminId, clientId, action: 'WITHDRAWAL_PROCESS', entity: 'Withdrawal', entityId: id,
          details: { from: before.status, to: dto.status } as Prisma.InputJsonValue, successful: true,
        },
      });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (retrait ${id}) : ${(err as Error).message}`);
    }
    return this.prisma.withdrawal.findUniqueOrThrow({ where: { id } });
  }
}
