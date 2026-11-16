// apps/backend/src/bills/bills.receipt.ts
// =========================================================
// REÇU DE FACTURE (lot 14) — un reçu partagé (capture d'écran, PDF, WhatsApp) peut être retouché. Il porte donc un code
// `RÉFÉRENCE.SIGNATURE` que n'importe qui (la société de l'élève, le propriétaire, l'assureur…) peut faire vérifier par le serveur :
// celui-ci répond avec les VRAIES données (facturier, montant, date, statut). La signature (HMAC) empêche de lister des reçus
// en devinant des références. Même clé que les reçus marchands : RECEIPT_SIGNING_SECRET, à défaut JWT_SECRET.
// =========================================================

import { timingSafeEqual } from 'crypto';

import { sealSignature } from '../merchants/receipt-seal';

export interface BillSealInput {
  id: string;
  reference: string;
  amount: number | string | { toString(): string };
  currency: string;
  completedAt: Date | string;
}

const CODE_RE = /^(FAC-[A-Z0-9]{4,14}-[A-F0-9]{6})\.([A-Za-z0-9_-]{22})$/;

const asSeal = (p: BillSealInput) => ({ id: p.id, reference: p.reference, amount: p.amount, currency: p.currency, paidAt: p.completedAt });

export const billReceiptCode = (p: BillSealInput): string => `${p.reference}.${sealSignature(asSeal(p))}`;

export function parseBillReceiptCode(raw: unknown): { reference: string; signature: string } | null {
  const m = typeof raw === 'string' ? CODE_RE.exec(raw.trim()) : null;
  return m ? { reference: m[1], signature: m[2] } : null;
}

export function isValidBillSignature(p: BillSealInput, signature: string): boolean {
  const expected = Buffer.from(sealSignature(asSeal(p)));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
