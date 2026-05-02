// apps/backend/src/wallets/wallets.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';

import { WalletsService } from './wallets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';

@ApiTags('Wallets')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('me')
  async getMyWallets(@Req() req: Request & { user?: AuthUserPayload }) {
    if (!req.user) throw new BadRequestException('Non authentifié');
    return this.walletsService.getWalletsForUser(req.user.id);
  }

  @Get(':id/ledger')
  async getLedger(
    @Req() req: Request & { user?: AuthUserPayload },
    @Param('id') walletId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!req.user) throw new ForbiddenException('Non authentifié');
    await this.walletsService.getWalletById(walletId, req.user.id);
    return this.walletsService.getLedger(walletId, {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      from,
      to,
    });
  }
}