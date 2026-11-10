import { buildTransferReceipt, isPayableNow, kindOf, maskName, statusInfo, type ReceiptCompany, type ReceiptSource } from './transfer-receipt';
import { renderTransferCheckPage } from './transfer-check-page';

const company: ReceiptCompany = {
  name: 'Flash Transfer', legalName: 'Flash Transfer SAS', logoUrl: 'https://x.test/logo.png', address: 'Kaloum', city: 'Conakry', phone: '+224600000000',
  email: 'aide@flash.test', website: 'flash.test', licence: 'BCRG — N° 12', capital: '1 000 000 GNF', primaryColor: '#059669',
};
const NOW = new Date('2026-11-10T10:00:00Z');

function src(over: Partial<ReceiptSource['tx']> = {}, extra: Partial<ReceiptSource> = {}): ReceiptSource {
  return {
    tx: {
      id: 't1', reference: '482915370', type: 'TRANSFER', status: 'VALIDATED', payoutMethod: 'CASH_PICKUP', amount: '100', fees: '3', total: '103',
      currency: 'EUR', targetCurrency: 'GNF', exchangeRate: 10000, receivedAmount: '1000000', createdAt: new Date('2026-11-01T10:00:00Z'),
      pickupExpiry: new Date('2027-04-01T00:00:00Z'), senderId: 'u-sender', recipientId: null, counterCustomerId: null, ...over,
    },
    sender: { firstName: 'Awa', lastName: 'Camara', phone: '+33600000000', country: 'FR', city: 'Paris' },
    counterCustomer: null,
    recipient: null,
    beneficiary: { fullName: 'Moustapha Diallo', phone: '+224611111111', country: 'GN', city: 'Labé' },
    agency: { name: 'Agence Paris 18', city: 'Paris' },
    withdrawal: { status: 'PENDING', expiresAt: new Date('2027-04-01T00:00:00Z'), processedAt: null, processedBy: null },
    ...extra,
  };
}
const build = (s: ReceiptSource, viewer = { id: 'u-sender', role: 'USER' }, phoneCheckRequired = false) =>
  buildTransferReceipt({ src: s, company, viewer, qrCode: 'TF482915370.abcdefghijklmnopqrstuv', phoneCheckRequired, now: NOW });

