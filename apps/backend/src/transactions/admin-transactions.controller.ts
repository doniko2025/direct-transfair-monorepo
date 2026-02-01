// apps/backend/src/transactions/admin-transactions.controller.ts
import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import type { Request } from 'express';

import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/tenant.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import type { AuthUserPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('Transactions (Admin)')
@ApiBearerAuth('access-token')
@ApiSecurity('x-tenant-id')
@Controller('transactions/admin')
@UseGuards(JwtAuthGuard, TenantGuard, AdminGuard)
export class AdminTransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
  ) {}

  @Post('fund-self')
  async fundSelf(
    @Req() req: Request & { user?: AuthUserPayload },
    @Body() body: { amount: number },
  ) {
    if (!req.user) {
      throw new BadRequestException('User not found in request');
    }

    if (!body?.amount || body.amount <= 0) {
      throw new BadRequestException('Amount must be a positive number');
    }

    return this.transactionsService.adminFundSelf(
      req.user,
      body.amount,
    );
  }
}
