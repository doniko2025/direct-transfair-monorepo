// apps/backend/src/payments/payments.controller.ts
// =========================================================
// PAYMENTS CONTROLLER v4.0
// ✅ Version unique — supprimer apps/backend/src/payments/controller/
// ✅ Import JwtAuthGuard correct
// ✅ AuthTenantRequest depuis common/types/auth-request
// =========================================================

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
// ✅ CORRECTION : chemin correct
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenants/tenant.guard';
import type { AuthTenantRequest } from '../common/types/auth-request';

@ApiTags('Payments')
@ApiBearerAuth('access-token')
@UseGuards(TenantGuard, JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('initiate')
  async initiate(@Req() req: AuthTenantRequest, @Body() dto: InitiatePaymentDto) {
    const clientId = req.tenantContext?.clientId;
    if (typeof clientId !== 'number' || clientId <= 0) {
      throw new BadRequestException('Tenant non résolu');
    }
    if (!req.user?.id) {
      throw new BadRequestException('Utilisateur non authentifié');
    }
    return this.payments.initiate(clientId, req.user.id, dto);
  }

  @Get('status/:transactionId')
  async status(
    @Req() req: AuthTenantRequest,
    @Param('transactionId') transactionId: string,
  ) {
    const clientId = req.tenantContext?.clientId;
    if (typeof clientId !== 'number' || clientId <= 0) {
      throw new BadRequestException('Tenant non résolu');
    }
    if (!req.user?.id) {
      throw new BadRequestException('Utilisateur non authentifié');
    }
    return this.payments.status(clientId, req.user.id, transactionId);
  }
}