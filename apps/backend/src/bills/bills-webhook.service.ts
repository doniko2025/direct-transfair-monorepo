// apps/backend/src/bills/bills-webhook.service.ts
// =========================================================
// CONFIRMATION ASYNCHRONE D'UN FACTURIER (lot 14b) — le partenaire annonce que la facture est réglée (ou refusée).
//   • signature vérifiée AVANT toute lecture en base (secret propre au connecteur, horodatage ≤ 5 min) ;
//   • un connecteur ne peut régler QUE les paiements de son propre type (un partenaire ne touche pas aux factures d'un autre) ;
//   • idempotent : la même confirmation reçue deux fois (le partenaire réessaie) ne règle ni ne rembourse deux fois ;
//   • COMPLETED → facture réglée (reçu, client prévenu) · FAILED → client remboursé, comme un refus de la société.
// Réponses volontairement sobres : rien sur le contenu des factures n'est révélé à un appelant non authentifié.
// =========================================================

import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { BillConnectorsService } from './bills.connectors';
import { verifyWebhook, webhookSecretFor } from './bills.webhook';
import { BillsSettlementService } from './bills-settlement.service';

export interface WebhookBody {
  reference?: unknown;
  status?: unknown;
  providerRef?: unknown;
  token?: unknown;
  message?: unknown;
}

const str = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

@Injectable()
export class BillsWebhookService {
  private readonly logger = new Logger(BillsWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settlement: BillsSettlementService,
    private readonly connectors: BillConnectorsService,
  ) {}

  async handle(connectorKey: string, rawBody: Buffer | string | undefined, signature: unknown, body: WebhookBody): Promise<{ ok: true; status: string }> {
    const secret = /^[a-z0-9_-]{2,40}$/.test(connectorKey) ? webhookSecretFor(connectorKey) : null;
    // Connecteur inconnu ou sans secret : l'adresse n'existe pas.
    if (!secret || !this.connectors.get(connectorKey)) throw new NotFoundException();
    if (!rawBody || (typeof rawBody !== 'string' && rawBody.length === 0)) throw new BadRequestException('Corps manquant.');

    const check = verifyWebhook({ secret, header: signature, rawBody });
    if (!check.ok) {
      this.logger.warn(`Webhook factures « ${connectorKey} » refusé : ${check.reason}`);
      throw new UnauthorizedException('Signature invalide.');
    }

    const reference = str(body.reference, 40);
    const status = body.status === 'COMPLETED' || body.status === 'FAILED' ? body.status : null;
    if (!reference || !status) throw new BadRequestException('« reference » et « status » (COMPLETED ou FAILED) sont requis.');

    const payment = await this.prisma.billPayment.findUnique({ where: { reference }, select: { id: true, status: true, connectorKey: true } });
    if (!payment || payment.connectorKey !== connectorKey) throw new NotFoundException('Paiement introuvable.');

    // Déjà réglé / remboursé : on répond « ok » sans rien refaire (le partenaire réessaie jusqu'à recevoir un 2xx).
    if (payment.status === 'COMPLETED' || payment.status === 'REFUNDED') return { ok: true, status: payment.status };

    if (status === 'COMPLETED') {
      await this.settlement.complete(payment.id, { providerRef: str(body.providerRef, 80), token: str(body.token, 120), receiptNote: str(body.message, 300) });
      this.logger.log(`Webhook « ${connectorKey} » : facture ${reference} réglée.`);
      return { ok: true, status: 'COMPLETED' };
    }
    await this.settlement.fail(payment.id, { reason: str(body.message, 300) ?? 'Paiement refusé par le facturier.' });
    this.logger.log(`Webhook « ${connectorKey} » : facture ${reference} refusée, client remboursé.`);
    return { ok: true, status: 'REFUNDED' };
  }
}
