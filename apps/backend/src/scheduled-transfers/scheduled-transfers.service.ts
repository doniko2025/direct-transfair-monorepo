// apps/backend/src/scheduled-transfers/scheduled-transfers.service.ts
// =========================================================
// SCHEDULED TRANSFERS SERVICE v4.6
// ✅ v4.6 : l'envoi créé à chaque échéance porte son pays de destination (Transaction.receiveCountry) et une échéance de code
//   de 5 mois (pickupExpiry), comme un envoi manuel. Un virement cash dont le bénéficiaire n'a pas de pays reconnu échoue
//   avec un message clair (au lieu de partir avec la devise XOF par défaut) ; sa devise de paiement est celle du pays.
// ✅ v4.5 (audit, point faible) : MONTHLY ne déborde plus sur le mois suivant. setMonth(+1) depuis le 31 janvier donnait
//   le 3 mars (le 31 février n'existe pas) : le virement sautait février et dérivait ensuite sur le 3. Le jour est maintenant
//   ramené au dernier jour du mois (31 janv. → 28 ou 29 févr.). Limite connue : le jour d'origine n'étant pas mémorisé,
//   un virement du 31 reste sur le 28 après février (il faudrait une colonne « jour d'ancrage » pour le retrouver).
// ✅ v4.4 (phase 6) : exécution fiabilisée
//   (1) 🚨 Double exécution : le cron passe toutes les 5 min et deux instances peuvent tourner ensemble ; rien
//       n'empêchait deux passages d'exécuter le même virement (débit en double). L'échéance est maintenant
//       « réservée » par un updateMany conditionné (statut ACTIVE + nextExecutionAt lu) DANS la même transaction
//       SQL que le débit et la création de l'envoi : un seul passage gagne, l'autre ne fait rien.
//   (2) Débit, ligne Transaction et mise à jour de l'échéancier : une seule transaction SQL (avant : trois étapes ;
//       une panne entre le débit et la création laissait l'argent débité sans envoi).
//   (3) Les frais viennent du barème de la société (FeeScheduleService) : ils étaient fixés à 0.
//   (4) Le statut suit le seuil de validation réglé par la société (VALIDATED jusqu'au seuil, sinon PENDING) :
//       il était toujours VALIDATED.
//   (5) Les plafonds d'envoi du client (niveau KYC) sont contrôlés à chaque exécution.
//   (6) Une notification (push / e-mail) qui échoue APRÈS un succès ne fait plus passer le virement pour un échec
//       (avant : l'échéance était décalée une 2ᵉ fois et le virement pouvait finir en FAILED).
//   (7) Compte expéditeur désactivé ou suspendu : l'exécution échoue proprement.
//   (8) create() : date de départ absente → prochain passage du planificateur (avant : « Invalid Date »).
//   (9) Le corps de POST /scheduled-transfers est validé (CreateScheduledTransferDto) et seul le retrait cash est
//       accepté : les autres modes n'avaient aucun crédit côté destinataire.
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

import * as crypto from 'crypto';

import type { CreateScheduledTransferDto } from './dto/create-scheduled-transfer.dto';
import { toIso2 } from '../fee-schedule/countries';
import { currencyOfCountry } from '../fee-schedule/country-currency';
import { pickupExpiryFrom } from '../transactions/pickup-rules';
import { FeeScheduleService } from '../fee-schedule/fee-schedule.service';
import { PrismaService } from '../prisma/prisma.service';
import { TransferLimitsService } from '../transfer-limits/transfer-limits.service';
import { ValidationThresholdsService } from '../validation-thresholds/validation-thresholds.service';
import { WalletsService } from '../wallets/wallets.service';
import { RatesService } from '../rates/rates.service';
import { PushService } from '../push/push.service';
import { MailService } from '../mail/mail.service';

