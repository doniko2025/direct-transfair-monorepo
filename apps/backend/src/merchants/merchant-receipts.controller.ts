// apps/backend/src/merchants/merchant-receipts.controller.ts
// =========================================================
// PAGE DE VÉRIFICATION D'UN REÇU (lot 14) — publique.
//   GET /api/verify/receipt/:code
//     • navigateur / appareil photo du téléphone (Accept: text/html) → petite page « Reçu authentique » ou « non reconnu » ;
//     • application / autre client (Accept: application/json)        → JSON (ReceiptCheck).
// Limité en débit (anti-énumération). Réponse jamais mise en cache.
// =========================================================

import { Controller, Get, Header, Param, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { Public } from '../common/decorators/public.decorator';
import { MerchantReceiptsService, type ReceiptCheck } from './merchant-receipts.service';

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const METHOD = { PHONE: 'Téléphone', QR: 'QR code', STATIC_QR: 'QR de caisse' } as const;

function money(amount: number, currency: string): string {
  const n = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(amount);
  return `${n} ${currency === 'XOF' || currency === 'XAF' ? 'F CFA' : currency}`;
}

export function renderReceiptPage(r: ReceiptCheck): string {
  const row = (k: string, v: string) => `<div class="row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
  const body = r.valid
    ? `<div class="badge ${r.status === 'REFUNDED' ? 'warn' : 'ok'}">${r.status === 'REFUNDED' ? 'Reçu authentique — paiement REMBOURSÉ' : 'Reçu authentique'}</div>
       <div class="amount">${esc(money(r.amount, r.currency))}</div>
       ${row('Commerce', r.businessName)}${r.city ? row('Ville', r.city) : ''}
       ${row('Référence', r.reference)}
       ${row('Date du paiement', new Date(r.paidAt).toLocaleString('fr-FR', { timeZone: 'UTC' }) + ' UTC')}
       ${row('Moyen', METHOD[r.method])}
       ${r.refundedAt ? row('Remboursé le', new Date(r.refundedAt).toLocaleString('fr-FR', { timeZone: 'UTC' }) + ' UTC') : ''}
       <p class="hint">Comparez le <b>montant</b>, le <b>commerce</b> et la <b>référence</b> ci-dessus avec ceux écrits sur le reçu. S'ils diffèrent, le document a été modifié : ne l'acceptez pas.</p>`
    : `<div class="badge bad">Reçu non reconnu</div>
       <p class="hint">Ce code ne correspond à aucun paiement. Le document est falsifié, incomplet ou le QR code a été abîmé. Ne l'acceptez pas.</p>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Vérification de reçu</title><style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;background:#f4f4f2;margin:0;padding:24px;color:#111}
.card{max-width:460px;margin:0 auto;background:#fff;border-radius:20px;padding:24px;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.badge{display:inline-block;padding:8px 14px;border-radius:99px;font-weight:700;font-size:14px;margin-bottom:12px}
.ok{background:#e8f6ee;color:#17803d}.warn{background:#fff4e0;color:#a15c00}.bad{background:#fdeaea;color:#b42318}
.amount{font-size:34px;font-weight:800;margin:6px 0 14px}.row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #eee;font-size:14px}
.row span{color:#666}.hint{font-size:13px;color:#555;line-height:1.5;margin-top:16px}</style></head><body><div class="card">${body}</div></body></html>`;
}

@ApiTags('Vérification de reçu')
@Public()
@Controller('verify')
export class MerchantReceiptsController {
  constructor(private readonly receipts: MerchantReceiptsService) {}

  @Get('receipt/:code')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex')
  async verify(@Param('code') code: string, @Req() req: Request, @Res() res: Response) {
    const result = await this.receipts.verify(String(code ?? '').slice(0, 80));
    if (req.accepts(['json', 'html']) === 'html') {
      res.status(result.valid ? 200 : 404).type('html').send(renderReceiptPage(result));
      return;
    }
    res.status(result.valid ? 200 : 404).json(result);
  }
}
