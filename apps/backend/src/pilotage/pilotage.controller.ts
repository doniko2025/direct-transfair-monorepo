// apps/backend/src/pilotage/pilotage.controller.ts
// =========================================================
// PILOTAGE CONTROLLER v1.0 (lot 15)
//   Agent :
//     GET   /pilotage/closing/today?tz        soldes théoriques de la caisse + clôtures du jour
//     POST  /pilotage/closing                 clôture de caisse (espèces comptées)
//   Administrateur de société :
//     GET   /pilotage/closings?day|from&to&tz&onlyVariance   clôtures + caisses non clôturées
//     PATCH /pilotage/closings/:id/review                    écart examiné
//     GET   /pilotage/liquidity                              niveaux de caisse + seuils
//     PUT   /pilotage/liquidity-rules   DELETE /pilotage/liquidity-rules/:id
//     GET   /pilotage/profitability?from&to&tz               rentabilité par couloir
//     GET   /pilotage/agents?month&tz                        objectifs et classement
//     PUT   /pilotage/agents/:agentId/target   DELETE …?month=
//     GET   /pilotage/export/(transactions|closings|profitability).csv?from&to&tz
//     GET   /pilotage/report/monthly?month&tz
// Le super admin n'a aucun accès : il ne voit pas les opérations des sociétés.
// =========================================================

import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { parseTzOffset } from '../merchants/merchant-extras';
import { CloseCashDto, ReviewClosingDto, UpsertLiquidityRuleDto, UpsertTargetDto } from './dto/pilotage.dto';
import { PilotageService } from './pilotage.service';
import { parseMonth } from './pilotage.rules';

type AuthRequest = Request & { user?: AuthUserPayload };

function currentUser(req: AuthRequest): AuthUserPayload {
  if (!req.user) throw new ForbiddenException('Non authentifié');
  return req.user;
}

function sendCsv(res: Response, file: { filename: string; csv: string }): string {
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${file.filename}"`,
    'Cache-Control': 'no-store',
  });
  return file.csv;
}

@ApiTags('Pilotage')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pilotage')
export class PilotageController {
  constructor(private readonly pilotage: PilotageService) {}

  // ── Agent ───────────────────────────────────────────────

  @Get('closing/today')
  @Roles(Role.AGENT)
  @ApiOperation({ summary: "Caisse de l'agence : soldes théoriques et clôtures du jour" })
  closingToday(@Req() req: AuthRequest, @Query('tz') tz?: string) {
    return this.pilotage.closingToday(currentUser(req), tz);
  }

  @Post('closing')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.AGENT)
  @ApiOperation({ summary: 'Clôture de caisse : espèces comptées contre solde théorique' })
  closeCash(@Req() req: AuthRequest, @Body() dto: CloseCashDto) {
    return this.pilotage.closeCash(currentUser(req), dto);
  }

  // ── Administrateur : caisses ────────────────────────────

  @Get('closings')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Clôtures de caisse (jour ou période) et caisses non clôturées' })
  closings(@Req() req: AuthRequest, @Query('day') day?: string, @Query('from') from?: string, @Query('to') to?: string, @Query('tz') tz?: string, @Query('onlyVariance') onlyVariance?: string) {
    return this.pilotage.listClosings(currentUser(req), { day, from, to, tz, onlyVariance });
  }

  @Patch('closings/:id/review')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: "Marque l'écart d'une clôture comme examiné" })
  review(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: ReviewClosingDto) {
    return this.pilotage.reviewClosing(currentUser(req), id, dto);
  }

  // ── Administrateur : liquidité ──────────────────────────

  @Get('liquidity')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Niveau de chaque caisse par rapport à son seuil, et liste des seuils' })
  liquidity(@Req() req: AuthRequest) {
    return this.pilotage.liquidity(currentUser(req));
  }

  @Put('liquidity-rules')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Crée ou modifie un seuil de liquidité (agence ou toutes les agences, par devise)' })
  upsertRule(@Req() req: AuthRequest, @Body() dto: UpsertLiquidityRuleDto) {
    return this.pilotage.upsertRule(currentUser(req), dto);
  }

  @Delete('liquidity-rules/:id')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Supprime un seuil de liquidité' })
  deleteRule(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.pilotage.deleteRule(currentUser(req), id);
  }

  // ── Administrateur : rentabilité, objectifs ─────────────

  @Get('profitability')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Frais, commissions et marge nette estimée par couloir' })
  profitability(@Req() req: AuthRequest, @Query('from') from?: string, @Query('to') to?: string, @Query('tz') tz?: string) {
    return this.pilotage.profitability(currentUser(req), { from, to, tz });
  }

  @Get('agents')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Activité du mois, objectifs et classement des agents' })
  agents(@Req() req: AuthRequest, @Query('month') month?: string, @Query('tz') tz?: string) {
    return this.pilotage.agentsBoard(currentUser(req), { month, tz });
  }

  @Put('agents/:agentId/target')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: "Fixe l'objectif mensuel d'un agent" })
  setTarget(@Req() req: AuthRequest, @Param('agentId') agentId: string, @Body() dto: UpsertTargetDto) {
    return this.pilotage.upsertTarget(currentUser(req), agentId, dto);
  }

  @Delete('agents/:agentId/target')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: "Retire l'objectif mensuel d'un agent" })
  clearTarget(@Req() req: AuthRequest, @Param('agentId') agentId: string, @Query('month') month?: string) {
    return this.pilotage.deleteTarget(currentUser(req), agentId, parseMonth(month, new Date(), parseTzOffset(undefined)));
  }

  // ── Administrateur : exports et rapport ─────────────────

  @Get('export/transactions.csv')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Export comptable des opérations (CSV)' })
  async exportTransactions(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response, @Query('from') from?: string, @Query('to') to?: string, @Query('tz') tz?: string) {
    return sendCsv(res, await this.pilotage.exportTransactionsCsv(currentUser(req), { from, to, tz }));
  }

  @Get('export/closings.csv')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Export des clôtures de caisse (CSV)' })
  async exportClosings(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response, @Query('from') from?: string, @Query('to') to?: string, @Query('tz') tz?: string) {
    return sendCsv(res, await this.pilotage.exportClosingsCsv(currentUser(req), { from, to, tz }));
  }

  @Get('export/profitability.csv')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Export de la rentabilité par couloir (CSV)' })
  async exportProfitability(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response, @Query('from') from?: string, @Query('to') to?: string, @Query('tz') tz?: string) {
    return sendCsv(res, await this.pilotage.exportProfitabilityCsv(currentUser(req), { from, to, tz }));
  }

  @Get('report/monthly')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: "Rapport d'activité d'un mois" })
  monthly(@Req() req: AuthRequest, @Query('month') month?: string, @Query('tz') tz?: string) {
    const user = currentUser(req);
    if (!user.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    const offset = parseTzOffset(tz);
    return this.pilotage.monthlyReport(user.clientId, parseMonth(month, new Date(), offset), offset);
  }
}
