// apps/backend/src/payments/recharge.service.ts
// =========================================================
// RECHARGE SERVICE v1.4 — Direct Transf'air
// ✅ v1.4 (audit point 7) : au démarrage, si NODE_ENV=production et que BLOCK_SIMULATED_RECHARGES n'est pas à « true »,
//   un avertissement bien visible est écrit dans les logs : les recharges carte / Orange Money / Sendwave créditent
//   alors le wallet SANS paiement réel. Le comportement par défaut ne change pas (recharges simulées ouvertes pour la
//   phase de test, comme décidé) : il suffit de poser BLOCK_SIMULATED_RECHARGES=true sur Render au lancement.
// ✅ v1.3 (phase 6, passe 3) : interrupteur BLOCK_SIMULATED_RECHARGES (voir simulation.flags.ts) pour fermer les
//   recharges simulées au lancement (le suivi /recharge/:id/status reste ouvert pour solder celles en cours).
// ✅ v1.2 (phase 6) : (1) creditIfNotAlready() passe par WalletsService.creditOnce() : le contrôle « déjà
//   crédité ? » et le crédit se font sous le verrou du wallet. Avant, deux sondages simultanés de
//   /payments/recharge/:id/status créditaient deux fois. (2) Références tirées avec crypto, suffixe
//   aléatoire sur CARDMOCK-. ⚠️ Les recharges carte / Orange Money / Sendwave restent des simulations
//   (voir rapport de phase 6).
// ✅ v1.1 : rechargeByOrangeMoney prend maintenant RechargeByMobileMoneyDto
//   (momoPhone obligatoire) — stocké dans Transaction.note, comme le
//   fait déjà rechargeByCard avec les 4 derniers chiffres de carte.
//   createPendingDeposit accepte un `note` optionnel pour ça.
// =========================================================
// Nouveau service : recharge du wallet du client par carte bancaire,
// Orange Money ou Sendwave. Séparé de PaymentsService (qui gère le
// paiement d'un transfert *sortant* déjà créé) — la recharge est un
// flux entrant *sur son propre compte*, avec une sémantique de
// règlement différente.
//
// ⚠️ POINT IMPORTANT :
// En auditant payments.service.ts / orange-money.service.ts /
// sendwave.service.ts / transactions.service.ts, aucun de ces flux
// ne crédite automatiquement un wallet à la simple transition PAID
// d'une transaction : le crédit (walletsService.credit) est fait
// explicitement, au cas par cas, par celui qui orchestre chaque flux.
// La recharge a besoin du même traitement explicite — d'où
// checkAndSettle() ci-dessous, qui centralise ce crédit pour toute
// méthode de recharge, de façon idempotente, SANS modifier un seul
// fichier existant.
// =========================================================

import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  Prisma,
  PaymentMethod,
  PayoutMethod,
  ProviderStatus,
  Transaction,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { OrangeMoneyService } from './orange-money.service';
import { SendwaveService } from './sendwave.service';
import { simulatedRechargesBlocked } from './simulation.flags';
import {
  InitiateRechargeDto,
  RechargeByCardDto,
  RechargeByMobileMoneyDto,
} from './dto/initiate-recharge.dto';

@Injectable()
export class RechargeService {
  private readonly logger = new Logger(RechargeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletsService: WalletsService,
    private readonly om: OrangeMoneyService,
    private readonly sendwave: SendwaveService,
  ) {
    if (process.env.NODE_ENV === 'production' && !simulatedRechargesBlocked()) {
      this.logger.warn(
        '⚠️ BLOCK_SIMULATED_RECHARGES n\'est pas à « true » en production : les recharges carte / Orange Money / Sendwave ' +
        'créditent le wallet SANS paiement réel. Posez BLOCK_SIMULATED_RECHARGES=true avant d\'ouvrir au public.',
      );
    }
  }

  // ========================================================
  // Carte bancaire — mock synchrone (pas de vrai PSP branché)
  // ========================================================

  /** Recharges simulées fermées (BLOCK_SIMULATED_RECHARGES=true) : aucun vrai PSP / opérateur n'est branché. */
  private assertRechargesOpen(): void {
    if (simulatedRechargesBlocked()) {
      throw new ServiceUnavailableException("La recharge du wallet n'est pas encore disponible.");
    }
  }

