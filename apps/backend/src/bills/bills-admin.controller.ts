// apps/backend/src/bills/bills-admin.controller.ts
// =========================================================
// PAIEMENT DE FACTURES — administrateur de la société (web)
//   GET    /bills-admin/meta                       connecteurs disponibles
//   GET    /bills-admin/billers                    catalogue (avec suivi du partenariat)
//   POST   /bills-admin/billers                    ajouter un facturier
//   PATCH  /bills-admin/billers/:id                modifier (frais, plafonds, statut, connecteur…)
//   DELETE /bills-admin/billers/:id                supprimer (si aucun paiement)
//   GET    /bills-admin/stats                      à régler, en retard, montants par facturier
//   GET    /bills-admin/payments[?status&late&…]   file des factures payées par les clients
//   GET    /bills-admin/payments/export.csv        export (mêmes filtres)
//   POST   /bills-admin/payments/:id/process       { action: PROCESSING|COMPLETE|FAIL, providerRef?, token?, receiptNote?, reason? }
//   POST   /bills-admin/reconcile                  { billerId, csv, mapping?, from?, to?, tolerance? }  rapprochement du relevé d'un facturier
//   POST   /bills-admin/reconcile/export.csv       mêmes paramètres : les écarts en CSV
// Réservé au COMPANY_ADMIN : un super-administrateur ne voit rien des opérations d'une société.
// =========================================================

import { Body, Controller, Delete, ForbiddenException, Get, Header, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { BillsAdminService } from './bills-admin.service';
import { BillsReconcileService } from './bills-reconcile.service';
import { AdminPaymentsQueryDto, BillerDto, ProcessBillDto, ReconcileDto, UpdateBillerDto } from './dto/bills.dto';

type AuthRequest = Request & { user?: AuthUserPayload };
const me = (req: AuthRequest): AuthUserPayload => {
  if (!req.user) throw new ForbiddenException('Non authentifié');
  return req.user;
};

@ApiTags('Factures — administration')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.COMPANY_ADMIN)
@Controller('bills-admin')
export class BillsAdminController {
  constructor(private readonly admin: BillsAdminService, private readonly reconcile: BillsReconcileService) {}

  @Get('meta')
  meta() {
    return this.admin.meta();
  }

  @Get('billers')
  listBillers(@Req() req: AuthRequest) {
    return this.admin.listBillers(me(req));
  }

  @Post('billers')
  createBiller(@Req() req: AuthRequest, @Body() dto: BillerDto) {
    return this.admin.createBiller(me(req), dto);
  }

  @Patch('billers/:id')
  updateBiller(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: UpdateBillerDto) {
    return this.admin.updateBiller(me(req), id, dto);
  }

  @Delete('billers/:id')
  removeBiller(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.admin.removeBiller(me(req), id);
  }

  @Get('stats')
  stats(@Req() req: AuthRequest) {
    return this.admin.stats(me(req));
  }

  // Déclarée avant « payments/:id/… » : « export.csv » ne doit jamais être lu comme un identifiant.
  @Get('payments/export.csv')
  @Header('Cache-Control', 'no-store')
  async exportCsv(@Req() req: AuthRequest, @Query() q: AdminPaymentsQueryDto, @Res() res: Response) {
    const csv = await this.admin.exportCsv(me(req), q);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="factures-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }

  @Get('payments')
  listPayments(@Req() req: AuthRequest, @Query() q: AdminPaymentsQueryDto) {
    return this.admin.listPayments(me(req), q);
  }

  @Post('payments/:id/process')
  process(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: ProcessBillDto) {
    return this.admin.process(me(req), id, dto);
  }

  // Relevé d'un facturier (CSV collé ou importé) comparé aux factures réglées : écarts rendus, rien n'est conservé.
  @Post('reconcile')
  @Header('Cache-Control', 'no-store')
  runReconcile(@Req() req: AuthRequest, @Body() dto: ReconcileDto) {
    return this.reconcile.run(me(req), dto);
  }

  @Post('reconcile/export.csv')
  @Header('Cache-Control', 'no-store')
  async exportReconcile(@Req() req: AuthRequest, @Body() dto: ReconcileDto, @Res() res: Response) {
    const csv = await this.reconcile.exportCsv(me(req), dto);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ecarts-facturier-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }
}
