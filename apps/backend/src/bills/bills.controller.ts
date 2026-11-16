// apps/backend/src/bills/bills.controller.ts
// =========================================================
// PAIEMENT DE FACTURES — API du client (application mobile)
//   GET    /bills/options                    activé ? catégories disponibles, nombre de factures enregistrées
//   GET    /bills/billers[?category&q]       facturiers de ma société
//   GET    /bills/billers/:id
//   POST   /bills/billers/:id/lookup         { reference, fields? }                  titulaire (masqué) + montant dû
//   POST   /bills/billers/:id/quote          { reference, amount, walletCurrency? }  frais, taux, total débité, solde suffisant ?
//   POST   /bills/billers/:id/pay            { …, pin, idempotencyKey, saveAs? }     paiement (code secret exigé)
//   GET    /bills/payments[?status&page]     mes factures      ·   GET /bills/payments/:id  détail + reçu
//   GET    /bills/saved · POST /bills/saved · DELETE /bills/saved/:id
//   GET    /bills/schedules                  mes factures programmées (réglages de la société inclus)
//   POST   /bills/schedules                  programmer (rappel, ou prélèvement automatique avec code secret)
//   PATCH  /bills/schedules/:id · POST /bills/schedules/:id/pause · POST /bills/schedules/:id/resume · DELETE /bills/schedules/:id
//   GET    /bills/payments/:id/receipt.pdf   reçu en PDF (payeur uniquement, facture réglée)
//   GET    /bills/verify/:code               (public) vérification d'un reçu : page web (navigateur) ou JSON (application)
// =========================================================

import { Body, Controller, Delete, ForbiddenException, Get, Header, Param, Patch, Post, Query, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Public } from '../common/decorators/public.decorator';
import { BillsRecurringService } from './bills-recurring.service';
import { renderBillVerifyPage } from './bills.verify-page';
import { BillsService } from './bills.service';
import {
  BillersQueryDto, BillLookupDto, BillQuoteDto, CreateBillScheduleDto, MyBillsQueryDto, PayBillDto, ResumeBillScheduleDto, SaveBillDto, UpdateBillScheduleDto,
} from './dto/bills.dto';

type AuthRequest = Request & { user?: AuthUserPayload };
const me = (req: AuthRequest): AuthUserPayload => {
  if (!req.user) throw new ForbiddenException('Non authentifié');
  return req.user;
};

@ApiTags('Factures')
@Controller('bills')
export class BillsController {
  constructor(private readonly bills: BillsService, private readonly recurring: BillsRecurringService) {}

  // Vérification publique : déclarée AVANT les routes à paramètre, limitée en débit (anti-énumération).
  @Public()
  @Get('verify/:code')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  async verify(@Param('code') code: string, @Req() req: Request, @Res() res: Response) {
    const result = await this.bills.verifyReceipt(String(code ?? '').slice(0, 120));
    if (req.accepts(['json', 'html']) === 'html') {
      res.status(result.valid ? 200 : 404).type('html').send(renderBillVerifyPage(result));
      return;
    }
    res.status(result.valid ? 200 : 404).json(result);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('options')
  options(@Req() req: AuthRequest) {
    return this.bills.options(me(req));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('billers')
  listBillers(@Req() req: AuthRequest, @Query() q: BillersQueryDto) {
    return this.bills.listBillers(me(req), q);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('billers/:id')
  getBiller(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.bills.getBiller(me(req), id);
  }

  // « Interroger la facture » : limité (un numéro de client ne doit pas pouvoir être énuméré).
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('billers/:id/lookup')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  lookup(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: BillLookupDto) {
    return this.bills.lookup(me(req), id, dto);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('billers/:id/quote')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  quote(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: BillQuoteDto) {
    return this.bills.quote(me(req), id, dto);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('billers/:id/pay')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  pay(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: PayBillDto) {
    return this.bills.pay(me(req), id, dto);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('payments')
  listMine(@Req() req: AuthRequest, @Query() q: MyBillsQueryDto) {
    return this.bills.listMine(me(req), q);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('payments/:id/receipt.pdf')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async receiptPdf(@Req() req: AuthRequest, @Param('id') id: string): Promise<StreamableFile> {
    const { buffer, filename } = await this.bills.receiptPdf(me(req), id);
    return new StreamableFile(buffer, { type: 'application/pdf', disposition: `attachment; filename="${filename}"`, length: buffer.length });
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('payments/:id')
  getOne(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.bills.getOne(me(req), id);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('saved')
  listSaved(@Req() req: AuthRequest) {
    return this.bills.listSaved(me(req));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('saved')
  save(@Req() req: AuthRequest, @Body() dto: SaveBillDto) {
    return this.bills.save(me(req), dto);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Delete('saved/:id')
  removeSaved(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.bills.removeSaved(me(req), id);
  }

  // ── Factures récurrentes (lot 14b) ─────────────────────

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('schedules')
  listSchedules(@Req() req: AuthRequest) {
    return this.recurring.list(me(req));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('schedules')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  createSchedule(@Req() req: AuthRequest, @Body() dto: CreateBillScheduleDto) {
    return this.recurring.create(me(req), dto);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Patch('schedules/:id')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  updateSchedule(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: UpdateBillScheduleDto) {
    return this.recurring.update(me(req), id, dto);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('schedules/:id/pause')
  pauseSchedule(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.recurring.pause(me(req), id);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('schedules/:id/resume')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  resumeSchedule(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: ResumeBillScheduleDto) {
    return this.recurring.resume(me(req), id, dto);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Delete('schedules/:id')
  removeSchedule(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.recurring.remove(me(req), id);
  }
}
