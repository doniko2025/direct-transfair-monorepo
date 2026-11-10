// apps/backend/src/transactions/transaction-receipts.controller.ts
// =========================================================
//   GET /api/transactions/:id/receipt   (connecté)  → document du reçu, mêmes droits de lecture que le détail de l'opération
//   GET /api/verify/transfer/:code      (public)    → page « reçu authentique » (navigateur / caméra) ou JSON (application, scanette)
// Limité en débit (anti-énumération), jamais mis en cache.
// =========================================================

import { Controller, ForbiddenException, Get, Header, Param, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { TransactionReceiptsService } from './transaction-receipts.service';
import { renderTransferCheckPage } from './transfer-check-page';

@ApiTags('Reçus')
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionReceiptsController {
  constructor(private readonly receipts: TransactionReceiptsService) {}

  @Get(':id/receipt')
  @Header('Cache-Control', 'private, no-store')
  async receipt(@Req() req: Request & { user?: { id?: string } }, @Param('id') id: string) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('Non authentifié');
    return this.receipts.forUser(id, userId);
  }
}

@ApiTags('Vérification de reçu')
@Public()
@Controller('verify')
export class TransferVerifyController {
  constructor(private readonly receipts: TransactionReceiptsService) {}

  @Get('transfer/:code')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex')
  async verify(@Param('code') code: string, @Req() req: Request, @Res() res: Response) {
    const clean = String(code ?? '').slice(0, 80);
    const result = await this.receipts.check(clean);
    if (req.accepts(['json', 'html']) === 'html') {
      res.status(result.valid ? 200 : 404).type('html').send(renderTransferCheckPage(result, clean));
      return;
    }
    res.status(result.valid ? 200 : 404).json(result);
  }
}
