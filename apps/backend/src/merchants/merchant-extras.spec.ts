// Règles pures du lot 13 : remboursement, plafond des caissiers, journées locales, totaux, CSV, alertes.
import 'reflect-metadata';
import { BadRequestException, ConflictException } from '@nestjs/common';

import {
  aggregate,
  assertRefundable,
  assertWithinStaffLimit,
  csvCell,
  dayBounds,
  generateRefundReference,
  isRefundable,
  localDay,
  lowBalanceDecision,
  normalizeStaffLimit,
  parseDay,
  parseTzOffset,
  periodBounds,
  refundAmounts,
  shouldAlertFailures,
  toCsv,
} from './merchant-extras';

const DAY = 86_400_000;
const paid = (ageDays: number, over: Record<string, unknown> = {}) => ({ status: 'PAID', paidAt: new Date(Date.now() - ageDays * DAY), refundedAt: null, ...over }) as any;

describe('remboursement', () => {
  it('remboursable : payé, pas déjà remboursé, dans les 30 jours', () => {
    const now = new Date();
    expect(isRefundable(paid(1), now)).toBe(true);
    expect(isRefundable(paid(29.9), now)).toBe(true);
    expect(isRefundable(paid(31), now)).toBe(false);
    expect(isRefundable(paid(1, { refundedAt: new Date() }), now)).toBe(false);
    expect(isRefundable(paid(1, { status: 'PENDING' }), now)).toBe(false);
    expect(isRefundable(paid(1, { paidAt: null }), now)).toBe(false);
  });

  it('assertRefundable : 409 déjà remboursé, 400 non payé, 400 délai dépassé', () => {
    const now = new Date();
    expect(() => assertRefundable(paid(1), now)).not.toThrow();
    expect(() => assertRefundable(paid(1, { refundedAt: new Date() }), now)).toThrow(ConflictException);
    expect(() => assertRefundable(paid(1, { status: 'CANCELLED' }), now)).toThrow(BadRequestException);
    expect(() => assertRefundable(paid(45), now)).toThrow(/30 jours/);
  });

  it('le client récupère tout, le commerce rend le montant payé, la commission reste à la société', () => {
    expect(refundAmounts(10_000, 100, 'XOF')).toEqual({ payerCredit: 10_000, merchantDebit: 10_000, feeLost: 100 });
    expect(refundAmounts(12.5, 0.13, 'EUR')).toEqual({ payerCredit: 12.5, merchantDebit: 12.5, feeLost: 0.13 });
  });

  it('références MF- uniques', () => {
    const a = generateRefundReference();
    expect(a).toMatch(/^MF-[0-9A-Z]+-[0-9A-F]{6}$/);
    expect(generateRefundReference()).not.toBe(a);
  });
});

describe('plafond des caissiers', () => {
  it('sans plafond : tout passe ; avec plafond : au-delà refusé', () => {
    expect(() => assertWithinStaffLimit(10_000_000, null, 'XOF')).not.toThrow();
    expect(() => assertWithinStaffLimit(5000, 5000, 'XOF')).not.toThrow();
    expect(() => assertWithinStaffLimit(5001, 5000, 'XOF')).toThrow(/plafond/);
  });
  it('plafond saisi : vide = aucun, entier en XOF/GNF, positif', () => {
    expect(normalizeStaffLimit('', 'XOF')).toBeNull();
    expect(normalizeStaffLimit(null, 'GNF')).toBeNull();
    expect(normalizeStaffLimit('25000', 'XOF')).toBe(25_000);
    expect(normalizeStaffLimit(20.5, 'EUR')).toBe(20.5);
    expect(() => normalizeStaffLimit(0, 'XOF')).toThrow(BadRequestException);
    expect(() => normalizeStaffLimit(-5, 'XOF')).toThrow(BadRequestException);
    expect(() => normalizeStaffLimit(10.5, 'GNF')).toThrow(BadRequestException);
    expect(() => normalizeStaffLimit('abc', 'XOF')).toThrow(BadRequestException);
  });
});

describe('journées locales', () => {
  it('parseDay refuse les dates impossibles', () => {
    expect(parseDay('2026-11-08')).toBe('2026-11-08');
    expect(parseDay(' 2028-02-29 ')).toBe('2028-02-29');
    for (const bad of ['2026-02-30', '2026-13-01', '08/11/2026', '', null, 20261108]) expect(() => parseDay(bad)).toThrow(BadRequestException);
  });

  it('parseTzOffset : borné à ±14 h, invalide = UTC', () => {
    expect(parseTzOffset('60')).toBe(60);
    expect(parseTzOffset(-300)).toBe(-300);
    expect(parseTzOffset('99999')).toBe(840);
    expect(parseTzOffset('x')).toBe(0);
    expect(parseTzOffset(undefined)).toBe(0);
  });

  it("bornes d'un jour à Paris (UTC+1) et à Conakry (UTC+0) ; 24 h exactement", () => {
    const paris = dayBounds('2026-11-08', 60);
    expect(paris.from.toISOString()).toBe('2026-11-07T23:00:00.000Z');
    expect(paris.to.toISOString()).toBe('2026-11-08T23:00:00.000Z');
    const conakry = dayBounds('2026-11-08', 0);
    expect(conakry.from.toISOString()).toBe('2026-11-08T00:00:00.000Z');
    expect(conakry.to.getTime() - conakry.from.getTime()).toBe(DAY);
  });

  it('un paiement à 23 h 30 heure de Paris appartient bien au jour de Paris', () => {
    const at = new Date('2026-11-08T22:30:00.000Z'); // 23 h 30 à Paris
    expect(localDay(at, 60)).toBe('2026-11-08');
    expect(localDay(at, 0)).toBe('2026-11-08');
    const late = new Date('2026-11-08T23:30:00.000Z'); // 00 h 30 le lendemain à Paris
    expect(localDay(late, 60)).toBe('2026-11-09');
    const b = dayBounds('2026-11-08', 60);
    expect(late >= b.to).toBe(true);
  });

  it('période : à l’endroit, 93 jours au plus', () => {
    const p = periodBounds('2026-11-01', '2026-11-07', 0);
    expect(p.days).toBe(7);
    expect(() => periodBounds('2026-11-07', '2026-11-01', 0)).toThrow(/précède/);
    expect(() => periodBounds('2026-01-01', '2026-06-01', 0)).toThrow(/trop longue/i);
  });
});

