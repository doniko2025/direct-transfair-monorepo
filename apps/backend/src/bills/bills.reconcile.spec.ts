// Rapprochement : lecture robuste des fichiers de facturiers (séparateurs, guillemets, montants français ou anglais) et classement des écarts.
import 'reflect-metadata';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { BillsReconcileService } from './bills-reconcile.service';
import { detectDelimiter, normRef, parseAmount, parseCsv, parseFileDate, reconcile, suggestMapping, toLines, type OurPayment } from './bills.reconcile';

describe('bills.reconcile — lecture du fichier', () => {
  it('séparateur deviné (« ; », « , », tabulation), guillemets et BOM gérés', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(detectDelimiter('a\tb\tc')).toBe('\t');
    const p = parseCsv('﻿Référence;Montant;Note\r\n"0123, 45";"1 500,50";"dit ""ok"""\r\n\r\nX;2;y\r\n');
    expect(p.headers).toEqual(['Référence', 'Montant', 'Note']);
    expect(p.rows).toEqual([['0123, 45', '1 500,50', 'dit "ok"'], ['X', '2', 'y']]);
  });

  it('cellule sur plusieurs lignes et dernière ligne sans retour à la ligne', () => {
    const p = parseCsv('a;b\n"x\ny";2\nz;3');
    expect(p.rows).toEqual([['x\ny', '2'], ['z', '3']]);
  });

  it('montants : formats français et anglais, devise collée, négatifs, non-montants', () => {
    expect(parseAmount('1 500,50')).toBe(1500.5);
    expect(parseAmount('1.500,50')).toBe(1500.5);
    expect(parseAmount('1,500.50')).toBe(1500.5);
    expect(parseAmount('100000')).toBe(100000);
    expect(parseAmount('100 000 GNF')).toBe(100000);
    expect(parseAmount('1.500')).toBe(1500);
    expect(parseAmount('12,5')).toBe(12.5);
    expect(parseAmount('-2 500')).toBe(-2500);
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });

  it('dates : AAAA-MM-JJ, JJ/MM/AAAA avec heure, dates impossibles refusées', () => {
    expect(parseFileDate('2026-11-16')?.toISOString().slice(0, 10)).toBe('2026-11-16');
    expect(parseFileDate('16/11/2026 14:03')?.toISOString().slice(0, 10)).toBe('2026-11-16');
    expect(parseFileDate('31/02/2026')).toBeNull();
    expect(parseFileDate('hier')).toBeNull();
  });

  it('références comparées sans casse, tirets, espaces ni zéros de tête', () => {
    expect(normRef('00 123-ab')).toBe('123AB');
    expect(normRef('0')).toBe('0');
  });

  it('colonnes devinées d\'après l\'en-tête ; aucune colonne de montant → pas de devinette', () => {
    expect(suggestMapping(['Date', 'N° opération', 'N° compteur', 'Montant payé'])).toEqual({ amount: 'Montant payé', providerRef: 'N° opération', reference: 'N° compteur', date: 'Date' });
    expect(suggestMapping(['a', 'b'])).toBeNull();
  });

  it('colonne choisie absente du fichier : erreur claire ; montant illisible : ligne signalée', () => {
    const p = parseCsv('ref;montant\nA;10\nB;oops');
    expect(() => toLines(p, { amount: 'total' })).toThrow(/introuvable/);
    expect(toLines(p, { amount: 'montant', reference: 'ref' }).invalidAmounts).toEqual([3]);
  });
});

const pay = (id: string, accountRef: string, amount: number, providerRef: string | null = null): OurPayment => ({ id, reference: `FAC-${id}`, accountRef, providerRef, amount, currency: 'GNF', status: 'COMPLETED', at: new Date('2026-11-10') });
const line = (n: number, over: Partial<{ providerRef: string | null; reference: string | null; amount: number | null }>) => ({ line: n, providerRef: null, reference: null, amount: 0, date: null, raw: '', ...over });

describe('bills.reconcile — appariement', () => {
  it('par numéro d\'opération : concordant, montant différent', () => {
    const r = reconcile([line(2, { providerRef: 'OP-1', amount: 1000 }), line(3, { providerRef: 'OP-2', amount: 900 })], [pay('a', '111', 1000, 'op1'), pay('b', '222', 1000, 'OP-2')]);
    expect(r.counts).toMatchObject({ MATCHED: 1, AMOUNT_MISMATCH: 1, MISSING_AT_BILLER: 0, UNKNOWN_AT_BILLER: 0 });
    expect(r.rows.find((x) => x.kind === 'AMOUNT_MISMATCH')!.diff).toBe(-100);
  });

  it('à défaut, par référence ET montant identiques ; mêmes références mais montants différents = inconnu + absent', () => {
    const ok = reconcile([line(2, { reference: '0123', amount: 500 })], [pay('a', '123', 500)]);
    expect(ok.counts.MATCHED).toBe(1);
    const ko = reconcile([line(2, { reference: '123', amount: 400 })], [pay('a', '123', 500)]);
    expect(ko.counts).toMatchObject({ MATCHED: 0, UNKNOWN_AT_BILLER: 1, MISSING_AT_BILLER: 1 });
  });

  it('facture réglée absente du relevé = argent à réclamer ; ligne inconnue = encaissement sans facture', () => {
    const r = reconcile([line(2, { providerRef: 'ZZ', amount: 300 })], [pay('a', '111', 700, 'OP-9')]);
    expect(r.counts).toMatchObject({ MISSING_AT_BILLER: 1, UNKNOWN_AT_BILLER: 1 });
    expect(r.totals).toMatchObject({ missingAtBiller: 700, unknownAtBiller: 300 });
  });

  it('une facture ne sert qu\'une fois : la seconde ligne est un doublon', () => {
    const r = reconcile([line(2, { providerRef: 'OP-1', amount: 1000 }), line(3, { providerRef: 'OP-1', amount: 1000 })], [pay('a', '111', 1000, 'OP-1')]);
    expect(r.counts).toMatchObject({ MATCHED: 1, DUPLICATE_LINE: 1 });
  });

  it('tolérance d\'arrondi', () => {
    const l = [line(2, { providerRef: 'OP-1', amount: 1000.5 })];
    expect(reconcile(l, [pay('a', '1', 1000, 'OP-1')]).counts.AMOUNT_MISMATCH).toBe(1);
    expect(reconcile(l, [pay('a', '1', 1000, 'OP-1')], { tolerance: 1 }).counts.MATCHED).toBe(1);
  });

  it('ligne sans montant lisible : jamais comptée', () => {
    expect(reconcile([line(2, { providerRef: 'OP', amount: null })], []).rows).toHaveLength(0);
  });
});

