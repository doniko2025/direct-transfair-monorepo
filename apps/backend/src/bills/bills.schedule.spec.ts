// Règles pures des factures récurrentes : pas de dérive de jour, échéances manquées sautées, rappel envoyé une seule fois.
import { BadRequestException } from '@nestjs/common';

import {
  anchorDayOf, assertEndDay, firstOccurrence, isPastEnd, isRunnable, nextOccurrence, nextOccurrenceAfter, parseDay, recurringHourUtc, reminderDue, scheduleIdempotencyKey,
} from './bills.schedule';

const at = (s: string) => new Date(`${s}T08:00:00.000Z`);
const day = (d: Date) => d.toISOString().slice(0, 10);

describe('bills.schedule — échéances', () => {
  it('mensuel : le 31 tombe le dernier jour des mois courts puis REVIENT au 31 (aucune dérive)', () => {
    const anchor = 31;
    const feb = nextOccurrence(at('2027-01-31'), 'MONTHLY', anchor);
    expect(day(feb)).toBe('2027-02-28');
    const mar = nextOccurrence(feb, 'MONTHLY', anchor);
    expect(day(mar)).toBe('2027-03-31');
    expect(day(nextOccurrence(at('2028-01-31'), 'MONTHLY', anchor))).toBe('2028-02-29'); // année bissextile
  });

  it('trimestriel, annuel, hebdomadaire', () => {
    expect(day(nextOccurrence(at('2026-11-30'), 'QUARTERLY', 30))).toBe('2027-02-28');
    expect(day(nextOccurrence(at('2026-12-15'), 'YEARLY', 15))).toBe('2027-12-15');
    expect(day(nextOccurrence(at('2026-11-16'), 'WEEKLY', 1))).toBe('2026-11-23');
  });

  it('passage d\'année : décembre → janvier', () => {
    expect(day(nextOccurrence(at('2026-12-05'), 'MONTHLY', 5))).toBe('2027-01-05');
  });

  it('rattrapage : les échéances manquées sont sautées, la suivante est dans le futur', () => {
    const now = new Date('2027-03-10T12:00:00Z');
    expect(day(nextOccurrenceAfter(at('2027-01-05'), now, 'MONTHLY', 5))).toBe('2027-04-05');
  });

  it('jour d\'ancrage : jour du mois, ou jour ISO de la semaine pour WEEKLY', () => {
    expect(anchorDayOf(at('2026-11-16'), 'MONTHLY')).toBe(16);
    expect(anchorDayOf(at('2026-11-16'), 'WEEKLY')).toBe(1); // lundi
    expect(anchorDayOf(at('2026-11-22'), 'WEEKLY')).toBe(7); // dimanche
  });

  it('l\'heure d\'échéance vient de BILLS_RECURRING_HOUR_UTC (8 h par défaut, valeur invalide ignorée)', () => {
    expect(recurringHourUtc({} as never)).toBe(8);
    expect(recurringHourUtc({ BILLS_RECURRING_HOUR_UTC: '6' } as never)).toBe(6);
    expect(recurringHourUtc({ BILLS_RECURRING_HOUR_UTC: '99' } as never)).toBe(8);
  });
});

describe('bills.schedule — saisie', () => {
  const now = new Date('2026-11-16T10:00:00Z');

  it('date inexistante ou mal formée refusée', () => {
    expect(() => parseDay('2027-02-30', 8)).toThrow(BadRequestException);
    expect(() => parseDay('16/11/2026', 8)).toThrow(BadRequestException);
  });

  it('première échéance : aujourd\'hui accepté, passé et au-delà d\'un an refusés', () => {
    expect(day(firstOccurrence('2026-11-16', now, 8))).toBe('2026-11-16');
    expect(() => firstOccurrence('2026-11-15', now, 8)).toThrow(/passé/);
    expect(() => firstOccurrence('2028-01-01', now, 8)).toThrow(/12 prochains mois/);
  });

  it('date de fin : facultative, jamais avant la première échéance', () => {
    const first = at('2026-12-01');
    expect(assertEndDay(undefined, first, 8)).toBeNull();
    expect(assertEndDay('', first, 8)).toBeNull();
    expect(() => assertEndDay('2026-11-30', first, 8)).toThrow(BadRequestException);
    expect(day(assertEndDay('2027-06-01', first, 8)!)).toBe('2027-06-01');
  });

  it('fin atteinte quand l\'échéance suivante dépasse la date de fin', () => {
    expect(isPastEnd(at('2027-07-01'), at('2027-06-01'))).toBe(true);
    expect(isPastEnd(at('2027-06-01'), at('2027-06-01'))).toBe(false);
    expect(isPastEnd(at('2027-07-01'), null)).toBe(false);
  });
});

describe('bills.schedule — rappel et exécution', () => {
  const next = at('2026-11-20');

  it('rappel : dans la fenêtre, une seule fois par échéance, jamais si 0 jour', () => {
    expect(reminderDue({ nextRunAt: next, remindedFor: null, remindDays: 2, now: new Date('2026-11-17T09:00:00Z') })).toBe(false);
    expect(reminderDue({ nextRunAt: next, remindedFor: null, remindDays: 2, now: new Date('2026-11-18T09:00:00Z') })).toBe(true);
    expect(reminderDue({ nextRunAt: next, remindedFor: next, remindDays: 2, now: new Date('2026-11-19T09:00:00Z') })).toBe(false);
    expect(reminderDue({ nextRunAt: next, remindedFor: null, remindDays: 0, now: new Date('2026-11-19T09:00:00Z') })).toBe(false);
    expect(reminderDue({ nextRunAt: next, remindedFor: null, remindDays: 2, now: new Date('2026-11-21T09:00:00Z') })).toBe(false);
  });

  it('exécutable : échéance arrivée et ré-essai autorisé', () => {
    const now = new Date('2026-11-20T10:00:00Z');
    expect(isRunnable({ nextRunAt: next, retryAt: null, now })).toBe(true);
    expect(isRunnable({ nextRunAt: next, retryAt: new Date('2026-11-20T12:00:00Z'), now })).toBe(false);
    expect(isRunnable({ nextRunAt: at('2026-11-21'), retryAt: null, now })).toBe(false);
  });

  it('clé d\'idempotence : stable pour une échéance, différente d\'une échéance à l\'autre, dans la limite du DTO', () => {
    const a = scheduleIdempotencyKey('cm0abcdefghijklmnopqrstuv', next);
    expect(a).toBe(scheduleIdempotencyKey('cm0abcdefghijklmnopqrstuv', next));
    expect(a).not.toBe(scheduleIdempotencyKey('cm0abcdefghijklmnopqrstuv', at('2026-12-20')));
    expect(a.length).toBeLessThanOrEqual(80);
  });
});
