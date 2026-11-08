import { Prisma } from '@prisma/client';

import { MerchantReceiptsService } from './merchant-receipts.service';
import { renderReceiptPage } from './merchant-receipts.controller';
import { parseReceiptCode, receiptCode, sealSignature, verifySeal } from './receipt-seal';

const KEY = 'une-cle-de-test-assez-longue-123456';
const base = { id: 'ck1', reference: 'MP-LRXY12AB-3F2A1B', amount: 10_000, currency: 'XOF', paidAt: new Date('2026-11-08T10:00:00.000Z') };

describe('sceau du reçu', () => {
  it('même paiement = même code ; signature de 22 caractères ; code reconnu par le lecteur', () => {
    const a = receiptCode(base, KEY);
    expect(a).toBe(receiptCode({ ...base }, KEY));
    expect(a).toMatch(/^MP-LRXY12AB-3F2A1B\.[A-Za-z0-9_-]{22}$/);
    expect(parseReceiptCode(a)).toEqual({ reference: base.reference, signature: sealSignature(base, KEY) });
  });

  it('montant, devise, date, identifiant ou clé modifiés : la signature ne correspond plus', () => {
    const sig = sealSignature(base, KEY);
    expect(verifySeal(base, sig, KEY)).toBe(true);
    expect(verifySeal({ ...base, amount: 100_000 }, sig, KEY)).toBe(false);
    expect(verifySeal({ ...base, currency: 'GNF' }, sig, KEY)).toBe(false);
    expect(verifySeal({ ...base, paidAt: new Date('2026-11-09T10:00:00.000Z') }, sig, KEY)).toBe(false);
    expect(verifySeal({ ...base, id: 'autre' }, sig, KEY)).toBe(false);
    expect(verifySeal(base, sig, 'une-autre-cle-assez-longue-654321')).toBe(false);
    expect(verifySeal(base, 'trop-court', KEY)).toBe(false);
  });

  it('le montant est comparé sur sa valeur : 10000, "10000", Decimal(10000.00) donnent le même sceau', () => {
    const s = sealSignature(base, KEY);
    expect(sealSignature({ ...base, amount: '10000' }, KEY)).toBe(s);
    expect(sealSignature({ ...base, amount: new Prisma.Decimal('10000.00') }, KEY)).toBe(s);
  });

  it('codes mal formés refusés', () => {
    for (const bad of ['', 'abc', 'MP-1.x', `${base.reference}.`, `${base.reference}.${'a'.repeat(21)}`, `XX-LRXY12AB-3F2A1B.${'a'.repeat(22)}`, null, 42, `${base.reference}.${'a'.repeat(22)}'--`]) {
      expect(parseReceiptCode(bad as never)).toBeNull();
    }
  });
});

describe('MerchantReceiptsService.verify', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: base.id, reference: base.reference, status: 'PAID', amount: new Prisma.Decimal('10000'), currency: 'XOF', paidAt: base.paidAt, method: 'QR', viaStaticQr: false, refundedAt: null,
    payee: { firstName: 'Awa', lastName: 'Diallo', merchantProfile: { businessName: 'Boutique Awa', city: 'Conakry' } },
    ...over,
  });
  const make = (r: unknown) => new MerchantReceiptsService({ paymentRequest: { findUnique: jest.fn(async () => r) } } as never);
  const code = () => receiptCode(base);

  it('reçu authentique : données réelles du serveur, rien de sensible', async () => {
    const out = await make(row()).verify(code());
    expect(out).toMatchObject({ valid: true, reference: base.reference, businessName: 'Boutique Awa', amount: 10_000, currency: 'XOF', status: 'PAID', method: 'QR' });
    expect(JSON.stringify(out)).not.toMatch(/payer|fee|netAmount|Diallo/);
  });

  it('montant falsifié dans la base ≠ montant du code : refusé', async () => {
    expect(await make(row({ amount: new Prisma.Decimal('99999') })).verify(code())).toEqual({ valid: false });
  });

  it('inconnu, non payé, signature fausse : même réponse « non valide »', async () => {
    expect(await make(null).verify(code())).toEqual({ valid: false });
    expect(await make(row({ status: 'PENDING' })).verify(code())).toEqual({ valid: false });
    expect(await make(row()).verify(`${base.reference}.${'A'.repeat(22)}`)).toEqual({ valid: false });
    expect(await make(row()).verify('nimportequoi')).toEqual({ valid: false });
  });

  it('paiement remboursé : valide mais signalé REFUNDED', async () => {
    const out = await make(row({ refundedAt: new Date('2026-11-09T09:00:00.000Z') })).verify(code());
    expect(out).toMatchObject({ valid: true, status: 'REFUNDED', refundedAt: '2026-11-09T09:00:00.000Z' });
  });
});

describe('page de vérification', () => {
  it('échappe le HTML venant de la base et signale un reçu remboursé', () => {
    const html = renderReceiptPage({ valid: true, reference: base.reference, businessName: '<script>alert(1)</script>', city: null, amount: 5000, currency: 'XOF', paidAt: '2026-11-08T10:00:00.000Z', method: 'PHONE', status: 'REFUNDED', refundedAt: '2026-11-09T10:00:00.000Z' });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('REMBOURSÉ');
  });
  it('reçu inconnu : message clair', () => {
    expect(renderReceiptPage({ valid: false })).toContain('Reçu non reconnu');
  });
});
