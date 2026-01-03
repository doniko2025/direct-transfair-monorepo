// apps/backend/src/payments/payments.controller.ts
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

import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenants/tenant.guard';
import type { AuthTenantRequest } from '../common/types/auth-request';

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

    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('Utilisateur non authentifié');
    }

    return this.payments.initiate(clientId, userId, dto);
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

    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('Utilisateur non authentifié');
    }

    return this.payments.status(clientId, userId, transactionId);
  }
}