describe('reçu d\'envoi — document', () => {
  it('envoi cash en attente : à retirer, montant converti en avant, code visible de l\'expéditeur, QR payable', () => {
    const d = build(src());
    expect(d.kind).toBe('CASH_TRANSFER');
    expect(d.hero).toEqual({ label: 'Montant à retirer', amount: 1000000, currency: 'GNF' });
    expect(d.amounts).toMatchObject({ sent: 100, sentCurrency: 'EUR', fees: 3, total: 103, rate: 10000, received: 1000000, receivedCurrency: 'GNF' });
    expect(d.withdrawalCode).toBe('482915370');
    expect(d.qr.payable).toBe(true);
    expect(d.expiresAt).toBe('2027-04-01T00:00:00.000Z');
    expect(d.recipient.name).toBe('Moustapha Diallo');
    expect(d.statusLabel).toContain('À RETIRER');
  });

  it('le code de retrait n\'est montré ni à l\'agent qui paie ni à un admin', () => {
    expect(build(src(), { id: 'agent', role: 'AGENT' }).withdrawalCode).toBeNull();
    expect(build(src(), { id: 'adm', role: 'COMPANY_ADMIN' }).withdrawalCode).toBeNull();
  });

  it('contrôle du téléphone exigé : l\'agent qui va payer ne lit pas le numéro du bénéficiaire ; l\'expéditeur oui', () => {
    const agent = build(src(), { id: 'agent', role: 'AGENT' }, true);
    expect(agent.recipient.phone).toBeNull();
    expect(agent.recipientPhoneHidden).toBe(true);
    expect(build(src(), { id: 'u-sender', role: 'USER' }, true).recipient.phone).toBe('+224611111111');
  });

  it('envoi payé : montant payé, agence payeuse et agent, signatures, QR non payable, plus de code ni d\'échéance', () => {
    const s = src({ status: 'PAID', paidAt: new Date('2026-11-03T12:00:00Z') }, {
      withdrawal: { status: 'PAID', expiresAt: null, processedAt: new Date('2026-11-03T12:00:00Z'), processedBy: { firstName: 'Ibrahima', lastName: 'Sow', agency: { name: 'Agence Labé', city: 'Labé' } } },
    });
    const d = build(s, { id: 'agent', role: 'AGENT' });
    expect(d.hero.label).toBe('Montant payé');
    expect(d.statusLabel).toBe('PAYÉ');
    expect(d.agency).toMatchObject({ payerName: 'Agence Labé', payerAgent: 'Ibrahima Sow', originName: 'Agence Paris 18' });
    expect(d.qr.payable).toBe(false);
    expect(d.expiresAt).toBeNull();
    expect(d.showSignatures).toBe(true);
    expect(d.paidAt).toBe('2026-11-03T12:00:00.000Z');
  });

  it('code expiré ou retrait clos : le QR ne sert plus à payer', () => {
    expect(build(src({ pickupExpiry: new Date('2026-11-09T00:00:00Z') })).qr.payable).toBe(false);
    expect(build(src({ status: 'CANCELLED' })).qr.payable).toBe(false);
    expect(build(src({}, { withdrawal: { status: 'REJECTED', expiresAt: null, processedAt: null, processedBy: null } })).qr.payable).toBe(false);
  });

  it('expéditeur de passage (comptoir) : le client de passage est l\'expéditeur', () => {
    const d = build(src({ senderId: 'agent', counterCustomerId: 'c1' }, { counterCustomer: { firstName: 'Mariam', lastName: 'Bah', phone: '+224622222222' } }), { id: 'agent', role: 'AGENT' });
    expect(d.sender.name).toBe('Mariam Bah');
    expect(d.sender.phone).toBe('+224622222222');
    expect(d.viewerSide).toBe('AGENT');
  });

  it('sans conversion : pas de taux, montant en devise d\'envoi', () => {
    const d = build(src({ targetCurrency: null, receivedAmount: null, exchangeRate: null }));
    expect(d.amounts.rate).toBeNull();
    expect(d.hero).toMatchObject({ amount: 100, currency: 'EUR' });
  });

  it('le document ne contient aucune donnée confidentielle (commission, risque, notes)', () => {
    const json = JSON.stringify(build(src({ ...({ riskScore: 80, commissionSplit: { a: 1 }, note: 'secret' } as object) })));
    for (const w of ['commission', 'riskScore', 'secret', 'Split']) expect(json).not.toContain(w);
  });

  it('transfert vers portefeuille : titre dédié, crédité côté destinataire', () => {
    const d = build(src({ payoutMethod: 'WALLET', status: 'PAID', recipientId: 'u-rec' }, { recipient: { firstName: 'Fanta', lastName: 'Keita', phone: '+22', country: 'GN', city: null }, beneficiary: null }), { id: 'u-rec', role: 'USER' });
    expect(d.kind).toBe('WALLET_TRANSFER');
    expect(d.viewerSide).toBe('RECIPIENT');
    expect(d.hero.label).toBe('Montant crédité');
    expect(d.showSignatures).toBe(false);
  });
});

describe('reçu — petits utilitaires', () => {
  it('kindOf / statusInfo / isPayableNow', () => {
    expect(kindOf('DEPOSIT', 'CASH_PICKUP')).toBe('DEPOSIT');
    expect(kindOf('SCHEDULED', 'CASH_PICKUP')).toBe('CASH_TRANSFER');
    expect(statusInfo('PAID', 'DEPOSIT').label).toBe('DÉPOSÉ');
    expect(isPayableNow({ type: 'DEPOSIT', status: 'VALIDATED', payoutMethod: 'CASH_PICKUP' }, null, NOW)).toBe(false);
  });
  it('maskName', () => {
    expect(maskName('Moustapha Diallo')).toBe('Moustapha D.');
    expect(maskName('Awa')).toBe('Awa');
    expect(maskName(null)).toBe('—');
  });
});

describe('page publique de vérification', () => {
  const ok = { valid: true as const, reference: '482915370', companyName: 'Flash <b>', status: 'VALIDATED', statusLabel: 'DISPONIBLE — À RETIRER', statusTone: 'info' as const, title: 'Envoi', amount: 1000000, currency: 'GNF', sentAmount: 100, sentCurrency: 'EUR', createdAt: '2026-11-01T10:00:00.000Z', paidAt: null, sender: 'Awa C.', recipient: 'Moustapha D.', payable: true };
  it('affiche les infos comparables, échappe le HTML et propose l\'ouverture dans l\'app agent quand payable', () => {
    const html = renderTransferCheckPage(ok, 'TF482915370.abc');
    expect(html).toContain('Moustapha D.');
    expect(html).toContain('Flash &lt;b&gt;');
    expect(html).toContain('directtransfair://agent/withdraw?code=TF482915370.abc');
  });
  it('payé : pas de bouton de paiement ; invalide : message neutre', () => {
    expect(renderTransferCheckPage({ ...ok, payable: false, status: 'PAID' }, 'x')).not.toContain('directtransfair://');
    expect(renderTransferCheckPage({ valid: false }, 'x')).toContain('Reçu non reconnu');
  });
});