  async rechargeByCard(userId: string, dto: RechargeByCardDto): Promise<Transaction> {
    this.assertRechargesOpen();
    const user = await this.getActiveUser(userId);

    const created = await this.prisma.transaction.create({
      data: {
        reference: this.generateReference(),
        type: TransactionType.DEPOSIT,
        direction: TransactionDirection.INBOUND,
        amount: new Prisma.Decimal(dto.amount),
        fees: new Prisma.Decimal(0),
        total: new Prisma.Decimal(dto.amount),
        currency: dto.currency,
        status: TransactionStatus.VALIDATED,
        payoutMethod: PayoutMethod.WALLET,
        paymentMethod: PaymentMethod.CARD,
        providerStatus: ProviderStatus.PENDING,
        providerRef: `CARDMOCK-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        senderId: userId,
        recipientId: userId,
        clientId: user.clientId!,
        note: `Recharge carte •••• ${dto.cardNumber.slice(-4)}`,
      },
    });

    // ⚠️ Mock — succès systématique tant qu'aucun vrai PSP n'est branché.
    const paid = await this.prisma.transaction.update({
      where: { id: created.id },
      data: {
        status: TransactionStatus.PAID,
        paidAt: new Date(),
        providerStatus: ProviderStatus.SUCCESS,
      },
    });

    await this.creditIfNotAlready(paid);
    return paid;
  }

  // ========================================================
  // Orange Money — réutilise OrangeMoneyService tel quel
  // ✅ v1.1 : momoPhone obligatoire, stocké dans note
  // ========================================================

  async rechargeByOrangeMoney(userId: string, dto: RechargeByMobileMoneyDto) {
    this.assertRechargesOpen();
    const user = await this.getActiveUser(userId);
    const created = await this.createPendingDeposit(userId, user.clientId!, dto, {
      note: `Recharge Orange Money depuis ${dto.momoPhone}`,
    });

    const providerResult = await this.om.initiate(created, {
      simulateSuccess: dto.simulateSuccess,
    });

    return { transactionId: created.id, ...providerResult };
  }

  // ========================================================
  // Sendwave — réutilise SendwaveService tel quel
  // ========================================================

  async rechargeBySendwave(userId: string, dto: InitiateRechargeDto) {
    this.assertRechargesOpen();
    const user = await this.getActiveUser(userId);
    const created = await this.createPendingDeposit(userId, user.clientId!, dto);

    const providerResult = await this.sendwave.initiate(created);

    return { transactionId: created.id, ...providerResult };
  }

  // ========================================================
  // Statut + règlement (crédit du wallet) — appelé par le mobile en
  // polling après une recharge Orange Money / Sendwave. Sans effet
  // si déjà réglé (idempotent).
  // ========================================================

  async checkAndSettle(userId: string, transactionId: string): Promise<Transaction> {
    const tx = await this.prisma.transaction.findFirst({
      where: { id: transactionId, senderId: userId, type: TransactionType.DEPOSIT },
    });
    if (!tx) throw new NotFoundException('Recharge introuvable');

    if (tx.status === TransactionStatus.PAID) {
      await this.creditIfNotAlready(tx);
    }

    return tx;
  }

  // ========================================================
  // Helpers privés
  // ========================================================

  private async createPendingDeposit(
    userId: string,
    clientId: number,
    dto: InitiateRechargeDto,
    extra?: { note?: string },
  ): Promise<Transaction> {
    return this.prisma.transaction.create({
      data: {
        reference: this.generateReference(),
        type: TransactionType.DEPOSIT,
        direction: TransactionDirection.INBOUND,
        amount: new Prisma.Decimal(dto.amount),
        fees: new Prisma.Decimal(0),
        total: new Prisma.Decimal(dto.amount),
        currency: dto.currency,
        status: TransactionStatus.VALIDATED,
        payoutMethod: PayoutMethod.WALLET,
        senderId: userId,
        recipientId: userId,
        clientId,
        note: extra?.note ?? null,
      },
    });
  }

  // Idempotent : ne crédite jamais deux fois la même transaction
  // (vérifie l'absence d'une LedgerEntry déjà liée à transactionId).
  private async creditIfNotAlready(tx: Transaction): Promise<void> {
    const walletRef = await this.walletsService.getOrCreateWallet({
      userId: tx.senderId,
      currency: tx.currency,
    });
    await this.walletsService.creditOnce(
      walletRef.id,
      Number(tx.amount),
      `Recharge wallet (${tx.paymentMethod ?? 'WALLET'})`,
      tx.id,
    );
  }

  private async getActiveUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (!user.clientId) throw new ForbiddenException('Utilisateur sans société associée');
    return user;
  }

  private generateReference(): string {
    return crypto.randomInt(100_000_000, 1_000_000_000).toString();
  }
}