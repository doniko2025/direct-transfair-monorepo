// apps/backend/src/merchants/merchant-receipts.service.ts
// =========================================================
// VÉRIFICATION D'UN REÇU (lot 14) — public (le QR du reçu s'ouvre depuis n'importe quel téléphone, sans compte).
// Renvoie uniquement ce qu'il faut pour comparer avec le reçu : commerce, montant, devise, date, moyen, statut (payé / remboursé).
// Jamais le nom du client, ni les commissions, ni le solde. Un code faux ou inconnu donne toujours la même réponse (pas d'indice).
// =========================================================

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { parseReceiptCode, verifySeal } from './receipt-seal';

export type ReceiptCheck =
  | {
      valid: true;
      reference: string;
      businessName: string;
      city: string | null;
      amount: number;
      currency: string;
      paidAt: string;
      method: 'PHONE' | 'QR' | 'STATIC_QR';
      status: 'PAID' | 'REFUNDED';
      refundedAt: string | null;
    }
  | { valid: false };

@Injectable()
export class MerchantReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  async verify(code: string): Promise<ReceiptCheck> {
    const parsed = parseReceiptCode(code);
    if (!parsed) return { valid: false };
    const r = await this.prisma.paymentRequest.findUnique({
      where: { reference: parsed.reference },
      select: {
        id: true, reference: true, status: true, amount: true, currency: true, paidAt: true, method: true, viaStaticQr: true, refundedAt: true,
        payee: { select: { firstName: true, lastName: true, merchantProfile: { select: { businessName: true, city: true } } } },
      },
    });
    if (!r || r.status !== 'PAID' || !r.paidAt) return { valid: false };
    if (!verifySeal({ id: r.id, reference: r.reference, amount: r.amount, currency: String(r.currency), paidAt: r.paidAt }, parsed.signature)) return { valid: false };
    const shop = r.payee.merchantProfile;
    return {
      valid: true,
      reference: r.reference,
      businessName: shop?.businessName ?? ([r.payee.firstName, r.payee.lastName].filter(Boolean).join(' ') || 'Commerce'),
      city: shop?.city ?? null,
      amount: Number(r.amount),
      currency: String(r.currency),
      paidAt: r.paidAt.toISOString(),
      method: r.viaStaticQr ? 'STATIC_QR' : r.method === 'PHONE' ? 'PHONE' : 'QR',
      status: r.refundedAt ? 'REFUNDED' : 'PAID',
      refundedAt: r.refundedAt ? r.refundedAt.toISOString() : null,
    };
  }
}