describe('totaux', () => {
  const sale = (over: Record<string, unknown> = {}) => ({ currency: 'XOF', amount: 10_000, fee: 100, netAmount: 9_900, method: 'QR', viaStaticQr: false, createdById: null, ...over }) as any;

  it('par devise : paiements, commissions, net, remboursements et variation réelle du solde', () => {
    const t = aggregate([sale(), sale({ method: 'PHONE', amount: 5000, fee: 50, netAmount: 4950, createdById: 'k' }), sale({ viaStaticQr: true, createdById: 'k' }), sale({ currency: 'EUR', amount: 12.5, fee: 0.13, netAmount: 12.37 })], [{ currency: 'XOF', amount: 10_000 }]);
    const xof = t.find((x) => x.currency === 'XOF')!;
    expect(xof).toMatchObject({ count: 3, gross: 25_000, fees: 250, net: 24_750, refundsCount: 1, refundsTotal: 10_000, balanceChange: 14_750 });
    expect(xof.byMethod).toEqual({ PHONE: 1, QR: 1, STATIC_QR: 1 });
    expect(xof.byCashier).toEqual([{ userId: null, count: 1, gross: 10_000 }, { userId: 'k', count: 2, gross: 15_000 }].sort((a, b) => b.gross - a.gross));
    expect(t.map((x) => x.currency)).toEqual(['EUR', 'XOF']);
    expect(t.find((x) => x.currency === 'EUR')).toMatchObject({ gross: 12.5, fees: 0.13, net: 12.37, balanceChange: 12.37 });
  });

  it('pas de dérive de flottants', () => {
    const rows = Array.from({ length: 10 }, () => sale({ currency: 'EUR', amount: 0.1, fee: 0.01, netAmount: 0.09 }));
    expect(aggregate(rows, [])[0]).toMatchObject({ gross: 1, fees: 0.1, net: 0.9 });
  });

  it('un remboursement sans vente sur la période apparaît quand même (journée de remboursements seuls)', () => {
    const t = aggregate([], [{ currency: 'GNF', amount: 50_000 }]);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ currency: 'GNF', count: 0, refundsCount: 1, balanceChange: -50_000 });
  });
});

describe('export CSV', () => {
  it('cellules : guillemets, point-virgule, retour à la ligne', () => {
    expect(csvCell('Boutique; Awa')).toBe('"Boutique; Awa"');
    expect(csvCell('Dit "bonjour"')).toBe('"Dit ""bonjour"""');
    expect(csvCell('a\nb')).toBe('a b');
    expect(csvCell(null)).toBe('');
  });
  it('nombres avec virgule décimale (Excel français)', () => {
    expect(csvCell(12.5)).toBe('12,5');
    expect(csvCell(-10000)).toBe('-10000');
    expect(csvCell(Number.NaN)).toBe('');
  });
  it('injection de formules neutralisée sur le texte, pas sur les nombres', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+33 6 12')).toBe("'+33 6 12");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('-2')).toBe("'-2");
    expect(csvCell(-2)).toBe('-2');
  });
  it('toCsv : BOM, séparateur « ; », CRLF, accents conservés', () => {
    const out = toCsv(['Date', 'Montant'], [['2026-11-08', 1500], ['Été', null]]);
    expect(out.startsWith('﻿')).toBe(true);
    expect(out).toBe('﻿Date;Montant\r\n2026-11-08;1500\r\nÉté;\r\n');
  });
});

describe('alertes', () => {
  it('solde bas : une alerte quand on passe sous le seuil, pas de répétition, réarmé en remontant', () => {
    expect(lowBalanceDecision(4000, 5000, false)).toBe('ALERT');
    expect(lowBalanceDecision(3000, 5000, true)).toBe('NONE');
    expect(lowBalanceDecision(5000, 5000, true)).toBe('REARM');
    expect(lowBalanceDecision(9000, 5000, false)).toBe('NONE');
  });
  it('seuil supprimé : plus d’alerte, et on réarme ce qui restait', () => {
    expect(lowBalanceDecision(0, null, false)).toBe('NONE');
    expect(lowBalanceDecision(0, null, true)).toBe('REARM');
    expect(lowBalanceDecision(0, 0, false)).toBe('NONE');
  });
  it('échecs de paiement : 3 en une heure, désactivable, une alerte toutes les 6 h', () => {
    const now = new Date();
    const h = (n: number) => new Date(now.getTime() - n * 3_600_000);
    expect(shouldAlertFailures({ failures: 2, enabled: true, alertedAt: null, now })).toBe(false);
    expect(shouldAlertFailures({ failures: 3, enabled: true, alertedAt: null, now })).toBe(true);
    expect(shouldAlertFailures({ failures: 9, enabled: false, alertedAt: null, now })).toBe(false);
    expect(shouldAlertFailures({ failures: 3, enabled: true, alertedAt: h(1), now })).toBe(false);
    expect(shouldAlertFailures({ failures: 3, enabled: true, alertedAt: h(7), now })).toBe(true);
  });
});
