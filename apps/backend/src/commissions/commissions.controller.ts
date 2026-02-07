//apps/backend/src/commissions/commissions.controller.ts
import { Body, Controller, Get, Post, UseGuards, Request, ForbiddenException, Query } from '@nestjs/common';
import { CommissionsService } from './commissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateCommissionDto } from './dto/update-commission.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('commissions')
@UseGuards(JwtAuthGuard)
export class CommissionsController {
  constructor(
      private readonly commissionsService: CommissionsService,
      private readonly prisma: PrismaService
  ) {}

  @Get()
  async getMyRules(@Request() req) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.clientId || user.role !== 'COMPANY_ADMIN') {
        throw new ForbiddenException("Accès réservé à l'Admin Société.");
    }
    return this.commissionsService.getClientRules(user.clientId);
  }

  // ✅ NOUVELLE ROUTE : Historique filtré
  @Get('history')
  async getHistory(@Request() req, @Query('period') period: string = 'TODAY') {
      const user = await this.prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user || !user.clientId) {
          throw new ForbiddenException("Utilisateur non autorisé.");
      }
      // Note: On pourrait filtrer ici si c'est un AGENT pour ne montrer que SES commissions
      // Pour l'instant c'est pour l'Admin Société.
      return this.commissionsService.getHistory(user.clientId, period);
  }

  @Post()
  async updateRule(@Request() req, @Body() dto: UpdateCommissionDto) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.clientId || user.role !== 'COMPANY_ADMIN') {
        throw new ForbiddenException("Accès réservé à l'Admin Société.");
    }
    return this.commissionsService.upsertRule(user.clientId, dto);
  }
}