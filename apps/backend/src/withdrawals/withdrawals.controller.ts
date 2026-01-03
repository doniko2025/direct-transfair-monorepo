// apps/backend/src/withdrawals/withdrawals.controller.ts
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { WithdrawalsService } from './withdrawals.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { UpdateWithdrawalStatusDto } from './dto/update-withdrawal-status.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenants/tenant.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import type { TenantContext } from '../tenants/tenant-context';

type ReqWithAuth = Request & {
  user?: AuthUserPayload;
  tenantContext?: TenantContext;
};

@UseGuards(TenantGuard, JwtAuthGuard)
@Controller()
export class WithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  @Post('withdrawals')
  async create(@Req() req: ReqWithAuth, @Body() dto: CreateWithdrawalDto) {
    const clientId = req.tenantContext?.clientId;
    if (typeof clientId !== 'number' || clientId <= 0) {
      throw new ForbiddenException('Tenant not resolved');
    }

    const user = req.user;
    if (!user?.id) {
      throw new ForbiddenException('Not authenticated');
    }

    return this.withdrawals.create(clientId, user.id, dto);
  }

  @Get('withdrawals/me')
  async mine(@Req() req: ReqWithAuth) {
    const clientId = req.tenantContext?.clientId;
    if (typeof clientId !== 'number' || clientId <= 0) {
      throw new ForbiddenException('Tenant not resolved');
    }

    const user = req.user;
    if (!user?.id) {
      throw new ForbiddenException('Not authenticated');
    }

    return this.withdrawals.listMine(clientId, user.id);
  }

  @UseGuards(AdminGuard)
  @Get('admin/withdrawals')
  async adminAll(@Req() req: ReqWithAuth) {
    const clientId = req.tenantContext?.clientId;
    if (typeof clientId !== 'number' || clientId <= 0) {
      throw new ForbiddenException('Tenant not resolved');
    }

    return this.withdrawals.adminListAll(clientId);
  }

  @UseGuards(AdminGuard)
  @Patch('admin/withdrawals/:id')
  async adminUpdate(
    @Req() req: ReqWithAuth,
    @Param('id') id: string,
    @Body() dto: UpdateWithdrawalStatusDto,
  ) {
    const clientId = req.tenantContext?.clientId;
    if (typeof clientId !== 'number' || clientId <= 0) {
      throw new ForbiddenException('Tenant not resolved');
    }

    const user = req.user;
    if (!user?.id) {
      throw new ForbiddenException('Not authenticated');
    }

    return this.withdrawals.adminUpdateStatus(clientId, user.id, id, dto);
  }
}
