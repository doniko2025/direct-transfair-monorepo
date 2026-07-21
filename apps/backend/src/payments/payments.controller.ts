//apps/backend/src/payments/payments.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

import { PaymentsService } from './payments.service';
import { PaymentMethodsService } from './payment-methods.service';
import { RechargeService } from './recharge.service'; // ✅ v6.3 (nouveau)
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { AddCardDto } from './dto/add-card.dto';
import { LinkMobileWalletDto } from './dto/link-mobile-wallet.dto';
import {
  InitiateRechargeDto,
  RechargeByCardDto,
  RechargeByMobileMoneyDto, // ✅ v6.4 (nouveau)
} from './dto/initiate-recharge.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenants/tenant.guard';
import type { AuthTenantRequest } from '../common/types/auth-request';

@ApiTags('Payments')
@ApiBearerAuth('access-token')
@UseGuards(TenantGuard, JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly methods: PaymentMethodsService,
    private readonly recharge: RechargeService, // ✅ v6.3
  ) {}

  // ─── Initiation & statut (transferts) ──────────────────────────

  @Post('initiate')
  async initiate(@Req() req: AuthTenantRequest, @Body() dto: InitiatePaymentDto) {
    const clientId = req.tenantContext?.clientId;
    if (typeof clientId !== 'number' || clientId <= 0)
      throw new BadRequestException('Tenant non résolu');
    if (!req.user?.id) throw new BadRequestException('Utilisateur non authentifié');
    return this.payments.initiate(clientId, req.user.id, dto);
  }

  @Get('status/:transactionId')
  async status(
    @Req() req: AuthTenantRequest,
    @Param('transactionId') transactionId: string,
  ) {
    const clientId = req.tenantContext?.clientId;
    if (typeof clientId !== 'number' || clientId <= 0)
      throw new BadRequestException('Tenant non résolu');
    if (!req.user?.id) throw new BadRequestException('Utilisateur non authentifié');
    return this.payments.status(clientId, req.user.id, transactionId);
  }

  // ─── Moyens de paiement ───────────────────────────────────────

  @Get('methods')
  async getMethods(@Req() req: AuthTenantRequest) {
    if (!req.user?.id) throw new BadRequestException('Utilisateur non authentifié');
    return this.methods.getMethods(req.user.id);
  }

  @Post('cards')
  async addCard(@Req() req: AuthTenantRequest, @Body() dto: AddCardDto) {
    if (!req.user?.id) throw new BadRequestException('Utilisateur non authentifié');
    return this.methods.addCard(req.user.id, dto);
  }

  @Delete('cards/:cardId')
  async removeCard(
    @Req() req: AuthTenantRequest,
    @Param('cardId') cardId: string,
  ) {
    if (!req.user?.id) throw new BadRequestException('Utilisateur non authentifié');
    return this.methods.removeCard(req.user.id, cardId);
  }

  @Patch('mobile-wallet')
  async linkMobileWallet(
    @Req() req: AuthTenantRequest,
    @Body() dto: LinkMobileWalletDto,
  ) {
    if (!req.user?.id) throw new BadRequestException('Utilisateur non authentifié');
    return this.methods.linkMobileWallet(req.user.id, dto);
  }

  // ─── Recharge wallet — ✅ v6.3 (nouveau) ───────────────────────
  // Carte : mock synchrone (succès immédiat) en attendant un vrai PSP
  // (Stripe/Flutterwave — voir UserCard.providerToken/providerName,
  // déjà prévus dans le schéma). Orange Money / Sendwave : plomberie
  // prête, réutilise OrangeMoneyService/SendwaveService tels quels ;
  // en attente des accords opérateurs pour un vrai callback/webhook.

  @Post('recharge/card')
  async rechargeByCard(
    @Req() req: AuthTenantRequest,
    @Body() dto: RechargeByCardDto,
  ) {
    if (!req.user?.id) throw new BadRequestException('Utilisateur non authentifié');
    return this.recharge.rechargeByCard(req.user.id, dto);
  }

  // ✅ v6.4 — momoPhone désormais obligatoire (RechargeByMobileMoneyDto)
  @Post('recharge/orange-money')
  async rechargeByOrangeMoney(
    @Req() req: AuthTenantRequest,
    @Body() dto: RechargeByMobileMoneyDto,
  ) {
    if (!req.user?.id) throw new BadRequestException('Utilisateur non authentifié');
    return this.recharge.rechargeByOrangeMoney(req.user.id, dto);
  }

  @Post('recharge/sendwave')
  async rechargeBySendwave(
    @Req() req: AuthTenantRequest,
    @Body() dto: InitiateRechargeDto,
  ) {
    if (!req.user?.id) throw new BadRequestException('Utilisateur non authentifié');
    return this.recharge.rechargeBySendwave(req.user.id, dto);
  }

  @Get('recharge/:transactionId/status')
  async rechargeStatus(
    @Req() req: AuthTenantRequest,
    @Param('transactionId') transactionId: string,
  ) {
    if (!req.user?.id) throw new BadRequestException('Utilisateur non authentifié');
    return this.recharge.checkAndSettle(req.user.id, transactionId);
  }
}