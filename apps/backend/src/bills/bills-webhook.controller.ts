// apps/backend/src/bills/bills-webhook.controller.ts
// POST /api/bills/webhook/:connectorKey — confirmation asynchrone d'un facturier (voir bills.webhook.ts pour la signature).
// Public (le partenaire n'a pas de compte) mais protégé par la signature HMAC ; limité en débit ; jamais mis en cache.

import { Body, Controller, Headers, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { Public } from '../common/decorators/public.decorator';
import { BillsWebhookService, type WebhookBody } from './bills-webhook.service';

@ApiTags('Factures — confirmations des facturiers')
@Public()
@Controller('bills/webhook')
export class BillsWebhookController {
  constructor(private readonly webhook: BillsWebhookService) {}

  @Post(':connectorKey')
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  handle(@Param('connectorKey') key: string, @Headers('x-bills-signature') signature: string | undefined, @Req() req: Request & { rawBody?: Buffer }, @Body() body: WebhookBody) {
    return this.webhook.handle(String(key ?? '').toLowerCase(), req.rawBody, signature, body ?? {});
  }
}