describe('BillsReconcileService', () => {
  const ADMIN = { id: 'a1', role: 'COMPANY_ADMIN', clientId: 7, isActive: true, isSuspended: false, deletedAt: null };
  const dec = (n: number) => ({ toString: () => String(n), valueOf: () => n });
  function make(opts: { admin?: Record<string, unknown>; biller?: unknown } = {}) {
    const calls: Record<string, any>[] = [];
    const prisma: any = {
      user: { findUnique: jest.fn(async () => ({ ...ADMIN, ...(opts.admin ?? {}) })) },
      biller: { findFirst: jest.fn(async ({ where }: any) => (where.clientId === 7 && where.id === 'b1' ? (opts.biller ?? { id: 'b1', name: 'EDG', currency: 'GNF' }) : null)) },
      billPayment: {
        findMany: jest.fn(async (args: any) => {
          calls.push(args);
          return [
            { id: 'p1', reference: 'FAC-1', accountRef: '123456', providerRef: 'OP-1', amount: dec(1000), currency: 'GNF', status: 'COMPLETED', completedAt: new Date('2026-11-10'), createdAt: new Date('2026-11-09') },
            { id: 'p2', reference: 'FAC-2', accountRef: '777777', providerRef: 'OP-2', amount: dec(2000), currency: 'GNF', status: 'COMPLETED', completedAt: new Date('2026-11-11'), createdAt: new Date('2026-11-10') },
          ];
        }),
      },
      auditLog: { create: jest.fn(async () => ({})) },
    };
    return { svc: new BillsReconcileService(prisma), prisma, calls };
  }
  const auth = { id: 'a1', role: 'COMPANY_ADMIN' } as never;
  const CSV = 'Date;N° opération;N° compteur;Montant\n10/11/2026;OP-1;123456;1 000\n11/11/2026;OP-2;777777;1 900\n12/11/2026;OP-3;555555;300\n';

  it('rapport complet : concordant, montant différent, inconnu chez nous ; colonnes devinées ; période déduite du fichier ; audit écrit', async () => {
    const { svc, prisma, calls } = make();
    const r: any = await svc.run(auth, { billerId: 'b1', csv: CSV } as never);
    expect(r.needsMapping).toBe(false);
    expect(r.mapping).toMatchObject({ amount: 'Montant', providerRef: 'N° opération', reference: 'N° compteur', date: 'Date' });
    expect(r.counts).toMatchObject({ MATCHED: 1, AMOUNT_MISMATCH: 1, UNKNOWN_AT_BILLER: 1, MISSING_AT_BILLER: 0 });
    expect(r.rows[0].kind).toBe('AMOUNT_MISMATCH'); // les écarts d'abord
    expect(r.period).toEqual({ from: '2026-11-08', to: '2026-11-14' });
    expect(calls[0].where).toMatchObject({ clientId: 7, billerId: 'b1' });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('colonnes introuvables : le serveur demande le choix des colonnes au lieu de deviner', async () => {
    const r: any = await make().svc.run(auth, { billerId: 'b1', csv: 'x;y\n1;2\n' } as never);
    expect(r).toMatchObject({ needsMapping: true, headers: ['x', 'y'] });
  });

  it('export : écarts seulement, cellules neutralisées, BOM', async () => {
    const csv = await make().svc.exportCsv(auth, { billerId: 'b1', csv: CSV } as never);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Montant différent');
    expect(csv).toContain('Inconnu chez nous');
    expect(csv).not.toContain('Concordant');
  });

  it('droits et erreurs : pas un administrateur de société, facturier d\'une autre société, fichier vide, colonne inexistante', async () => {
    await expect(make({ admin: { role: 'SUPER_ADMIN' } }).svc.run(auth, { billerId: 'b1', csv: CSV } as never)).rejects.toThrow(ForbiddenException);
    await expect(make().svc.run(auth, { billerId: 'autre', csv: CSV } as never)).rejects.toThrow(NotFoundException);
    await expect(make().svc.run(auth, { billerId: 'b1', csv: 'a;b\n' } as never)).rejects.toThrow(BadRequestException);
    await expect(make().svc.run(auth, { billerId: 'b1', csv: CSV, mapping: { amount: 'Total', reference: 'N° compteur' } } as never)).rejects.toThrow(/introuvable/);
    await expect(make().svc.run(auth, { billerId: 'b1', csv: CSV, mapping: { amount: 'Montant' } } as never)).rejects.toThrow(/au moins la colonne/);
  });
});
