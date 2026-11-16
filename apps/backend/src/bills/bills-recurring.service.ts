// apps/backend/src/bills/bills-recurring.service.ts
// =========================================================
// FACTURES RÉCURRENTES ET RAPPELS D'ÉCHÉANCE (lot 14b) — loyer, abonnements, scolarité mensuelle, assurance annuelle…
//
//   REMIND  le client programme une facture ; à l'approche de l'échéance (jours réglés par la société) puis le jour J il reçoit un
//           rappel qui ouvre « Mes factures programmées ». Il paie lui-même : code secret à chaque paiement, comme d'habitude.
//   AUTO    le client confirme UNE fois avec son code secret (consentement horodaté) ; chaque échéance est ensuite payée seule, avec
//           les mêmes contrôles qu'un paiement manuel (module ouvert, facturier actif, plafonds, KYC, solde). Réservé aux sociétés
//           qui ont ouvert le prélèvement automatique. Le client peut mettre en pause ou supprimer à tout moment.
//
// Sûretés
//   • Une clé d'idempotence par échéance (« sched-<id>-<date> ») : deux instances ou un redémarrage ne débitent jamais deux fois.
//   • Échec (solde, plafond, facturier fermé…) : le client est prévenu, nouvelle tentative 6 h plus tard ; après N échecs (réglage
//     société) la programmation est mise en PAUSE — jamais de débit répété indéfiniment.
//   • Échéance manquée de plus de 3 jours (service fermé, panne) : elle est SAUTÉE et signalée, on ne prélève pas avec retard.
//   • Prélèvement automatique refermé par la société : l'échéance devient un simple rappel (le client paie à la main).
//   • Chaque société ne voit/traite que ses clients ; la tâche planifiée peut être coupée sur une instance : BILLS_RECURRING_CRON=false.
// =========================================================

import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, type BillSchedule, type Biller } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { CompanySettingsService } from '../company-settings/company-settings.service';
import type { CompanySettings } from '../company-settings/company-settings.logic';
import { KycGuardService } from '../kyc/kyc-guard.service';
import { formatMoney } from '../merchants/merchant-notifier.service';
import { assertValidAmount, assertWithinBounds } from '../merchants/merchant-rules';
import { PinVerifierService } from '../merchants/pin-verifier.service';
import { PrismaService } from '../prisma/prisma.service';
import { SUPPORTED_CURRENCIES } from '../wallets/wallets.service';
import { assertReference, cleanFieldValues, readFieldDefs } from './bills.rules';
import {
  assertEndDay, anchorDayOf, firstOccurrence, isPastEnd, isRunnable, nextOccurrence, nextOccurrenceAfter, recurringHourUtc,
  reminderDue, RETRY_AFTER_HOURS, scheduleIdempotencyKey, type ScheduleFrequency, type ScheduleMode,
} from './bills.schedule';
import { BillsService, maskCustomerName } from './bills.service';
import { BillsNotifierService } from './bills-notifier.service';
import type { CreateBillScheduleDto, ResumeBillScheduleDto, UpdateBillScheduleDto } from './dto/bills.dto';

/** Une échéance non traitée depuis plus longtemps est sautée au lieu d'être prélevée avec retard. */
export const MAX_LATE_DAYS = 3;
const DAY_MS = 24 * 3_600_000;
const BATCH = 200;

const ACTOR_SELECT = { id: true, email: true, firstName: true, role: true, kycLevel: true, clientId: true, isActive: true, isSuspended: true, deletedAt: true, primaryCurrency: true } as const;

/** Message lisible d'une erreur (corps d'une HttpException, sinon message brut). */
export function errorText(err: unknown): string {
  if (err instanceof HttpException) {
    const r = err.getResponse();
    const m = typeof r === 'string' ? r : (r as { message?: string | string[] }).message;
    return (Array.isArray(m) ? m.join(' ') : m) || err.message;
  }
  return (err as Error)?.message || 'Erreur inconnue';
}

type ScheduleWithBiller = BillSchedule & { biller: Biller };

