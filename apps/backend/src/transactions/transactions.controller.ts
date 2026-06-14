// apps/backend/src/transactions/transactions.controller.ts
// =========================================================
// TRANSACTIONS CONTROLLER v4.2 — Direct Transf'air
// =========================================================
// ✅ v4.0 : Routes B2B, admin, deposit, cancel, findMine
// ✅ v4.1 : Guards et vérifications de rôles
// ✅ v4.2 : FIX GET /transactions/admin → 404
//
//   PROBLÈME :
//     NestJS matche les routes dans l'ordre de déclaration.
//     @Get(':id') capturait GET /transactions/admin avec id="admin"
//     → findOneForUser('admin', userId) → NotFoundException 404 ❌
//
//   CORRECTIF :
//     Ajout de @Get('admin') déclaré AVANT @Get(':id')
//     NestJS matche maintenant /admin sur le handler explicite ✅
//     La route /admin/all reste inchangée et fonctionnelle.
// =========================================================

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

import { TransactionsService } from './transactions.service';
import {
  CreateTransactionDto,
  CreateDepositDto,
} from './dto/create-transaction.dto';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard }   from '../common/guards/admin.guard';
import type { AuthedRequest } from '../types/requests';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  private getUserId(req: AuthedRequest): string {
    const user = req.user;
    if (!user || !user.id) throw new ForbiddenException('Non authentifié');
    return user.id;
  }

  // =========================================================
  // 👑 TRÉSORERIE
  // =========================================================

  @Post('admin/fund-self')
  async fundSelf(
    @Req() req: AuthedRequest,
    @Body('amount') amount: string | number,
  ) {
    const user = req.user;
    if (!user) throw new ForbiddenException('Non authentifié');

    if (user.role === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        "Le Super Admin ne peut pas s'auto-alimenter. Veuillez recevoir un paiement B2B.",
      );
    }

    if (user.role !== 'COMPANY_ADMIN') {
      throw new ForbiddenException('Accès réservé aux Admins Société.');
    }

    const userId        = this.getUserId(req);
    const numericAmount = Number(amount);

    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      throw new BadRequestException('Montant invalide');
    }
    return this.transactionsService.fundAdminWallet(userId, numericAmount);
  }

  @Post('admin/refill-agency')
  async refillAgency(
    @Req() req: AuthedRequest,
    @Body('agencyId')  agencyId:  string,
    @Body('amount')    amount:    string | number,
    @Body('currency')  currency:  string,
  ) {
    const user = req.user;
    if (!user) throw new ForbiddenException('Non authentifié');
    if (user.role !== 'COMPANY_ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Accès refusé : Rôle Admin requis.');
    }

    const userId        = this.getUserId(req);
    const numericAmount = Number(amount);

    if (!agencyId || isNaN(numericAmount) || numericAmount <= 0)
      throw new BadRequestException('AgencyId et Amount valides requis');

    const safeCurrency = (currency ?? 'XOF').toString().toUpperCase();

    return this.transactionsService.refillAgency(
      userId, agencyId, numericAmount, safeCurrency,
    );
  }

  // =========================================================
  // 🏦 FLUX B2B
  // =========================================================

  @Post('b2b/declare')
  async declareTransfer(
    @Req() req: AuthedRequest,
    @Body('amount')   amount:    string | number,
    @Body('ref')      ref:       string,
    @Body('currency') currency?: string,
  ) {
    const user = req.user;
    if (user?.role !== 'COMPANY_ADMIN')
      throw new ForbiddenException('Réservé aux sociétés.');

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || !ref)
      throw new BadRequestException('Montant et Référence requis');

    const safeCurrency = (currency ?? 'XOF').toString().toUpperCase();

    return this.transactionsService.declareBankTransfer(
      user.id, numericAmount, ref, safeCurrency,
    );
  }

  @UseGuards(AdminGuard)
  @Patch('b2b/validate/:id')
  async validateTransfer(@Req() req: AuthedRequest, @Param('id') id: string) {
    const user = req.user;
    if (user?.role !== 'SUPER_ADMIN')
      throw new ForbiddenException('Réservé au Super Admin.');
    return this.transactionsService.validateBankTransfer(user.id, id);
  }

  @UseGuards(AdminGuard)
  @Patch('b2b/reject/:id')
  async rejectTransfer(@Req() req: AuthedRequest, @Param('id') id: string) {
    const user = req.user;
    if (user?.role !== 'SUPER_ADMIN')
      throw new ForbiddenException('Réservé au Super Admin.');
    return this.transactionsService.rejectBankTransfer(user.id, id);
  }

  // =========================================================
  // ADMIN — Routes déclarées AVANT @Get(':id') pour éviter
  // que NestJS ne les capture comme paramètre id="admin"
  // =========================================================

  // ✅ v4.2 FIX : @Get('admin') ajouté — correspond à GET /transactions/admin
  // AVANT : ce chemin était capturé par @Get(':id') avec id='admin'
  //         → findOneForUser('admin', userId) → 404 "Transaction not found" ❌
  // APRÈS : capturé par ce handler → adminFindAllForAdmin() ✅
  @UseGuards(AdminGuard)
  @Get('admin')
  async adminFindAllCompat(@Req() req: AuthedRequest) {
    const user = req.user;
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'COMPANY_ADMIN')) {
      throw new ForbiddenException('Accès refusé');
    }
    const userId = this.getUserId(req);
    return this.transactionsService.adminFindAllForAdmin(userId);
  }

  // Route /admin/all conservée pour rétrocompatibilité
  @UseGuards(AdminGuard)
  @Get('admin/all')
  async adminFindAll(@Req() req: AuthedRequest) {
    const user = req.user;
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'COMPANY_ADMIN')) {
      throw new ForbiddenException('Accès refusé');
    }
    const userId = this.getUserId(req);
    return this.transactionsService.adminFindAllForAdmin(userId);
  }

  @UseGuards(AdminGuard)
  @Patch('admin/status/:id')
  async adminChangeStatus(
    @Req()       req: AuthedRequest,
    @Param('id') id:  string,
    @Body()      dto: UpdateTransactionStatusDto,
  ) {
    const user = req.user;
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'COMPANY_ADMIN')) {
      throw new ForbiddenException('Accès refusé');
    }
    const userId = this.getUserId(req);
    return this.transactionsService.adminUpdateStatusForAdmin(userId, id, dto);
  }

  // =========================================================
  // DÉPÔT / CRÉATION
  // =========================================================

  @Post('deposit')
  async deposit(@Req() req: AuthedRequest, @Body() dto: CreateDepositDto) {
    const user   = req.user;
    const userId = this.getUserId(req);
    if (!user || (user.role !== 'AGENT' && user.role !== 'COMPANY_ADMIN')) {
      throw new ForbiddenException('Seuls les agents peuvent effectuer des dépôts.');
    }
    return this.transactionsService.deposit(userId, dto);
  }

  @Post()
  async create(@Req() req: AuthedRequest, @Body() dto: CreateTransactionDto) {
    const userId = this.getUserId(req);
    return this.transactionsService.create(userId, dto);
  }

  // =========================================================
  // LECTURE / ANNULATION
  // IMPORTANT : @Get() et @Get(':id') déclarés EN DERNIER
  // pour ne pas capturer les routes nommées ci-dessus
  // =========================================================

  @Patch(':id/cancel')
  async cancel(@Req() req: AuthedRequest, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.transactionsService.cancel(userId, id);
  }

  @Get()
  async findMine(@Req() req: AuthedRequest) {
    const userId = this.getUserId(req);
    return this.transactionsService.findForUser(userId);
  }

  // ⚠️ DOIT RESTER EN DERNIER — capture tout /:id non matché au-dessus
  @Get(':id')
  async findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.transactionsService.findOneForUser(id, userId);
  }
}