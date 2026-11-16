// Règles pures du paiement de factures : catégories, motifs, champs dynamiques, frais, conversion, retard, CSV, reçu.
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';

import { billReceiptCode, isValidBillSignature, parseBillReceiptCode } from './bills.receipt';
import {
  assertReference, assertSafePattern, cleanFieldValues, computeBillFee, convertCharges, csvCell, generateBillReference, isLate, normalizeCategory,
  parseFieldDefs, publicBiller, toCsv,
} from './bills.rules';
import { maskCustomerName, maskReference } from './bills.service';

describe('bills.rules', () => {
  it('catégorie : normalisée en MAJUSCULES, invalide refusée', () => {
    expect(normalizeCategory(' frais scolaires ')).toBe('FRAIS_SCOLAIRES');
    expect(normalizeCategory('insurance-auto')).toBe('INSURANCE_AUTO');
    expect(() => normalizeCategory('é!')).toThrow(BadRequestException);
    expect(() => normalizeCategory('')).toThrow(BadRequestException);
  });

  it('motif : un motif catastrophique ou invalide est refusé', () => {
    expect(assertSafePattern('^\\d{8,12}$', 'x')).toBe('^\\d{8,12}$');
    expect(assertSafePattern('', 'x')).toBeNull();
    expect(() => assertSafePattern('(a+)+', 'x')).toThrow(BadRequestException);
    expect(() => assertSafePattern('([', 'x')).toThrow(BadRequestException);
  });

  it('champs dynamiques : définition stricte, valeurs contrôlées, champs inconnus ignorés', () => {
    const defs = parseFieldDefs([
      { key: 'matricule', label: 'Matricule', type: 'text', pattern: '^[A-Z]{2}\\d{4}$' },
      { key: 'trimestre', label: 'Trimestre', type: 'select', options: ['T1', 'T2', 'T3'] },
      { key: 'note', label: 'Note', required: false },
    ]);
    expect(cleanFieldValues(defs, { matricule: 'AB1234', trimestre: 'T2', pirate: 'x' })).toEqual({ matricule: 'AB1234', trimestre: 'T2' });
    expect(() => cleanFieldValues(defs, { matricule: 'zz', trimestre: 'T2' })).toThrow(BadRequestException);
    expect(() => cleanFieldValues(defs, { matricule: 'AB1234', trimestre: 'T9' })).toThrow(BadRequestException);
    expect(() => cleanFieldValues(defs, { trimestre: 'T1' })).toThrow(BadRequestException);
    expect(() => parseFieldDefs([{ key: 'a b', label: 'x' }])).toThrow(BadRequestException);
    expect(() => parseFieldDefs([{ key: 'a', label: 'x' }, { key: 'a', label: 'y' }])).toThrow(BadRequestException);
    expect(() => parseFieldDefs(Array.from({ length: 9 }, (_, i) => ({ key: `k${i}`, label: 'x' })))).toThrow(BadRequestException);
  });

  it('référence : requise, longueur bornée, format du facturier', () => {
    const b = { referenceLabel: 'N° de compteur', referencePattern: '^\\d{10}$' };
    expect(assertReference(b, ' 0123456789 ')).toBe('0123456789');
    expect(() => assertReference(b, '12')).toThrow(/bon format/);
    expect(() => assertReference(b, '')).toThrow(/requis/);
    expect(() => assertReference({ referenceLabel: 'N°', referencePattern: null }, 'x'.repeat(65))).toThrow(BadRequestException);
  });

  it('frais : part fixe + pourcentage, arrondis à la devise ; conversion sans écart', () => {
    expect(computeBillFee(100_000, 500, 1, 'XOF')).toBe(1500);
    expect(computeBillFee(100_000, 0, 0, 'XOF')).toBe(0);
    expect(computeBillFee(50, 0.5, 1.5, 'EUR')).toBe(1.25);
    expect(computeBillFee(100, -5, Number.NaN, 'EUR')).toBe(0);
    const c = convertCharges({ amount: 10_000, fee: 100, rate: 0.00152, walletCurrency: 'EUR' });
    expect(c.totalCharged).toBeCloseTo(c.amountCharged + c.feeCharged, 10);
    expect(convertCharges({ amount: 1000, fee: 10, rate: 1, walletCurrency: 'XOF' })).toEqual({ amountCharged: 1000, feeCharged: 10, totalCharged: 1010 });
  });

  it('référence de paiement : format FAC-…, unique', () => {
    const a = generateBillReference();
    expect(a).toMatch(/^FAC-[A-Z0-9]{4,14}-[A-F0-9]{6}$/);
    expect(generateBillReference()).not.toBe(a);
  });

  it('retard : seulement les factures ouvertes au-delà du délai annoncé', () => {
    const now = new Date('2026-11-16T12:00:00Z');
    const old = new Date('2026-11-14T12:00:00Z');
    expect(isLate({ status: 'SUBMITTED', createdAt: old }, 24, now)).toBe(true);
    expect(isLate({ status: 'PROCESSING', createdAt: old }, 72, now)).toBe(false);
    expect(isLate({ status: 'COMPLETED', createdAt: old }, 24, now)).toBe(false);
    expect(isLate({ status: 'REFUNDED', createdAt: old }, 24, now)).toBe(false);
  });

  it('vue publique : jamais le suivi du partenariat, les coordonnées de règlement ni la note interne', () => {
    const v = publicBiller({
      id: 'b1', name: 'EDG', category: 'ELECTRICITY', country: 'GN', currency: 'GNF', description: null, connectorKey: 'sandbox', referenceLabel: 'Compteur',
      referenceHint: null, referencePattern: null, fields: [], amountMode: 'FREE', minAmount: null, maxAmount: null, feeFixed: { toString: () => '500' },
      feePct: { toString: () => '1' }, settlementDelayHours: 24,
      ...({ partnershipStatus: 'SIGNED', settlementInfo: 'IBAN secret', internalNote: 'remise 3 %' } as object),
    });
    expect(JSON.stringify(v)).not.toMatch(/IBAN|remise|SIGNED|partnership/i);
    expect(v.simulated).toBe(true);
    expect(v.automatic).toBe(true);
  });

  it('CSV : formules neutralisées, guillemets et points-virgules protégés', () => {
    expect(csvCell('=SOMME(A1)')).toBe("'=SOMME(A1)");
    expect(csvCell('+224')).toBe("'+224");
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('dit "oui"')).toBe('"dit ""oui"""');
    expect(csvCell(null)).toBe('');
    expect(toCsv(['A', 'B'], [[1, 'x']])).toBe('A;B\r\n1;x\r\n');
  });

  it('masques : titulaire et référence', () => {
    expect(maskCustomerName('Mamadou Diallo')).toBe('Mamadou D.');
    expect(maskCustomerName('  ')).toBeNull();
    expect(maskCustomerName(null)).toBeNull();
    expect(maskReference('0123456789')).toBe('••••••6789');
    expect(maskReference('123')).toBe('••••');
  });

  it('reçu : signature valide, modifiée → refusée, code mal formé → null', () => {
    const p = { id: 'p1', reference: 'FAC-ABC123-A1B2C3', amount: '25000', currency: 'GNF', completedAt: new Date('2026-11-16T10:00:00Z') };
    const code = billReceiptCode(p);
    const parsed = parseBillReceiptCode(code)!;
    expect(parsed.reference).toBe(p.reference);
    expect(isValidBillSignature(p, parsed.signature)).toBe(true);
    expect(isValidBillSignature({ ...p, amount: '250000' }, parsed.signature)).toBe(false);
    expect(parseBillReceiptCode('FAC-ABC123-A1B2C3')).toBeNull();
    expect(parseBillReceiptCode('n’importe quoi')).toBeNull();
  });
});
