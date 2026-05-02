// apps/backend/src/commissions/commissions.controller.ts
// =========================================================
// COMMISSIONS CONTROLLER v4.0
// ✅ Import JwtAuthGuard depuis '../auth/jwt-auth.guard' (pas guards/)
// =========================================================

import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

import { CommissionsService } from './commissions.service';
import { UpdateCommissionDto } from './dto/update-commission.dto';
import { PrismaService } from '../prisma/prisma.service';
// ✅ CORRECTION : chemin correct
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';

@ApiTags('Commissions')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('commissions')
export class CommissionsController {
  constructor(
    private readonly commissionsService: CommissionsService,
    private readonly prisma: PrismaService,
  ) {}

  // Stats de l'agence (agent)
  @Get('my-stats')
  async myStats(
    @Req() req: { user?: AuthUserPayload },
    @Query('period') period: string = 'day',
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user!.id },
    });
    if (!user || !user.clientId || !user.agencyId) {
      throw new ForbiddenException('Utilisateur non autorisé.');
    }
    return this.commissionsService.getMyStats(user.clientId, user.agencyId, period);
  }

  // Règles de commission (admin société)
  @Get()
  async getMyRules(@Req() req: { user?: AuthUserPayload }) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user!.id },
    });
    if (!user || !user.clientId || user.role !== 'COMPANY_ADMIN') {
      throw new ForbiddenException("Accès réservé à l'Admin Société.");
    }
    return this.commissionsService.getClientRules(user.clientId);
  }

  // Historique des commissions (agence)
  @Get('history')
  async getHistory(
    @Req() req: { user?: AuthUserPayload },
    @Query('period') period: string = 'day',
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user!.id },
    });
    if (!user || !user.clientId || !user.agencyId) {
      throw new ForbiddenException('Utilisateur non autorisé.');
    }
    return this.commissionsService.getHistory(user.clientId, user.agencyId, period);
  }

  // Créer / mettre à jour une règle (admin société)
  @Post()
  async updateRule(
    @Req() req: { user?: AuthUserPayload },
    @Body() dto: UpdateCommissionDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user!.id },
    });
    if (!user || !user.clientId || user.role !== 'COMPANY_ADMIN') {
      throw new ForbiddenException("Accès réservé à l'Admin Société.");
    }
    return this.commissionsService.upsertRule(user.clientId, dto);
  }
}