// Reçu PDF : un vrai PDF est produit, uniquement pour le payeur et une fois la facture réglée ; page de vérification publique sûre.
import 'reflect-metadata';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { BillsService } from './bills.service';
import { categoryLabelFr, renderBillReceiptPdf, safeColor, type BillReceiptPdfData } from './bills.pdf';
import { renderBillVerifyPage } from './bills.verify-page';

const DATA: BillReceiptPdfData = {
  company: { name: 'Flash Transfer SARL', address: '12 rue du Commerce', city: 'Conakry', phone: '+224 600 00 00 00', email: 'contact@flash.gn', color: '#0E3B2D' },
  receiptNumber: 'FAC-ABC123-0F0F0F', billerName: 'EDG Prépayé', billerCategoryLabel: 'Électricité', referenceLabel: 'N° de compteur', accountRef: '0123456789',
  customerName: 'Mamadou D.', extraFields: [{ label: 'Plaque', value: 'RC-1234-A' }], amount: 100_000, fee: 1_500, currency: 'GNF', walletCurrency: 'GNF',
  amountCharged: 100_000, feeCharged: 1_500, totalCharged: 101_500, providerRef: 'EDG-998877', token: '1234-5678-9012-3456', receiptNote: 'Jeton à saisir sur le compteur.',
  paidAt: new Date('2026-11-16T09:00:00Z'), completedAt: new Date('2026-11-16T10:30:00Z'), payerName: 'Mamadou Barry', verifyCode: 'FAC-ABC123-0F0F0F.abcdefghijklmnopqrstuv',
  verifyUrl: 'https://api.exemple.com/api/bills/verify/FAC-ABC123-0F0F0F.abcdefghijklmnopqrstuv',
};

describe('bills.pdf — rendu', () => {
  it('produit un vrai PDF (signature %PDF, plusieurs ko)', async () => {
    const buf = await renderBillReceiptPdf(DATA);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(1500);
  });

  it('tient sur une page et supporte accents, simulation et absence de lien de vérification', async () => {
    const buf = await renderBillReceiptPdf({ ...DATA, simulated: true, verifyUrl: null, token: null, providerRef: null, customerName: null, company: { name: 'Société “Étoile” — Dakar' } });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect((buf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBe(1);
  });

  it('une couleur de société invalide ne casse pas le PDF', async () => {
    expect(safeColor('rouge', '#111111')).toBe('#111111');
    expect(safeColor('#12ab9F', '#111111')).toBe('#12ab9F');
    await expect(renderBillReceiptPdf({ ...DATA, company: { name: 'X', color: 'url(javascript:1)' } })).resolves.toBeInstanceOf(Buffer);
  });

  it('libellés de catégorie : connus en français, inconnus rendus lisibles', () => {
    expect(categoryLabelFr('RENT')).toBe('Loyer');
    expect(categoryLabelFr('ABONNEMENT_SALLE')).toBe('Abonnement salle');
  });
});

describe('BillsService.receiptPdf — droits', () => {
  const USER = { id: 'u1', email: 'c@x.fr', firstName: 'Mamadou', lastName: 'Barry', role: 'USER', kycLevel: 'LEVEL_2', clientId: 7, isActive: true, isSuspended: false, deletedAt: null, primaryCurrency: 'GNF' };
  const biller = { id: 'b1', name: 'EDG', category: 'ELECTRICITY', currency: 'GNF', referenceLabel: 'N° de compteur', fields: [], settlementDelayHours: 24 };
  const dec = (n: number) => ({ toString: () => String(n), valueOf: () => n });
  const payment = (over: Record<string, unknown> = {}) => ({
    id: 'p1', reference: 'FAC-ABC123-0F0F0F', clientId: 7, payerId: 'u1', accountRef: '0123456789', fields: null, customerName: 'Mamadou D.', status: 'COMPLETED',
    amount: dec(100000), fee: dec(0), rate: dec(1), amountCharged: dec(100000), feeCharged: dec(0), totalCharged: dec(100000), currency: 'GNF', walletCurrency: 'GNF',
    providerRef: 'X1', token: null, receiptNote: null, failureReason: null, connectorKey: 'manual', createdAt: new Date('2026-11-16T09:00:00Z'), completedAt: new Date('2026-11-16T10:00:00Z'), refundedAt: null, biller, ...over,
  });
  const make = (row: unknown) => {
    const prisma: any = {
      user: { findUnique: jest.fn(async () => USER) },
      billPayment: { findFirst: jest.fn(async ({ where }: any) => (row && (row as any).payerId === where.payerId && (row as any).id === where.id ? row : null)) },
      client: { findUnique: jest.fn(async () => ({ name: 'Flash Transfer', address: null, city: 'Conakry', phone: null, email: null, contactPhone: null, contactEmail: null, primaryColor: '#059669' })) },
    };
    return new BillsService(prisma, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  };
  const auth = { id: 'u1', role: 'USER' } as never;

  it('facture réglée du payeur : PDF et nom de fichier', async () => {
    const r = await make(payment()).receiptPdf(auth, 'p1');
    expect(r.filename).toBe('recu-FAC-ABC123-0F0F0F.pdf');
    expect(r.buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('pas de reçu avant le règlement, ni pour la facture d\'un autre', async () => {
    await expect(make(payment({ status: 'SUBMITTED', completedAt: null })).receiptPdf(auth, 'p1')).rejects.toThrow(ConflictException);
    await expect(make(payment({ status: 'REFUNDED' })).receiptPdf(auth, 'p1')).rejects.toThrow(ConflictException);
    await expect(make(payment({ payerId: 'u2' })).receiptPdf(auth, 'p1')).rejects.toThrow(NotFoundException);
  });
});

describe('bills.verify-page', () => {
  it('reçu authentique : données affichées et échappées', () => {
    const html = renderBillVerifyPage({ valid: true, biller: '<b>EDG</b>', amount: 100000, currency: 'GNF', accountRef: '••••6789', providerRef: null, completedAt: new Date('2026-11-16T10:00:00Z') });
    expect(html).toContain('authentique');
    expect(html).not.toContain('<b>EDG</b>');
    expect(html).toContain('&lt;b&gt;EDG');
  });

  it('reçu non reconnu : message de refus', () => {
    expect(renderBillVerifyPage({ valid: false })).toContain('non reconnu');
  });
});
