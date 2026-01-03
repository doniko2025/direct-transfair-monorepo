// apps/backend/src/payments/controller/payments.controller.ts
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { PaymentsService } from '../payments.service';
import { InitiatePaymentDto } from '../dto/initiate-payment.dto';

import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { TenantGuard } from '../../tenants/tenant.guard';
import type { AuthUserPayload } from '../../auth/types/auth-user-payload.type';
import type { TenantContext } from '../../tenants/tenant-context';

type ReqWithAuth = Request & {
  user?: AuthUserPayload;
  tenantContext?: TenantContext;
};

@UseGuards(TenantGuard, JwtAuthGuard)
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('payments/initiate')
  async initiate(@Req() req: ReqWithAuth, @Body() dto: InitiatePaymentDto) {
    const clientId = req.tenantContext?.clientId;
    if (typeof clientId !== 'number') {
      throw new ForbiddenException('Tenant not resolved');
    }

    if (!req.user?.id) {
      throw new ForbiddenException('Not authenticated');
    }

    return this.payments.initiate(clientId, req.user.id, dto);
  }

  @Get('payments/status/:transactionId')
  async status(
    @Req() req: ReqWithAuth,
    @Param('transactionId') transactionId: string,
  ) {
    const clientId = req.tenantContext?.clientId;
    if (typeof clientId !== 'number') {
      throw new ForbiddenException('Tenant not resolved');
    }

    if (!req.user?.id) {
      throw new ForbiddenException('Not authenticated');
    }

    return this.payments.status(clientId, req.user.id, transactionId);
  }
}
