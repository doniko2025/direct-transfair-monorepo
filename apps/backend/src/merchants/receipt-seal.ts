// apps/backend/src/merchants/receipt-seal.ts
// =========================================================
// SCEAU DU REÇU (lot 14) — un reçu PDF est généré sur le téléphone et peut être retouché. Chaque reçu porte donc un QR code qui
// pointe vers le serveur : celui-ci répond avec les VRAIES données du paiement (commerce, montant, date, statut), qu'on compare à
// ce qui est imprimé. Le code `RÉFÉRENCE.SIGNATURE` n'est pas devinable : la signature (HMAC-SHA256 du paiement) empêche de lister
// des reçus en essayant des références. Fonctions pures — aucune dépendance Nest/Prisma, testables seules.
// Clé : RECEIPT_SIGNING_SECRET (conseillé), à défaut JWT_SECRET. Changer la clé invalide les QR déjà imprimés.
// =========================================================

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const SIG_LENGTH = 22;
const CODE_RE = /^(MP-[A-Z0-9]{4,14}-[A-F0-9]{6})\.([A-Za-z0-9_-]{22})$/;

let fallbackKey: string | null = null;

/** Clé de signature. En développement sans secret : clé aléatoire du processus (les QR ne survivent pas à un redémarrage). */
export function sealKey(): string {
  const s = process.env.RECEIPT_SIGNING_SECRET || process.env.JWT_SECRET;
  if (s && s.length >= 16) return s;
  if (!fallbackKey) fallbackKey = randomBytes(32).toString('hex');
  return fallbackKey;
}

export interface SealInput {
  id: string;
  reference: string;
  amount: number | string | { toString(): string };
  currency: string;
  paidAt: Date | string;
}

/** Montant normalisé (« 10000 », « 12.5 ») : le même texte quelle que soit la source (Decimal, nombre, chaîne). */
const amountText = (a: SealInput['amount']): string => String(Number(a.toString()));
const timeText = (d: Date | string): string => new Date(d).toISOString();

export function sealSignature(p: SealInput, key: string = sealKey()): string {
  return createHmac('sha256', key)
    .update(`v1|${p.id}|${p.reference}|${amountText(p.amount)}|${p.currency}|${timeText(p.paidAt)}`)
    .digest('base64url')
    .slice(0, SIG_LENGTH);
}

/** Code imprimé sur le reçu (et encodé dans le QR). */
export function receiptCode(p: SealInput, key?: string): string {
  return `${p.reference}.${sealSignature(p, key)}`;
}

/** Sépare un code saisi/scanné ; null s'il n'a pas la bonne forme. */
export function parseReceiptCode(raw: unknown): { reference: string; signature: string } | null {
  if (typeof raw !== 'string') return null;
  const m = CODE_RE.exec(raw.trim());
  return m ? { reference: m[1]!, signature: m[2]! } : null;
}

export function verifySeal(p: SealInput, signature: string, key?: string): boolean {
  const expected = Buffer.from(sealSignature(p, key));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
