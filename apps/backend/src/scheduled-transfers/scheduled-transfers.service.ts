// apps/backend/src/scheduled-transfers/scheduled-transfers.service.ts
// =========================================================
// SCHEDULED TRANSFERS SERVICE v4.3
// ✅ v4.2 conservé : CurrencyCode enum cast (migration v4.1)
// ✅ v4.3 : retry auto sur perte de connexion DB dans le cron
//
//   PROBLÈME RÉSOLU (v4.3) :
//   Neon met son compute en veille après 5 min d'inactivité par
//   défaut. Le cron tournant toutes les 5 minutes, la connexion
//   poolée devient obsolète entre deux exécutions → le findMany()
//   suivant plantait avec PrismaClientKnownRequestError [P1017]
//   "Server has closed the connection". Prisma ne relance jamais
//   automatiquement une requête après une erreur de connexion
//   (confirmé par l'équipe Prisma elle-même) : il faut le faire
//   côté appli — et sans ce filet, l'exception remontait hors du
//   cron sans être rattrapée, avec un risque de unhandled rejection.
//
//   FIX — withRetry() intercepte P1017 / P1001 / P1002 (et messages
//   équivalents), force une reconnexion via $connect(), puis relance
//   la requête une fois. Appliqué UNIQUEMENT à la lecture des
//   virements dus (idempotente, sans risque à relancer).
//
//   ⚠️ Je n'ai PAS ajouté de retry automatique à l'intérieur
//   d'executeTransfer() : retenter un débit de wallet ou une
//   création de transaction sans garde-fou d'idempotence risquerait
//   un double traitement d'argent. Si vous voulez sécuriser cette
//   partie aussi, ça mérite un traitement dédié (clé d'idempotence,
//   transaction Prisma atomique) plutôt qu'un retry générique.
// =========================================================

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CurrencyCode, Prisma, ScheduledStatus, ScheduledFrequency } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { RatesService } from '../rates/rates.service';
import { PushService } from '../push/push.service';
import { MailService } from '../mail/mail.service';

export interface CreateScheduledTransferDto {
  beneficiaryId?: string;
  amount: number;
  currency: string;
  targetCurrency?: string;
  payoutMethod?: string;
  note?: string;
  frequency: ScheduledFrequency;
  startDate: string;
  maxExecutions?: number;
}

const MAX_CONSECUTIVE_FAILURES = 3;

@Injectable()
export class ScheduledTransfersService {
  private readonly logger = new Logger(ScheduledTransfersService.name);

