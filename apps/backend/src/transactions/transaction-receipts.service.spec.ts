import { TransactionReceiptsService, companyOf } from './transaction-receipts.service';
import { transferReceiptCode } from './transfer-receipt-seal';

const row = {
  id: 't1', reference: '482915370', type: 'TRANSFER', status: 'VALIDATED', payoutMethod: 'CASH_PICKUP', amount: '100', currency: 'EUR', targetCurrency: 'GNF',
  receivedAmount: '1000000', createdAt: new Date('2026-11-01T10:00:00Z'), paidAt: null, pickupExpiry: new Date('2099-01-01T00:00:00Z'), deletedAt: null,
  sender: { firstName: 'Awa', lastName: 'Camara' }, counterCustomer: null, recipient: null, beneficiary: { fullName: 'Moustapha Diallo' },
  withdrawal: { status: 'PENDING' }, client: { name: 'Flash Transfer' },
};
const make = (r: unknown) => {
  const prisma: any = { transaction: { findUnique: jest.fn().mockResolvedValue(r) } };
  return { svc: new TransactionReceiptsService(prisma, {} as any, {} as any), prisma };
};

describe('TransactionReceiptsService.check (page publique)', () => {
  it('code signé valide : infos comparables avec noms réduits, jamais de téléphone', async () => {
    const { svc } = make(row);
    const r: any = await svc.check(transferReceiptCode(row as any));
    expect(r.valid).toBe(true);
    expect(r).toMatchObject({ companyName: 'Flash Transfer', amount: 1000000, currency: 'GNF', recipient: 'Moustapha D.', sender: 'Awa C.', payable: true });
    expect(JSON.stringify(r)).not.toMatch(/phone|\+\d{6}/);
  });
  it('signature fausse, référence inconnue, texte quelconque ou envoi supprimé : même réponse « non valide »', async () => {
    expect(await make(row).svc.check('TF482915370.AAAAAAAAAAAAAAAAAAAAAA')).toEqual({ valid: false });
    expect(await make(null).svc.check(transferReceiptCode(row as any))).toEqual({ valid: false });
    expect(await make(row).svc.check('hello')).toEqual({ valid: false });
    expect(await make({ ...row, deletedAt: new Date() }).svc.check(transferReceiptCode(row as any))).toEqual({ valid: false });
  });
  it('montant retouché en base après émission → signature rejetée', async () => {
    const code = transferReceiptCode(row as any);
    expect(await make({ ...row, amount: '9000' }).svc.check(code)).toEqual({ valid: false });
  });
});

describe('companyOf', () => {
  it('assemble l\'agrément et préfère l\'email d\'assistance', () => {
    const c = companyOf({ name: 'F', legalCompanyName: 'F SAS', logoUrl: null, address: null, city: null, phone: null, email: 'a@x', website: null, supportEmail: 's@x',
      regulatorName: 'Banque Centrale', regulatorAcronym: 'BCRG', regulatorLicenseNumber: 'N° 12', regulatorLicenseType: 'Établissement de paiement', capitalSocial: null, primaryColor: null });
    expect(c.licence).toBe('Établissement de paiement — BCRG — N° 12');
    expect(c.email).toBe('s@x');
  });
});
