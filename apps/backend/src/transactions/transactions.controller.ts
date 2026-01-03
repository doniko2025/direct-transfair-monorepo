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
} from '@nestjs/common';

import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenants/tenant.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import type { AuthedRequest } from '../types/requests';

@UseGuards(TenantGuard, JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  private getUserId(req: AuthedRequest): string {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('Not authenticated');
    return userId;
  }

  // ----- ADMIN -----
  @UseGuards(AdminGuard)
  @Get('admin/all')
  async adminFindAll(@Req() req: AuthedRequest) {
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
    const userId = this.getUserId(req);
    return this.transactionsService.adminUpdateStatusForAdmin(userId, id, dto);
  }

  // ----- USER -----
  @Post()
  async create(@Req() req: AuthedRequest, @Body() dto: CreateTransactionDto) {
    const userId = this.getUserId(req);
    return this.transactionsService.create(userId, dto);
  }

  @Get()
  async findMine(@Req() req: AuthedRequest) {
    const userId = this.getUserId(req);
    return this.transactionsService.findForUser(userId);
  }

  @Get(':id')
  async findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.transactionsService.findOneForUser(id, userId);
  }
}
