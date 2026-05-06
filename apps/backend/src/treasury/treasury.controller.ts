// apps/backend/src/treasury/treasury.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';

import { TreasuryService } from './treasury.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';

@ApiTags('Treasury')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('treasury')
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}

  // ========================================================
  // VUE D'ENSEMBLE — Super Admin ou Company Admin
  // ========================================================

  @Get('overview')
  @ApiOperation({ summary: 'Trésorerie en temps réel (5 devises)' })
  async getOverview(@Req() req: Request & { user?: AuthUserPayload }) {
    const user = req.user;
    if (!user) throw new ForbiddenException('Non authentifié');

    if (user.role === 'SUPER_ADMIN') {
      return this.treasuryService.getGlobalOverview();
    }

    if (user.role === 'COMPANY_ADMIN' && user.clientId) {
      return this.treasuryService.getClientOverview(user.clientId);
    }

    throw new ForbiddenException('Accès réservé aux admins');
  }

  // ========================================================
  // SNAPSHOTS HISTORIQUES
  // ========================================================

  @Get('snapshots')
  @ApiOperation({ summary: 'Snapshots historiques de trésorerie' })
  @ApiQuery({ name: 'currency', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getSnapshots(
    @Req() req: Request & { user?: AuthUserPayload },
    @Query('currency') currency?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const user = req.user;
    if (!user) throw new ForbiddenException('Non authentifié');

    const clientId =
      user.role === 'SUPER_ADMIN' ? undefined : (user.clientId ?? undefined);

    return this.treasuryService.getSnapshots({
      clientId,
      currency,
      from,
      to,
      limit: limit ? parseInt(limit, 10) : 30,
    });
  }

  // ========================================================
  // TRIGGER SNAPSHOT MANUEL — Super Admin uniquement
  // ========================================================

  @Post('snapshot/trigger')
  @ApiOperation({ summary: 'Déclenche un snapshot manuel (Super Admin)' })
  async triggerSnapshot(@Req() req: Request & { user?: AuthUserPayload }) {
    if (req.user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Réservé au Super Admin');
    }
    await this.treasuryService.triggerManualSnapshot();
    return { success: true, message: 'Snapshot lancé' };
  }

  // ========================================================
  // AUTO-INJECTION — Company Admin uniquement
  // POST /treasury/admin/inject?currency=EUR&amount=1000
  // ========================================================

  @Post('admin/inject')
  @ApiOperation({
    summary: 'Auto-alimentation du portefeuille (Company Admin)',
    description:
      "Permet à un Company Admin de créditer son propre portefeuille dans la devise choisie, à volonté.",
  })
  @ApiQuery({ name: 'currency', required: true, example: 'EUR' })
  @ApiQuery({ name: 'amount', required: true, example: '250' })
  async injectFunds(
    @Req() req: Request & { user?: AuthUserPayload },
    @Query('currency') currency: string,
    @Query('amount') amount: string,
  ) {
    const user = req.user;
    if (!user) throw new ForbiddenException('Non authentifié');

    // ✅ Seul le Company Admin peut s'auto-alimenter
    if (user.role !== 'COMPANY_ADMIN' || !user.clientId) {
      throw new ForbiddenException(
        'Cette action est réservée aux admins société.',
      );
    }

    if (!currency) {
      throw new BadRequestException('Le paramètre "currency" est requis.');
    }

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      throw new BadRequestException('Le montant doit être un nombre supérieur à 0.');
    }

    return this.treasuryService.injectFunds({
      clientId: user.clientId,   // ✅ Résolu depuis le JWT
      currency,
      amount: parsedAmount,
      performedBy: user.id,      // ✅ Audit trail
    });
  }

  // ========================================================
  // AUTO-ALIMENTATION TOUTES DEVISES — Company Admin
  // POST /treasury/admin/inject-all  body: { amounts: { EUR: 1000, XOF: 500000 } }
  // ========================================================

  @Post('admin/inject-all')
  @ApiOperation({
    summary: 'Auto-alimentation sur toutes les devises en une passe (Company Admin)',
  })
  async injectAll(
    @Req() req: Request & { user?: AuthUserPayload },
    @Body() body: { amounts: Partial<Record<string, number>>; reason?: string },
  ) {
    const user = req.user;
    if (!user) throw new ForbiddenException('Non authentifié');

    if (user.role !== 'COMPANY_ADMIN' || !user.clientId) {
      throw new ForbiddenException(
        'Cette action est réservée aux admins société.',
      );
    }

    if (!body?.amounts || typeof body.amounts !== 'object') {
      throw new BadRequestException(
        'Le body doit contenir un objet "amounts" : { EUR: 1000, XOF: 500000, ... }',
      );
    }

    return this.treasuryService.selfFundAll({
      clientId: user.clientId,
      amounts: body.amounts,
      reason: body.reason,
    });
  }
}