  private static readonly CONNECTION_ERROR_CODES = new Set(['P1017', 'P1001', 'P1002']);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletsService,
    private readonly rates: RatesService,
    private readonly push: PushService,
    private readonly mail: MailService,
  ) {}

  async create(userId: string, dto: CreateScheduledTransferDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { client: true },
    });
    if (!user || !user.clientId) throw new ForbiddenException('Utilisateur invalide');

    const client = await this.prisma.client.findUnique({ where: { id: user.clientId } });
    if (!client?.featureScheduledTransfers) {
      throw new ForbiddenException('Les virements programmés ne sont pas activés pour cette société.');
    }

    if (dto.beneficiaryId) {
      const bene = await this.prisma.beneficiary.findFirst({ where: { id: dto.beneficiaryId, userId } });
      if (!bene) throw new NotFoundException('Bénéficiaire introuvable');
    }

    const startDate = new Date(dto.startDate);
    if (startDate < new Date()) {
      throw new BadRequestException('La date de départ doit être dans le futur');
    }

    // ✅ FIX: cast string → CurrencyCode
    const currency = dto.currency.toUpperCase() as CurrencyCode;
    const targetCurrency = dto.targetCurrency
      ? (dto.targetCurrency.toUpperCase() as CurrencyCode)
      : null;

    const transfer = await this.prisma.scheduledTransfer.create({
      data: {
        userId,
        clientId: user.clientId,
        beneficiaryId: dto.beneficiaryId ?? null,
        amount: new Prisma.Decimal(dto.amount),
        currency,
        targetCurrency,
        payoutMethod: (dto.payoutMethod as any) ?? 'CASH_PICKUP',
        note: dto.note ?? null,
        frequency: dto.frequency,
        status: ScheduledStatus.ACTIVE,
        nextExecutionAt: startDate,
        maxExecutions: dto.maxExecutions ?? null,
      },
      include: { beneficiary: true },
    });

    return this.serialize(transfer);
  }

  async findForUser(userId: string) {
    const transfers = await this.prisma.scheduledTransfer.findMany({
      where: { userId },
      include: { beneficiary: true },
      orderBy: { createdAt: 'desc' },
    });
    return transfers.map(this.serialize);
  }

  async findOne(id: string, userId: string) {
    const transfer = await this.prisma.scheduledTransfer.findFirst({
      where: { id, userId },
      include: { beneficiary: true, transactions: { take: 5, orderBy: { createdAt: 'desc' } } },
    });
    if (!transfer) throw new NotFoundException('Virement programmé introuvable');
    return this.serialize(transfer);
  }

  async pause(id: string, userId: string) {
    const transfer = await this.prisma.scheduledTransfer.findFirst({ where: { id, userId } });
    if (!transfer) throw new NotFoundException('Introuvable');
    if (transfer.status !== ScheduledStatus.ACTIVE) {
      throw new BadRequestException('Seul un virement ACTIVE peut être suspendu');
    }
    const updated = await this.prisma.scheduledTransfer.update({
      where: { id },
      data: { status: ScheduledStatus.PAUSED },
    });
    return this.serialize(updated);
  }

  async resume(id: string, userId: string) {
    const transfer = await this.prisma.scheduledTransfer.findFirst({ where: { id, userId } });
    if (!transfer) throw new NotFoundException('Introuvable');
    if (transfer.status !== ScheduledStatus.PAUSED) {
      throw new BadRequestException('Seul un virement PAUSED peut être repris');
    }
    const updated = await this.prisma.scheduledTransfer.update({
      where: { id },
      data: { status: ScheduledStatus.ACTIVE },
    });
    return this.serialize(updated);
  }

  async cancel(id: string, userId: string) {
    const transfer = await this.prisma.scheduledTransfer.findFirst({ where: { id, userId } });
    if (!transfer) throw new NotFoundException('Introuvable');
    const updated = await this.prisma.scheduledTransfer.update({
      where: { id },
      data: { status: ScheduledStatus.CANCELLED },
    });
    return this.serialize(updated);
  }

  @Cron('*/5 * * * *')
  async processScheduledTransfers(): Promise<void> {
    const now = new Date();

    const due = await this.withRetry(() =>
      this.prisma.scheduledTransfer.findMany({
        where: {
          status: ScheduledStatus.ACTIVE,
          nextExecutionAt: { lte: now },
        },
        include: {
          user: { include: { wallets: { where: { isActive: true } } } },
          beneficiary: true,
          client: true,
        },
      }),
    ).catch((error: any) => {
      this.logger.error(
        `❌ Impossible de récupérer les virements dus (connexion DB) : ${error?.message ?? error}`,
      );
      return null;
    });

    if (!due || due.length === 0) return;
    this.logger.log(`⏰ ${due.length} virements programmés à exécuter`);

    for (const transfer of due) {
      await this.executeTransfer(transfer);
    }
  }

  /**
   * Relance une requête Prisma en cas de perte de connexion (typiquement Neon
   * qui a suspendu son compute pendant une période d'inactivité). Ne pas
   * utiliser autour d'écritures non idempotentes (débits, créations de
   * transaction) sans garde-fou dédié.
   */
  private async withRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      const code = err?.code;
      const msg = String(err?.message ?? '');
      const isConnectionIssue =
        ScheduledTransfersService.CONNECTION_ERROR_CODES.has(code) ||
        msg.includes('closed the connection') ||
        msg.includes("Can't reach database server");

      if (isConnectionIssue && retries > 0) {
        this.logger.warn(
          `⚠️ Connexion DB perdue (${code ?? 'sans code'}) — reconnexion et nouvel essai...`,
        );
        await this.prisma.$connect().catch(() => {});
        return this.withRetry(fn, retries - 1);
      }
      throw err;
    }
  }

  private async executeTransfer(transfer: any): Promise<void> {
    try {
      const user = transfer.user;
      if (!user) throw new Error('Utilisateur introuvable');

      const currency = transfer.currency as CurrencyCode;
      const userWallet = user.wallets?.find((w: any) => w.currency === currency && w.isActive);

      if (!userWallet) throw new Error(`Wallet ${currency} introuvable pour l'utilisateur`);

      if (Number(userWallet.balance) < Number(transfer.amount)) {
        throw new Error(`Solde insuffisant : ${userWallet.balance} ${currency} < ${transfer.amount}`);
      }

      const reference = `SCHED-${Date.now()}-${transfer.id.slice(-6)}`;
      const amt = new Prisma.Decimal(transfer.amount);
      const fees = new Prisma.Decimal(0);

      let receivedAmount = Number(transfer.amount);
      let exchangeRate = 1;
      const targetCurrency = (transfer.targetCurrency ?? currency) as CurrencyCode;

      if (targetCurrency !== currency) {
        receivedAmount = await this.rates.convert(Number(transfer.amount), currency, targetCurrency);
        exchangeRate = receivedAmount / Number(transfer.amount);
      }

      await this.wallets.debit(
        userWallet.id,
        Number(transfer.amount),
        `Virement programmé #${reference}`,
        undefined,
      );

      const tx = await this.prisma.transaction.create({
        data: {
          reference,
          type: 'SCHEDULED',
          amount: amt,
          fees,
          total: amt.plus(fees),
          currency,
          targetCurrency,
          exchangeRate,
          receivedAmount: new Prisma.Decimal(receivedAmount),
          status: 'VALIDATED',
          payoutMethod: (transfer.payoutMethod as any) ?? 'CASH_PICKUP',
          senderId: user.id,
          beneficiaryId: transfer.beneficiaryId ?? null,
          clientId: transfer.clientId,
          scheduledTransferId: transfer.id,
          note: transfer.note ?? null,
          providerRef: reference,
        },
      });

      const nextDate = this.calculateNextDate(transfer.nextExecutionAt, transfer.frequency);
      const newCount = (transfer.executionCount ?? 0) + 1;
      const isDone =
        transfer.frequency === 'ONCE' ||
        (transfer.maxExecutions !== null && newCount >= transfer.maxExecutions);

      await this.prisma.scheduledTransfer.update({
        where: { id: transfer.id },
        data: {
          executionCount: newCount,
          lastExecutedAt: new Date(),
          failureCount: 0,
          failureReason: null,
          nextExecutionAt: nextDate ?? undefined,
          status: isDone ? ScheduledStatus.COMPLETED : ScheduledStatus.ACTIVE,
        },
      });

      this.logger.log(`✅ Virement programmé exécuté : ${transfer.id} (tx: ${tx.id})`);

      await this.push.notifyScheduledTransferExecuted(
        user.id,
        `${transfer.amount}`,
        currency,
        transfer.beneficiary?.fullName ?? 'Bénéficiaire',
      );

      if (user.email) {
        await this.mail.sendEmail(
          user.email,
          'Virement programmé exécuté 📅',
          `<p>Votre virement de <strong>${transfer.amount} ${currency}</strong> vers ` +
            `<strong>${transfer.beneficiary?.fullName ?? 'votre bénéficiaire'}</strong> a été exécuté.</p>` +
            (nextDate && !isDone
              ? `<p>Prochaine exécution : <strong>${nextDate.toLocaleDateString('fr-FR')}</strong></p>`
              : ''),
        );
      }
    } catch (error: any) {
      const errMsg = error?.message ?? String(error);
      this.logger.error(`❌ Échec virement programmé ${transfer.id}: ${errMsg}`);

      const newFailureCount = (transfer.failureCount ?? 0) + 1;
      const shouldPause = newFailureCount >= MAX_CONSECUTIVE_FAILURES;

      await this.prisma.scheduledTransfer.update({
        where: { id: transfer.id },
        data: {
          failureCount: newFailureCount,
          failureReason: errMsg,
          status: shouldPause ? ScheduledStatus.FAILED : ScheduledStatus.ACTIVE,
          nextExecutionAt: shouldPause
            ? transfer.nextExecutionAt
            : (this.calculateNextDate(transfer.nextExecutionAt, transfer.frequency) ?? transfer.nextExecutionAt),
        },
      });

      if (transfer.user?.id) {
        await this.push.notifyScheduledTransferFailed(transfer.user.id, errMsg);
      }
    }
  }

  private calculateNextDate(current: Date, frequency: ScheduledFrequency): Date | null {
    if (frequency === 'ONCE') return null;
    const next = new Date(current);
    switch (frequency) {
      case 'DAILY':    next.setDate(next.getDate() + 1);   break;
      case 'WEEKLY':   next.setDate(next.getDate() + 7);   break;
      case 'BIWEEKLY': next.setDate(next.getDate() + 14);  break;
      case 'MONTHLY':  next.setMonth(next.getMonth() + 1); break;
      default: return null;
    }
    return next;
  }

  private serialize(t: any) {
    return {
      id: t.id,
      userId: t.userId,
      clientId: t.clientId,
      beneficiaryId: t.beneficiaryId,
      beneficiary: t.beneficiary ?? null,
      amount: Number(t.amount),
      currency: t.currency,
      targetCurrency: t.targetCurrency,
      payoutMethod: t.payoutMethod,
      note: t.note,
      frequency: t.frequency,
      status: t.status,
      nextExecutionAt: t.nextExecutionAt,
      lastExecutedAt: t.lastExecutedAt,
      executionCount: t.executionCount,
      maxExecutions: t.maxExecutions,
      failureCount: t.failureCount,
      failureReason: t.failureReason,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }
}