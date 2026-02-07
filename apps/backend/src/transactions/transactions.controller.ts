// apps/backend/src/transactions/transactions.controller.ts
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
import { CreateTransactionDto, CreateDepositDto } from './dto/create-transaction.dto';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
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
  async fundSelf(@Req() req: AuthedRequest, @Body('amount') amount: number) {
      const user = req.user;
      if (!user) throw new ForbiddenException("Non authentifié");
      
      // 🛑 MODIFICATION : SUPER_ADMIN EXCLU
      if (user.role === 'SUPER_ADMIN') {
          throw new ForbiddenException("Le Super Admin ne peut pas s'auto-alimenter. Veuillez recevoir un paiement B2B.");
      }
      
      if (user.role !== 'COMPANY_ADMIN') {
          throw new ForbiddenException("Accès réservé aux Admins Société.");
      }

      const userId = this.getUserId(req);
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
          throw new BadRequestException("Montant invalide");
      }
      return this.transactionsService.fundAdminWallet(userId, amount);
  }

  @Post('admin/refill-agency')
  async refillAgency(@Req() req: AuthedRequest, @Body() body: { agencyId: string; amount: number }) {
      const user = req.user;
      if (!user) throw new ForbiddenException("Non authentifié");
      if (user.role !== 'COMPANY_ADMIN' && user.role !== 'SUPER_ADMIN') {
          throw new ForbiddenException("Accès refusé : Rôle Admin requis.");
      }
      const userId = this.getUserId(req);
      if (!body.agencyId || !body.amount) throw new BadRequestException("AgencyId et Amount requis");
      return this.transactionsService.refillAgency(userId, body.agencyId, body.amount);
  }

  // =========================================================
  // 🏦 FLUX B2B (NOUVEAU)
  // =========================================================

  // ✅ 1. Déclarer un virement (Admin Société)
  @Post('b2b/declare')
  async declareTransfer(@Req() req: AuthedRequest, @Body() body: { amount: number, ref: string }) {
      const user = req.user;
      if (user?.role !== 'COMPANY_ADMIN') throw new ForbiddenException("Réservé aux sociétés.");
      if (!body.amount || !body.ref) throw new BadRequestException("Montant et Référence requis");
      
      return this.transactionsService.declareBankTransfer(user.id, body.amount, body.ref);
  }

  // ✅ 2. Valider un virement (Super Admin)
  @UseGuards(AdminGuard) // Sécurité Admin
  @Patch('b2b/validate/:id')
  async validateTransfer(@Req() req: AuthedRequest, @Param('id') id: string) {
      const user = req.user;
      if (user?.role !== 'SUPER_ADMIN') throw new ForbiddenException("Réservé au Super Admin.");
      return this.transactionsService.validateBankTransfer(user.id, id);
  }

  // =========================================================
  // AUTRES ROUTES
  // =========================================================

  // ----- ADMIN -----
  @UseGuards(AdminGuard)
  @Get('admin/all')
  async adminFindAll(@Req() req: AuthedRequest) {
    const user = req.user;
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'COMPANY_ADMIN')) {
        throw new ForbiddenException("Accès refusé");
    }
    const userId = this.getUserId(req);
    return this.transactionsService.adminFindAllForAdmin(userId);
  }

  @UseGuards(AdminGuard)
  @Patch('admin/status/:id')
  async adminChangeStatus(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionStatusDto,
  ) {
    const user = req.user;
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'COMPANY_ADMIN')) {
        throw new ForbiddenException("Accès refusé");
    }
    const userId = this.getUserId(req);
    return this.transactionsService.adminUpdateStatusForAdmin(userId, id, dto);
  }

  // ----- AGENT -----
  @Post('deposit')
  async deposit(@Req() req: AuthedRequest, @Body() dto: CreateDepositDto) {
    const user = req.user;
    const userId = this.getUserId(req);
    if (!user || (user.role !== 'AGENT' && user.role !== 'COMPANY_ADMIN')) {
        throw new ForbiddenException("Seuls les agents peuvent effectuer des dépôts.");
    }
    return this.transactionsService.deposit(userId, dto);
  }

  // ----- USER (ACTIONS) -----
  
  @Post()
  async create(@Req() req: AuthedRequest, @Body() dto: CreateTransactionDto) {
    const userId = this.getUserId(req);
    return this.transactionsService.create(userId, dto);
  }

  @Patch(':id/cancel')
  async cancel(@Req() req: AuthedRequest, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.transactionsService.cancel(userId, id);
  }

  // ----- LECTURE -----
  @Get()
  async findMine(@Req() req: AuthedRequest) {
    const userId = this.getUserId(req);
    
    // ✅ LOG AJOUTÉ ICI POUR LE DÉBOGAGE
    console.log(`[CONTROLLER] GET /transactions called by user ${userId}`);
    
    return this.transactionsService.findForUser(userId);
  }

  @Get(':id')
  async findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.transactionsService.findOneForUser(id, userId);
  }
}