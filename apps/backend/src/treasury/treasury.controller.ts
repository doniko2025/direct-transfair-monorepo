// apps/backend/src/treasury/treasury.controller.ts
import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';

import { TreasuryService } from './treasury.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';

@ApiTags('Treasury')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('treasury')
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}

  @Get('overview')
  async getOverview(@Req() req: Request & { user?: AuthUserPayload }) {
    const user = req.user;
    if (!user) throw new ForbiddenException('Non authentifié');

    if (user.role === 'SUPER_ADMIN') {
      return this.treasuryService.getGlobalOverview();
    }

    if (user.role === 'COMPANY_ADMIN' && user.clientId) {
      return this.treasuryService.getClientOverview(user.clientId);
    }

    throw new ForbiddenException('Accès réservé aux admins');
  }

  @Get('snapshots')
  async getSnapshots(
    @Req() req: Request & { user?: AuthUserPayload },
    @Query('currency') currency?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const user = req.user;
    if (!user) throw new ForbiddenException('Non authentifié');

    const clientId =
      user.role === 'SUPER_ADMIN' ? null : (user.clientId ?? undefined);

    return this.treasuryService.getSnapshots({
      clientId: user.role === 'SUPER_ADMIN' ? undefined : clientId,
      currency,
      from,
      to,
      limit: limit ? parseInt(limit) : 30,
    });
  }

  @Post('snapshot/trigger')
  async triggerSnapshot(@Req() req: Request & { user?: AuthUserPayload }) {
    if (req.user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Réservé au Super Admin');
    }
    await this.treasuryService.triggerManualSnapshot();
    return { success: true, message: 'Snapshot lancé' };
  }
}