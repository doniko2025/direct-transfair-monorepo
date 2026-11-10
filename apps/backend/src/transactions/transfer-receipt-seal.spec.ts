// apps/backend/src/transactions/transfer-receipt-seal.spec.ts
import { extractTransferReceiptCode, transferReceiptCode, transferSignature, verifyTransferSeal } from './transfer-receipt-seal';

const KEY = 'une-cle-de-test-assez-longue-123456';
const tx = { id: 'cl1', reference: '594051326', amount: '100000.0000', currency: 'GNF', createdAt: new Date('2026-09-15T14:47:00Z') };

describe('sceau du reçu d\'envoi', () => {
  it('code TF<référence>.<signature de 22 caractères>, stable pour un même envoi', () => {
    const c = transferReceiptCode(tx, KEY);
    expect(c).toMatch(/^TF594051326\.[A-Za-z0-9_-]{22}$/);
    expect(transferReceiptCode({ ...tx, amount: 100000 }, KEY)).toBe(c); // « 100000.0000 » et 100000 : même texte normalisé
  });

  it('un montant, une devise, une référence ou une date retouchés invalident la signature', () => {
    const sig = transferSignature(tx, KEY);
    expect(verifyTransferSeal(tx, sig, KEY)).toBe(true);
    expect(verifyTransferSeal({ ...tx, amount: 1_000_000 }, sig, KEY)).toBe(false);
    expect(verifyTransferSeal({ ...tx, currency: 'XOF' }, sig, KEY)).toBe(false);
    expect(verifyTransferSeal({ ...tx, reference: '594051327' }, sig, KEY)).toBe(false);
    expect(verifyTransferSeal({ ...tx, createdAt: new Date('2026-09-16T00:00:00Z') }, sig, KEY)).toBe(false);
    expect(verifyTransferSeal(tx, sig, 'une-autre-cle-de-test-0123456789')).toBe(false);
    expect(verifyTransferSeal(tx, 'x', KEY)).toBe(false);
  });

  it('retrouve le code dans l\'adresse du QR, dans un texte collé ou saisi par une scanette', () => {
    const c = transferReceiptCode(tx, KEY);
    const sig = c.split('.')[1];
    for (const raw of [c, `https://api.exemple.com/api/verify/transfer/${c}`, `  ${c}\n`, encodeURIComponent(`https://x.io/v/${c}?a=1`)]) {
      expect(extractTransferReceiptCode(raw)).toEqual({ reference: '594051326', signature: sig });
    }
  });

  it('un code de retrait simple, un texte quelconque ou un sceau marchand ne sont pas des codes signés d\'envoi', () => {
    expect(extractTransferReceiptCode('594051326')).toBeNull();
    expect(extractTransferReceiptCode('MP-ABCD1234-A1B2C3.' + 'a'.repeat(22))).toBeNull();
    expect(extractTransferReceiptCode('TF12.court')).toBeNull();
    expect(extractTransferReceiptCode(undefined)).toBeNull();
  });
});
