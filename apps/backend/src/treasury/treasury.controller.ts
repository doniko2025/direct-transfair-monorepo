// apps/backend/src/treasury/treasury.controller.ts
// =========================================================
// TREASURY CONTROLLER v5.2 — FIX @Body sur inject/withdraw
// ✅ POST admin/inject   → @Body() au lieu de @Query()
// ✅ POST admin/withdraw → @Body() au lieu de @Query()
// =========================================================

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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';

import { TreasuryService } from './treasury.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import {
  InjectFundsDto,
  InjectAllDto,
  WithdrawFundsDto,
  GetOverviewQueryDto,
  GetSnapshotsQueryDto,
  TransferBetweenWalletsDto,
} from './dto/treasury.dto';

@ApiTags('Treasury')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('treasury')
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}

  // ========================================================
  // VUE D'ENSEMBLE — Super Admin ou Company Admin
  // GET /treasury/overview
  // ========================================================

  @Get('overview')
  @ApiOperation({
    summary: 'Trésorerie en temps réel (5 devises)',
    description:
      'Super Admin : vue globale. Company Admin : vue de sa société. Retourne les balances en XOF, EUR, USD, GNF, GBP.',
  })
  async getOverview(@Req() req: Request & { user?: AuthUserPayload }) {
    const user = req.user;
    if (!user) throw new ForbiddenException('Non authentifié');

    if (user.role === 'SUPER_ADMIN') {
      return this.treasuryService.getGlobalOverview();
    }

    if (user.role === 'COMPANY_ADMIN' && user.clientId) {
      return this.treasuryService.getClientOverview(user.clientId);
    }

    throw new ForbiddenException('Accès réservé aux Super Admin et Company Admin');
  }

  // ========================================================
  // SNAPSHOTS HISTORIQUES
  // GET /treasury/snapshots?currency=EUR&from=2025-01-01&to=2025-01-31
  // ========================================================

  @Get('snapshots')
  @ApiOperation({
    summary: 'Snapshots historiques de trésorerie',
    description:
      'Retourne les snapshots quotidiens (volumes, soldes) pour les 5 devises.',
  })
  @ApiQuery({ name: 'currency', required: false, description: 'XOF|EUR|USD|GNF|GBP' })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date (ex: 2025-01-01)' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date (ex: 2025-01-31)' })
  @ApiQuery({ name: 'limit', required: false, description: '1-100 (défaut: 30)' })
  async getSnapshots(
    @Req() req: Request & { user?: AuthUserPayload },
    @Query() query: GetSnapshotsQueryDto,
  ) {
    const user = req.user;
    if (!user) throw new ForbiddenException('Non authentifié');

    const clientId =
      user.role === 'SUPER_ADMIN' ? undefined : (user.clientId ?? undefined);

    return this.treasuryService.getSnapshots({
      clientId,
      currency: query.currency,
      from: query.from,
      to: query.to,
      limit: query.limit ?? 30,
    });
  }

  // ========================================================
  // TRIGGER SNAPSHOT MANUEL — Super Admin uniquement
  // POST /treasury/snapshot/trigger
  // ========================================================

  @Post('snapshot/trigger')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Déclenche un snapshot manuel (Super Admin)',
    description:
      "Enregistre immédiatement les balances actuelles en snapshot (au lieu d'attendre le cron quotidien).",
  })
  async triggerSnapshot(@Req() req: Request & { user?: AuthUserPayload }) {
    if (req.user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Réservé au Super Admin');
    }
    await this.treasuryService.triggerManualSnapshot();
    return { success: true, message: 'Snapshot lancé' };
  }

  // ========================================================
  // AUTO-INJECTION SIMPLE DEVISE — Company Admin uniquement
  // POST /treasury/admin/inject
  // Body: { currency: "EUR", amount: 1000 }
  // ✅ FIX v5.2 : @Body() au lieu de @Query()
  // ========================================================

  @Post('admin/inject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Auto-alimentation du portefeuille (Company Admin)',
    description:
      'Crédite le portefeuille de la société admin dans la devise choisie. Body JSON : { currency, amount }.',
  })
  async injectFunds(
    @Req() req: Request & { user?: AuthUserPayload },
    @Body() body: InjectFundsDto,   // ✅ @Body() — plus @Query()
  ) {
    const user = req.user;
    if (!user) throw new ForbiddenException('Non authentifié');

    if (user.role !== 'COMPANY_ADMIN' || !user.clientId) {
      throw new ForbiddenException(
        'Cette action est réservée aux admins société (COMPANY_ADMIN).',
      );
    }

    if (!body.currency) {
      throw new BadRequestException('Le champ "currency" est requis.');
    }

    const parsedAmount = Number(body.amount);
    if (!parsedAmount || parsedAmount <= 0) {
      throw new BadRequestException(
        'Le montant doit être un nombre supérieur à 0.',
      );
    }

    return this.treasuryService.injectFunds({
      clientId: user.clientId,
      currency: body.currency,
      amount: parsedAmount,
      performedBy: user.id,
      description: body.description || 'Auto-injection admin',
    });
  }

  // ========================================================
  // AUTO-ALIMENTATION MULTI-DEVISES — Company Admin
  // POST /treasury/admin/inject-all
  // Body: { amounts: { EUR: 1000, XOF: 500000 }, reason?: "..." }
  // ========================================================

  @Post('admin/inject-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Auto-alimentation sur toutes les devises (Company Admin)',
    description:
      'Crédite le portefeuille dans plusieurs devises en une seule requête.',
  })
  async injectAll(
    @Req() req: Request & { user?: AuthUserPayload },
    @Body() body: InjectAllDto,
  ) {
    const user = req.user;
    if (!user) throw new ForbiddenException('Non authentifié');

    if (user.role !== 'COMPANY_ADMIN' || !user.clientId) {
      throw new ForbiddenException(
        'Cette action est réservée aux admins société (COMPANY_ADMIN).',
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
      reason: body.reason || 'Auto-alimentation admin multi-devises',
    });
  }

  // ========================================================
  // RETRAIT — Company Admin
  // POST /treasury/admin/withdraw
  // Body: { currency: "EUR", amount: 500 }
  // ✅ FIX v5.2 : @Body() au lieu de @Query()
  // ========================================================

  @Post('admin/withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retrait du portefeuille (Company Admin)',
    description:
      'Débite le portefeuille de la société admin. Body JSON : { currency, amount }.',
  })
  async withdrawFunds(
    @Req() req: Request & { user?: AuthUserPayload },
    @Body() body: WithdrawFundsDto,   // ✅ @Body() — plus @Query()
  ) {
    const user = req.user;
    if (!user) throw new ForbiddenException('Non authentifié');

    if (user.role !== 'COMPANY_ADMIN' || !user.clientId) {
      throw new ForbiddenException(
        'Cette action est réservée aux admins société (COMPANY_ADMIN).',
      );
    }

    const parsedAmount = Number(body.amount);
    if (!parsedAmount || parsedAmount <= 0) {
      throw new BadRequestException('Le montant doit être > 0.');
    }

    return this.treasuryService.withdrawFunds({
      clientId: user.clientId,
      currency: body.currency,
      amount: parsedAmount,
      reason: body.reason || 'Retrait admin',
    });
  }

  // ========================================================
  // TRANSFERT INTERNE (Wallet à Wallet) — Super Admin
  // POST /treasury/transfer
  // Body: { fromWalletId, toWalletId, amount, description }
  // ========================================================

  @Post('transfer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Transfert interne entre wallets (Super Admin)',
    description:
      "Transfère des fonds d'un wallet à un autre.",
  })
  async transferBetweenWallets(
    @Req() req: Request & { user?: AuthUserPayload },
    @Body() body: TransferBetweenWalletsDto,
  ) {
    if (req.user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Réservé au Super Admin');
    }

    return this.treasuryService.transferBetweenWallets({
      fromWalletId: body.fromWalletId,
      toWalletId: body.toWalletId,
      amount: body.amount,
      description: body.description || 'Transfert interne Super Admin',
    });
  }
}