@Injectable()
export class BillsRecurringService {
  private readonly logger = new Logger(BillsRecurringService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: CompanySettingsService,
    private readonly bills: BillsService,
    private readonly kyc: KycGuardService,
    private readonly pins: PinVerifierService,
    private readonly notifier: BillsNotifierService,
  ) {}

  // ── Utilitaires ────────────────────────────────────────

  private async actor(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: ACTOR_SELECT });
    if (!u || !u.clientId || u.deletedAt || !u.isActive || u.isSuspended) throw new ForbiddenException('Compte indisponible.');
    if (u.role !== 'USER') throw new ForbiddenException('Seuls les clients peuvent programmer des factures.');
    return u as typeof u & { clientId: number };
  }

  private async assertOpen(clientId: number): Promise<CompanySettings> {
    const s = await this.settings.forClient(clientId);
    if (!s.bills.enabled) throw new ForbiddenException("Le paiement de factures n'est pas disponible pour le moment.");
    if (!s.bills.recurring.enabled) throw new ForbiddenException("Les factures récurrentes ne sont pas disponibles pour le moment.");
    return s;
  }

  private async mine(userId: string, id: string): Promise<ScheduleWithBiller> {
    const row = await this.prisma.billSchedule.findFirst({ where: { id, userId }, include: { biller: true } });
    if (!row) throw new NotFoundException('Facture programmée introuvable.');
    return row;
  }

  private async audit(userId: string, clientId: number, entityId: string, details: Record<string, unknown>) {
    try {
      await this.prisma.auditLog.create({ data: { userId, clientId, action: 'BILL_SCHEDULE', entity: 'BillSchedule', entityId, details: details as Prisma.InputJsonValue, successful: true } });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (programmation ${entityId}) : ${(err as Error).message}`);
    }
  }

  /** Vue renvoyée à l'application. */
  view(s: ScheduleWithBiller) {
    const values = (s.fields ?? {}) as Record<string, string>;
    return {
      id: s.id,
      label: s.label,
      biller: { id: s.biller.id, name: s.biller.name, category: s.biller.category, currency: s.biller.currency },
      available: s.biller.status === 'ACTIVE',
      referenceLabel: s.biller.referenceLabel,
      accountRef: s.accountRef,
      customerName: s.customerName,
      fields: readFieldDefs(s.biller.fields).filter((d) => values[d.key]).map((d) => ({ label: d.label, value: values[d.key] })),
      /** Valeurs brutes par clé de champ : l'application les réutilise pour préremplir « Payer maintenant ». */
      fieldValues: values,
      amount: s.amount === null ? null : Number(s.amount),
      amountFromBiller: s.biller.amountMode === 'FROM_LOOKUP',
      currency: s.biller.currency,
      walletCurrency: s.walletCurrency,
      frequency: s.frequency,
      mode: s.mode,
      status: s.status,
      nextRunAt: s.nextRunAt,
      endAt: s.endAt,
      failureCount: s.failureCount,
      lastError: s.lastError,
      lastRunAt: s.lastRunAt,
      lastPaymentId: s.lastPaymentId,
      runsCount: s.runsCount,
      createdAt: s.createdAt,
    };
  }

  /** Contrôles communs à tout prélèvement automatique : option ouverte par la société, identité vérifiée, code secret. */
  private async assertAutoConsent(actor: { id: string; role: string; kycLevel: unknown; clientId: number }, s: CompanySettings, pin: string | undefined) {
    if (!s.bills.recurring.autoDebitEnabled) throw new ForbiddenException("Le prélèvement automatique n'est pas disponible : vous pouvez programmer un rappel à la place.");
    if (!pin) throw new BadRequestException('Code secret requis pour autoriser le prélèvement automatique.');
    await this.kyc.assertVerified({ id: actor.id, role: actor.role as never, kycLevel: String(actor.kycLevel) });
    await this.pins.assertPin(actor.id, pin);
  }

  // ── API du client ──────────────────────────────────────

  async list(user: AuthUserPayload) {
    const actor = await this.actor(user.id);
    const s = await this.settings.forClient(actor.clientId);
    const rows = await this.prisma.billSchedule.findMany({
      where: { userId: actor.id, biller: { clientId: actor.clientId } },
      include: { biller: true },
      orderBy: [{ status: 'asc' }, { nextRunAt: 'asc' }],
      take: 100,
    });
    return {
      enabled: s.bills.enabled && s.bills.recurring.enabled,
      autoDebitEnabled: s.bills.recurring.autoDebitEnabled,
      maxPerClient: s.bills.recurring.maxPerClient,
      remindDaysBefore: s.bills.recurring.remindDaysBefore,
      data: rows.map((r) => this.view(r)),
    };
  }

  async create(user: AuthUserPayload, dto: CreateBillScheduleDto) {
    const actor = await this.actor(user.id);
    const s = await this.assertOpen(actor.clientId);
    const biller = await this.prisma.biller.findFirst({ where: { id: dto.billerId, clientId: actor.clientId, status: 'ACTIVE' } });
    if (!biller) throw new NotFoundException('Facturier introuvable ou indisponible.');

    const active = await this.prisma.billSchedule.count({ where: { userId: actor.id, status: { not: 'ENDED' } } });
    if (active >= s.bills.recurring.maxPerClient) throw new BadRequestException(`${s.bills.recurring.maxPerClient} factures programmées au maximum : supprimez-en une.`);

    const mode = dto.mode as ScheduleMode;
    const reference = assertReference(biller, dto.reference);
    const fields = cleanFieldValues(readFieldDefs(biller.fields), dto.fields);

    let amount: number | null = null;
    if (biller.amountMode === 'FREE') {
      amount = assertValidAmount(dto.amount, biller.currency);
      assertWithinBounds(amount, biller.currency, { min: biller.minAmount ? Number(biller.minAmount) : undefined, max: biller.maxAmount ? Number(biller.maxAmount) : undefined }, 'montant de la facture');
      const cap = s.bills.maxPerPayment[biller.currency];
      if (cap !== undefined && amount > cap) throw new BadRequestException(`Une facture ne peut pas dépasser ${formatMoney(cap, biller.currency)}.`);
    }

    const walletCurrency = dto.walletCurrency ? dto.walletCurrency.toUpperCase() : null;
    if (walletCurrency && !(SUPPORTED_CURRENCIES as readonly string[]).includes(walletCurrency)) throw new BadRequestException('Devise du portefeuille non prise en charge.');

    const hour = recurringHourUtc();
    const frequency = dto.frequency as ScheduleFrequency;
    const first = firstOccurrence(dto.startDate, new Date(), hour);
    const end = assertEndDay(dto.endDate, first, hour);

    if (mode === 'AUTO') await this.assertAutoConsent(actor, s, dto.pin);

    const created = await this.prisma.billSchedule.create({
      data: {
        clientId: actor.clientId,
        userId: actor.id,
        billerId: biller.id,
        label: dto.label.trim().slice(0, 60),
        accountRef: reference,
        fields: Object.keys(fields).length ? (fields as Prisma.InputJsonValue) : Prisma.JsonNull,
        customerName: dto.customerName ? maskCustomerName(dto.customerName) : null,
        amount,
        walletCurrency: (walletCurrency ?? undefined) as never,
        frequency,
        anchorDay: anchorDayOf(first, frequency),
        mode,
        nextRunAt: first,
        endAt: end,
        consentAt: mode === 'AUTO' ? new Date() : null,
      },
      include: { biller: true },
    });
    await this.audit(actor.id, actor.clientId, created.id, { step: 'CREATE', biller: biller.name, frequency, mode, amount, first: first.toISOString() });
    return this.view(created);
  }

  async update(user: AuthUserPayload, id: string, dto: UpdateBillScheduleDto) {
    const actor = await this.actor(user.id);
    const current = await this.mine(actor.id, id);
    if (current.status === 'ENDED') throw new ConflictException('Cette facture programmée est terminée.');
    const s = await this.assertOpen(actor.clientId);

    const data: Prisma.BillScheduleUpdateInput = {};
    if (dto.label !== undefined) data.label = dto.label.trim().slice(0, 60);

    let amountChanged = false;
    if (dto.amount !== undefined) {
      if (current.biller.amountMode !== 'FREE') throw new BadRequestException('Le montant est fourni par le facturier.');
      const amount = assertValidAmount(dto.amount, current.biller.currency);
      assertWithinBounds(amount, current.biller.currency, { min: current.biller.minAmount ? Number(current.biller.minAmount) : undefined, max: current.biller.maxAmount ? Number(current.biller.maxAmount) : undefined }, 'montant de la facture');
      const cap = s.bills.maxPerPayment[current.biller.currency];
      if (cap !== undefined && amount > cap) throw new BadRequestException(`Une facture ne peut pas dépasser ${formatMoney(cap, current.biller.currency)}.`);
      amountChanged = current.amount === null || Number(current.amount) !== amount;
      data.amount = amount;
    }

    if (dto.endDate !== undefined) {
      data.endAt = dto.endDate === '' ? null : assertEndDay(dto.endDate, current.nextRunAt, recurringHourUtc());
    }

    const newMode = (dto.mode ?? current.mode) as ScheduleMode;
    const needsConsent = newMode === 'AUTO' && (current.mode !== 'AUTO' || amountChanged);
    if (needsConsent) {
      await this.assertAutoConsent(actor, s, dto.pin);
      data.consentAt = new Date();
    }
    if (dto.mode !== undefined) data.mode = newMode;
    if (newMode === 'REMIND') data.consentAt = null;

    const updated = await this.prisma.billSchedule.update({ where: { id }, data, include: { biller: true } });
    await this.audit(actor.id, actor.clientId, id, { step: 'UPDATE', changes: Object.keys(data), mode: newMode });
    return this.view(updated);
  }

  async pause(user: AuthUserPayload, id: string) {
    const actor = await this.actor(user.id);
    const current = await this.mine(actor.id, id);
    if (current.status !== 'ACTIVE') return this.view(current);
    const updated = await this.prisma.billSchedule.update({ where: { id }, data: { status: 'PAUSED' }, include: { biller: true } });
    await this.audit(actor.id, actor.clientId, id, { step: 'PAUSE' });
    return this.view(updated);
  }

  async resume(user: AuthUserPayload, id: string, dto: ResumeBillScheduleDto) {
    const actor = await this.actor(user.id);
    const current = await this.mine(actor.id, id);
    if (current.status === 'ENDED') throw new ConflictException('Cette facture programmée est terminée.');
    if (current.status === 'ACTIVE') return this.view(current);
    const s = await this.assertOpen(actor.clientId);
    if (current.mode === 'AUTO') await this.assertAutoConsent(actor, s, dto.pin);

    // Reprise : on ne prélève jamais une échéance passée pendant la pause.
    const now = new Date();
    const next = current.nextRunAt.getTime() > now.getTime() ? current.nextRunAt : nextOccurrenceAfter(current.nextRunAt, now, current.frequency, current.anchorDay);
    const ended = isPastEnd(next, current.endAt);
    const updated = await this.prisma.billSchedule.update({
      where: { id },
      data: { status: ended ? 'ENDED' : 'ACTIVE', nextRunAt: next, failureCount: 0, retryAt: null, lastError: null, ...(current.mode === 'AUTO' ? { consentAt: now } : {}) },
      include: { biller: true },
    });
    await this.audit(actor.id, actor.clientId, id, { step: 'RESUME', next: next.toISOString() });
    return this.view(updated);
  }

  async remove(user: AuthUserPayload, id: string) {
    const actor = await this.actor(user.id);
    const res = await this.prisma.billSchedule.deleteMany({ where: { id, userId: actor.id } });
    if (res.count !== 1) throw new NotFoundException('Facture programmée introuvable.');
    await this.audit(actor.id, actor.clientId, id, { step: 'DELETE' });
    return { removed: true };
  }

  // ── Planificateur ──────────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async cron(): Promise<void> {
    if (String(process.env.BILLS_RECURRING_CRON ?? '').trim().toLowerCase() === 'false') return;
    try {
      await this.sweep();
    } catch (err) {
      this.logger.error(`Balayage des factures récurrentes interrompu : ${errorText(err)}`);
    }
  }

  /** Traite les échéances arrivées puis envoie les rappels. Exposé pour les tests. Un seul balayage à la fois par instance. */
  async sweep(now: Date = new Date()): Promise<{ processed: number; reminded: number }> {
    if (this.running) return { processed: 0, reminded: 0 };
    this.running = true;
    const cache = new Map<number, CompanySettings>();
    const settingsOf = async (clientId: number) => {
      let v = cache.get(clientId);
      if (!v) {
        v = await this.settings.forClient(clientId);
        cache.set(clientId, v);
      }
      return v;
    };
    let processed = 0;
    let reminded = 0;
    try {
      const due = await this.prisma.billSchedule.findMany({
        where: { status: 'ACTIVE', nextRunAt: { lte: now }, OR: [{ retryAt: null }, { retryAt: { lte: now } }] },
        include: { biller: true },
        orderBy: { nextRunAt: 'asc' },
        take: BATCH,
      });
      for (const row of due) {
        if (!isRunnable({ nextRunAt: row.nextRunAt, retryAt: row.retryAt, now })) continue;
        try {
          await this.processDue(row, now, await settingsOf(row.clientId));
          processed += 1;
        } catch (err) {
          this.logger.error(`Programmation ${row.id} : ${errorText(err)}`);
        }
      }

      const horizon = new Date(now.getTime() + 14 * DAY_MS);
      const upcoming = await this.prisma.billSchedule.findMany({
        where: { status: 'ACTIVE', nextRunAt: { gt: now, lte: horizon } },
        include: { biller: true },
        orderBy: { nextRunAt: 'asc' },
        take: BATCH * 2,
      });
      for (const row of upcoming) {
        const cfg = await settingsOf(row.clientId);
        if (!cfg.bills.enabled || !cfg.bills.recurring.enabled) continue;
        if (!reminderDue({ nextRunAt: row.nextRunAt, remindedFor: row.remindedFor, remindDays: cfg.bills.recurring.remindDaysBefore, now })) continue;
        try {
          if (await this.remind(row, 'SOON', cfg)) reminded += 1;
        } catch (err) {
          this.logger.error(`Rappel ${row.id} : ${errorText(err)}`);
        }
      }
      if (processed + reminded > 0) this.logger.log(`🔁 Factures récurrentes : ${processed} échéance(s) traitée(s), ${reminded} rappel(s).`);
      return { processed, reminded };
    } finally {
      this.running = false;
    }
  }

  private async userOf(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, firstName: true } });
  }

  /** Rappel au client. Renvoie false si le client n'existe plus. « SOON » : échéance proche · « DUE » : c'est aujourd'hui. */
  private async remind(row: ScheduleWithBiller, when: 'SOON' | 'DUE', cfg: CompanySettings): Promise<boolean> {
    const user = await this.userOf(row.userId);
    if (!user) return false;
    const amountText = row.amount === null ? 'montant à confirmer' : formatMoney(Number(row.amount), row.biller.currency);
    const day = row.nextRunAt.toISOString().slice(0, 10);
    await this.notifier.notifyUser(user, {
      kind: 'BILL_REMINDER',
      title: when === 'DUE' ? `À payer aujourd'hui : ${row.label}` : `Échéance proche : ${row.label}`,
      body: `${row.biller.name} · ${amountText}${when === 'DUE' ? '' : ` · le ${day}`}.${row.mode === 'AUTO' && cfg.bills.recurring.autoDebitEnabled ? ' Le paiement sera prélevé automatiquement.' : ' Ouvrez Mes factures programmées pour payer.'}`,
      actionUrl: '/bills/schedules',
      actionLabel: 'Mes factures programmées',
      type: 'INFO',
      email: when === 'DUE',
    });
    if (when === 'SOON') await this.prisma.billSchedule.update({ where: { id: row.id }, data: { remindedFor: row.nextRunAt } });
    return true;
  }

  /** Avance la programmation à l'échéance suivante (conditionné à la valeur lue : un seul passage gagne). */
  private async advance(row: ScheduleWithBiller, now: Date, extra: Prisma.BillScheduleUpdateManyMutationInput = {}): Promise<boolean> {
    const next = nextOccurrenceAfter(row.nextRunAt, now, row.frequency, row.anchorDay);
    const ended = isPastEnd(next, row.endAt);
    const res = await this.prisma.billSchedule.updateMany({
      where: { id: row.id, status: 'ACTIVE', nextRunAt: row.nextRunAt },
      data: { nextRunAt: next, status: ended ? 'ENDED' : 'ACTIVE', retryAt: null, remindedFor: null, ...extra },
    });
    return res.count === 1;
  }

  private async processDue(row: ScheduleWithBiller, now: Date, cfg: CompanySettings): Promise<void> {
    const user = await this.userOf(row.userId);
    if (!user) return;
    const late = now.getTime() - row.nextRunAt.getTime() > MAX_LATE_DAYS * DAY_MS;
    const open = cfg.bills.enabled && cfg.bills.recurring.enabled;

    // Échéance très en retard (panne, service fermé) : sautée et signalée, jamais prélevée tardivement.
    if (late || !open) {
      if (late && open) {
        await this.notifier.notifyUser(user, {
          kind: 'BILL_SCHEDULE_FAILED',
          title: `Échéance manquée : ${row.label}`,
          body: `L'échéance du ${row.nextRunAt.toISOString().slice(0, 10)} n'a pas pu être traitée à temps. Rien n'a été prélevé : payez-la depuis Mes factures si nécessaire.`,
          actionUrl: '/bills/schedules',
          actionLabel: 'Mes factures programmées',
          type: 'WARNING',
          email: false,
        });
        await this.advance(row, now, { lastError: 'Échéance manquée (non traitée à temps).' });
      }
      return;
    }

    // Rappel simple, ou prélèvement automatique refermé par la société : le client paie à la main.
    if (row.mode !== 'AUTO' || !cfg.bills.recurring.autoDebitEnabled) {
      if (await this.advance(row, now, { lastRunAt: now })) await this.remind(row, 'DUE', cfg);
      return;
    }

    // Prélèvement automatique.
    try {
      const paid = await this.bills.payForSchedule(row.userId, row.billerId, row.id, {
        reference: row.accountRef,
        fields: (row.fields ?? undefined) as Record<string, unknown> | undefined,
        amount: row.amount === null ? 0 : Number(row.amount),
        walletCurrency: row.walletCurrency ?? undefined,
        idempotencyKey: scheduleIdempotencyKey(row.id, row.nextRunAt),
      });
      const won = await this.advance(row, now, { lastRunAt: now, lastPaymentId: paid.id, failureCount: 0, lastError: null, runsCount: { increment: 1 } });
      if (won) await this.audit(row.userId, row.clientId, row.id, { step: 'RUN', paymentId: paid.id, due: row.nextRunAt.toISOString() });
    } catch (err) {
      await this.onFailure(row, user, now, cfg, errorText(err));
    }
  }

  private async onFailure(row: ScheduleWithBiller, user: { id: string; email: string | null; firstName: string | null }, now: Date, cfg: CompanySettings, reason: string) {
    const failures = row.failureCount + 1;
    const pause = failures >= cfg.bills.recurring.maxFailures;
    await this.prisma.billSchedule.updateMany({
      where: { id: row.id, status: 'ACTIVE', nextRunAt: row.nextRunAt },
      data: {
        failureCount: failures,
        lastError: reason.slice(0, 300),
        lastRunAt: now,
        retryAt: pause ? null : new Date(now.getTime() + RETRY_AFTER_HOURS * 3_600_000),
        ...(pause ? { status: 'PAUSED' as const } : {}),
      },
    });
    await this.notifier.notifyUser(user, {
      kind: pause ? 'BILL_SCHEDULE_PAUSED' : 'BILL_SCHEDULE_FAILED',
      title: pause ? `Prélèvement suspendu : ${row.label}` : `Paiement impossible : ${row.label}`,
      body: pause
        ? `${reason} Après ${failures} essais, la facture programmée est en pause. Rien n'a été prélevé. Relancez-la quand c'est réglé.`
        : `${reason} Nouvelle tentative dans ${RETRY_AFTER_HOURS} h. Rien n'a été prélevé.`,
      actionUrl: '/bills/schedules',
      actionLabel: 'Mes factures programmées',
      type: 'WARNING',
      email: pause,
    });
  }

  // Exposés pour les tests.
  readonly _next = nextOccurrence;
}