// Corps validé par dto/create-scheduled-transfer.dto.ts
export type { CreateScheduledTransferDto } from './dto/create-scheduled-transfer.dto';

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
    private readonly feeSchedule: FeeScheduleService,
    private readonly thresholds: ValidationThresholdsService,
    private readonly transferLimits: TransferLimitsService,
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

    // v4.4 — sans date de départ : exécution au prochain passage du planificateur.
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date(Date.now() + 60_000);
    if (Number.isNaN(startDate.getTime())) throw new BadRequestException('Date de départ invalide');
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
      if (!user.isActive || user.isSuspended || user.deletedAt) throw new Error('Compte expéditeur désactivé ou suspendu');

      const currency = transfer.currency as CurrencyCode;
      const userWallet = user.wallets?.find((w: any) => w.currency === currency && w.isActive);
      if (!userWallet) throw new Error(`Wallet ${currency} introuvable pour l'utilisateur`);

      const reference = `SCHED-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      const amt = new Prisma.Decimal(transfer.amount);
      const payoutMethod = (transfer.payoutMethod as any) ?? 'CASH_PICKUP';

      // v4.4 — frais du barème de la société (avant : 0) et statut selon le seuil réglé par la société.
      const quote = await this.feeSchedule.quote({
        clientId: transfer.clientId,
        senderId: user.id,
        payoutMethod,
        amount: Number(amt),
        currency,
        receiveCountry: toIso2(transfer.beneficiary?.country ?? null),
      });
      const fees = new Prisma.Decimal(quote.fees);
      const total = amt.plus(fees);

      const threshold = new Prisma.Decimal(await this.thresholds.thresholdFor(transfer.clientId, currency));
      const status = amt.lte(threshold) ? 'VALIDATED' : 'PENDING';

      // v4.6 — pays de destination ; un virement cash se paie dans ce pays, dans sa devise.
      const receiveCountry = toIso2(transfer.beneficiary?.country ?? null);
      if (payoutMethod === 'CASH_PICKUP' && !receiveCountry) {
        throw new Error(
          `Pays du bénéficiaire non reconnu${transfer.beneficiary?.country ? ` (« ${transfer.beneficiary.country} »)` : ''} : ` +
          `corrigez le bénéficiaire pour que le code puisse être payé au bon endroit.`,
        );
      }
      const cashCurrency = payoutMethod === 'CASH_PICKUP' && receiveCountry
        ? ((currencyOfCountry(receiveCountry) as CurrencyCode | null) ?? null)
        : null;

      let receivedAmount = Number(transfer.amount);
      let exchangeRate = 1;
      const targetCurrency = (cashCurrency ?? transfer.targetCurrency ?? currency) as CurrencyCode;

      if (targetCurrency !== currency) {
        receivedAmount = await this.rates.convert(Number(transfer.amount), currency, targetCurrency);
        exchangeRate = receivedAmount / Number(transfer.amount);
      }

      const nextDate = this.calculateNextDate(transfer.nextExecutionAt, transfer.frequency);
      const newCount = (transfer.executionCount ?? 0) + 1;
      const isDone =
        transfer.frequency === 'ONCE' ||
        (transfer.maxExecutions != null && newCount >= transfer.maxExecutions);

      // v4.4 — UNE transaction SQL : réservation de l'échéance, envoi, débit, plafonds.
      const tx = await this.prisma.$transaction(async (db) => {
        const claimed = await db.scheduledTransfer.updateMany({
          where: { id: transfer.id, status: ScheduledStatus.ACTIVE, nextExecutionAt: transfer.nextExecutionAt },
          data: {
            executionCount: newCount,
            lastExecutedAt: new Date(),
            failureCount: 0,
            failureReason: null,
            nextExecutionAt: nextDate ?? undefined,
            status: isDone ? ScheduledStatus.COMPLETED : ScheduledStatus.ACTIVE,
          },
        });
        // Déjà exécuté par un autre passage, suspendu ou annulé entre-temps : on ne fait rien.
        if (claimed.count !== 1) return null;

        const created = await db.transaction.create({
          data: {
            reference,
            type: 'SCHEDULED',
            amount: amt,
            fees,
            total,
            currency,
            targetCurrency,
            exchangeRate,
            receivedAmount: new Prisma.Decimal(receivedAmount),
            status,
            payoutMethod,
            senderId: user.id,
            beneficiaryId: transfer.beneficiaryId ?? null,
            clientId: transfer.clientId,
            scheduledTransferId: transfer.id,
            note: transfer.note ?? null,
            providerRef: reference,
            receiveCountry,                    // v4.6
            pickupExpiry: pickupExpiryFrom(),  // v4.6 — code valable 5 mois
          },
        });

        await this.wallets.debitInTx(db, userWallet.id, Number(total), `Virement programmé #${reference}`, created.id);
        await this.transferLimits.assertWithinLimits(db, {
          clientId: transfer.clientId,
          userId: user.id,
          currency,
          amount: Number(amt),
          excludeTransactionId: created.id,
        });
        return created;
      });

      if (!tx) {
        this.logger.log(`↩️ Virement programmé ${transfer.id} déjà traité par un autre passage : ignoré`);
        return;
      }
      this.logger.log(`✅ Virement programmé exécuté : ${transfer.id} (tx: ${tx.id})`);

      // v4.4 — le virement est exécuté : une notification qui échoue ne doit pas le faire passer pour un échec.
      try {
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
      } catch (notifyError: any) {
        this.logger.warn(`Notification du virement programmé ${transfer.id} non envoyée : ${notifyError?.message ?? notifyError}`);
      }
    } catch (error: any) {
      const errMsg = error?.message ?? String(error);
      this.logger.error(`❌ Échec virement programmé ${transfer.id}: ${errMsg}`);

      const newFailureCount = (transfer.failureCount ?? 0) + 1;
      const shouldPause = newFailureCount >= MAX_CONSECUTIVE_FAILURES;

      // v4.4 — conditionné à l'échéance lue : si un autre passage a exécuté ce virement entre-temps,
      // on n'écrase pas son état.
      const marked = await this.prisma.scheduledTransfer.updateMany({
        where: { id: transfer.id, status: ScheduledStatus.ACTIVE, nextExecutionAt: transfer.nextExecutionAt },
        data: {
          failureCount: newFailureCount,
          failureReason: errMsg,
          status: shouldPause ? ScheduledStatus.FAILED : ScheduledStatus.ACTIVE,
          nextExecutionAt: shouldPause
            ? transfer.nextExecutionAt
            : (this.calculateNextDate(transfer.nextExecutionAt, transfer.frequency) ?? transfer.nextExecutionAt),
        },
      });

      if (marked.count === 1 && transfer.user?.id) {
        try {
          await this.push.notifyScheduledTransferFailed(transfer.user.id, errMsg);
        } catch (notifyError: any) {
          this.logger.warn(`Notification d'échec du virement programmé ${transfer.id} non envoyée : ${notifyError?.message ?? notifyError}`);
        }
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
      case 'MONTHLY': {
        const day = next.getDate();
        next.setDate(1);                      // évite le débordement pendant le changement de mois
        next.setMonth(next.getMonth() + 1);
        const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(day, lastDay));
        break;
      }
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