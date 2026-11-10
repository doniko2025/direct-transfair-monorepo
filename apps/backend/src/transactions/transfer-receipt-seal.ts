// apps/backend/src/transactions/transfer-receipt-seal.ts
// =========================================================
// SCEAU DU REÇU D'ENVOI — le QR code d'un reçu de transfert porte un code SIGNÉ : `TF<référence>.<signature>`.
//  • il prouve que le reçu a été émis par la plateforme (une référence inventée, ou un montant retouché, ne donne pas la bonne signature) ;
//  • il permet à l'agent de PAYER en scannant le reçu (caméra du téléphone ou scanette), sans taper le code de retrait ;
//  • il ne révèle rien de plus que la référence déjà imprimée sur le reçu.
// Signature = HMAC-SHA256 de (identifiant, référence, montant, devise, date de création) avec la clé de la plateforme
// (RECEIPT_SIGNING_SECRET, à défaut JWT_SECRET — même clé que les reçus marchands, préfixe de domaine différent : un sceau marchand
// ne peut pas être rejoué ici). Fonctions pures, testées dans transfer-receipt-seal.spec.ts.
// =========================================================

import { createHmac, timingSafeEqual } from 'crypto';

import { sealKey } from '../merchants/receipt-seal';

const SIG_LENGTH = 22;
/** Un code signé, où qu'il se trouve dans un texte (adresse complète du QR, code collé, saisie d'une scanette). */
const CODE_IN_TEXT = /TF(\d{6,14})\.([A-Za-z0-9_-]{22})/;

export interface TransferSealInput {
  id: string;
  reference: string;
  amount: number | string | { toString(): string };
  currency: string;
  createdAt: Date | string;
}

const amountText = (a: TransferSealInput['amount']): string => String(Number(a.toString()));

export function transferSignature(t: TransferSealInput, key: string = sealKey()): string {
  return createHmac('sha256', key)
    .update(`tr1|${t.id}|${t.reference}|${amountText(t.amount)}|${t.currency}|${new Date(t.createdAt).toISOString()}`)
    .digest('base64url')
    .slice(0, SIG_LENGTH);
}

/** Code imprimé sur le reçu et encodé dans le QR. */
export function transferReceiptCode(t: TransferSealInput, key?: string): string {
  return `TF${t.reference}.${transferSignature(t, key)}`;
}

/** Cherche un code signé dans un texte (adresse du QR, saisie scanette…). null si le texte n'en contient pas. */
export function extractTransferReceiptCode(raw: unknown): { reference: string; signature: string } | null {
  if (typeof raw !== 'string') return null;
  let text = raw.trim();
  try {
    text = decodeURIComponent(text);
  } catch {
    /* texte pris tel quel */
  }
  const m = CODE_IN_TEXT.exec(text);
  return m ? { reference: m[1]!, signature: m[2]! } : null;
}

export function verifyTransferSeal(t: TransferSealInput, signature: string, key?: string): boolean {
  const expected = Buffer.from(transferSignature(t, key));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
