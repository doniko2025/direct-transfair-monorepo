// apps/backend/src/payments/recharge.service.ts
// =========================================================
// RECHARGE SERVICE v1.1 — Direct Transf'air
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
  NotFoundException,
} from '@nestjs/common';
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
import {
  InitiateRechargeDto,
  RechargeByCardDto,
  RechargeByMobileMoneyDto,
} from './dto/initiate-recharge.dto';

@Injectable()
export class RechargeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletsService: WalletsService,
    private readonly om: OrangeMoneyService,
    private readonly sendwave: SendwaveService,
  ) {}

  // ========================================================
  // Carte bancaire — mock synchrone (pas de vrai PSP branché)
  // ========================================================

  async rechargeByCard(userId: string, dto: RechargeByCardDto): Promise<Transaction> {
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
        providerRef: `CARDMOCK-${Date.now()}`,
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
    const alreadyCredited = await this.prisma.ledgerEntry.findFirst({
      where: { transactionId: tx.id },
    });
    if (alreadyCredited) return;

    const walletRef = await this.walletsService.getOrCreateWallet({
      userId: tx.senderId,
      currency: tx.currency,
    });
    await this.walletsService.credit(
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
    return Math.floor(100000000 + Math.random() * 900000000).toString();
  }
}