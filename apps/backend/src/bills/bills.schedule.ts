// apps/backend/src/bills/bills.schedule.ts
// =========================================================
// RÈGLES PURES DES FACTURES RÉCURRENTES (lot 14b) — aucune lecture en base, entièrement testables.
//   fréquences · calcul de l'échéance suivante (sans dérive de jour) · rappel dû ou non · ré-essai après échec
//
// Jour d'ancrage : un loyer du 31 tombe le 28 (ou 29) février, puis revient le 31 mars — l'échéance suivante est calculée depuis
// le jour d'ancrage, jamais depuis la date précédente (la dérive « 31 → 28 → 28 » du virement programmé est évitée ici).
// Toutes les échéances tombent à la même heure UTC (BILLS_RECURRING_HOUR_UTC, 8 h par défaut) : le planificateur passe chaque heure.
// =========================================================

import { BadRequestException } from '@nestjs/common';

export const SCHEDULE_FREQUENCIES = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const;
export type ScheduleFrequency = (typeof SCHEDULE_FREQUENCIES)[number];

export const SCHEDULE_MODES = ['REMIND', 'AUTO'] as const;
export type ScheduleMode = (typeof SCHEDULE_MODES)[number];

/** Une programmation ne démarre pas plus d'un an à l'avance. */
export const MAX_START_DAYS_AHEAD = 366;
/** Après un échec de prélèvement, nouvelle tentative au bout de N heures. */
export const RETRY_AFTER_HOURS = 6;

const MONTHS_PER_STEP: Record<Exclude<ScheduleFrequency, 'WEEKLY'>, number> = { MONTHLY: 1, QUARTERLY: 3, YEARLY: 12 };

/** Heure UTC des échéances : variable d'environnement BILLS_RECURRING_HOUR_UTC (0–23), 8 par défaut. */
export function recurringHourUtc(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.BILLS_RECURRING_HOUR_UTC);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : 8;
}

const daysInMonth = (year: number, month0: number): number => new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();

/** « 2026-12-31 » → Date UTC à l'heure d'échéance. Lève une 400 claire si la date n'existe pas. */
export function parseDay(raw: string, hourUtc: number): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw ?? '').trim());
  if (!m) throw new BadRequestException('Date invalide : format attendu AAAA-MM-JJ.');
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d, hourUtc, 0, 0, 0));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) throw new BadRequestException('Cette date n\'existe pas.');
  return date;
}

/** Jour d'ancrage d'une date de départ : jour du mois (1–31), ou jour de la semaine ISO (1 = lundi … 7 = dimanche) pour WEEKLY. */
export function anchorDayOf(start: Date, frequency: ScheduleFrequency): number {
  if (frequency === 'WEEKLY') return start.getUTCDay() === 0 ? 7 : start.getUTCDay();
  return start.getUTCDate();
}

/** Échéance qui suit `current`, calculée depuis le jour d'ancrage (jamais depuis le jour précédent). */
export function nextOccurrence(current: Date, frequency: ScheduleFrequency, anchorDay: number): Date {
  if (frequency === 'WEEKLY') return new Date(current.getTime() + 7 * 24 * 3_600_000);
  const total = current.getUTCFullYear() * 12 + current.getUTCMonth() + MONTHS_PER_STEP[frequency];
  const year = Math.floor(total / 12);
  const month0 = total % 12;
  const day = Math.min(Math.max(1, anchorDay), daysInMonth(year, month0));
  return new Date(Date.UTC(year, month0, day, current.getUTCHours(), current.getUTCMinutes(), 0, 0));
}

/** Première échéance strictement postérieure à `now` en partant de `current` (rattrapage : on saute les échéances manquées). */
export function nextOccurrenceAfter(current: Date, now: Date, frequency: ScheduleFrequency, anchorDay: number): Date {
  let next = nextOccurrence(current, frequency, anchorDay);
  for (let i = 0; i < 1000 && next.getTime() <= now.getTime(); i += 1) next = nextOccurrence(next, frequency, anchorDay);
  return next;
}

/** Contrôle de la date de départ choisie par le client : aujourd'hui ou plus tard, dans l'année. Renvoie la première échéance. */
export function firstOccurrence(startDay: string, now: Date, hourUtc: number): Date {
  const first = parseDay(startDay, hourUtc);
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (first.getTime() < todayStart) throw new BadRequestException('La première échéance ne peut pas être dans le passé.');
  if (first.getTime() > now.getTime() + MAX_START_DAYS_AHEAD * 24 * 3_600_000) throw new BadRequestException('La première échéance doit tomber dans les 12 prochains mois.');
  return first;
}

/** Fin facultative : même jour ou après la première échéance. */
export function assertEndDay(endDay: string | undefined | null, first: Date, hourUtc: number): Date | null {
  if (!endDay) return null;
  const end = parseDay(endDay, hourUtc);
  if (end.getTime() < first.getTime()) throw new BadRequestException('La date de fin précède la première échéance.');
  return end;
}

/** Une échéance au-delà de la date de fin met fin à la programmation. */
export const isPastEnd = (next: Date, endAt: Date | null): boolean => !!endAt && next.getTime() > endAt.getTime();

/** Faut-il envoyer le rappel « échéance proche » ? (une seule fois par échéance ; remindDays = 0 → pas de rappel anticipé). */
export function reminderDue(args: { nextRunAt: Date; remindedFor: Date | null; remindDays: number; now: Date }): boolean {
  const { nextRunAt, remindedFor, remindDays, now } = args;
  if (remindDays <= 0) return false;
  if (remindedFor && remindedFor.getTime() === nextRunAt.getTime()) return false;
  const start = nextRunAt.getTime() - remindDays * 24 * 3_600_000;
  return now.getTime() >= start && now.getTime() < nextRunAt.getTime();
}

/** L'échéance est-elle arrivée (et la tentative suivante autorisée) ? */
export function isRunnable(args: { nextRunAt: Date; retryAt: Date | null; now: Date }): boolean {
  if (args.nextRunAt.getTime() > args.now.getTime()) return false;
  return !args.retryAt || args.retryAt.getTime() <= args.now.getTime();
}

/** Clé d'idempotence d'une échéance : rejouer la même échéance (deux instances, redémarrage) ne débite jamais deux fois. */
export const scheduleIdempotencyKey = (scheduleId: string, due: Date): string => `sched-${scheduleId}-${due.toISOString().slice(0, 10)}`;
