// apps/backend/src/withdrawals/withdrawals.controller.ts
// =========================================================
// WITHDRAWALS CONTROLLER v4.5 — Direct Transf'air
// ✅ v4.4 : routes agent/check + agent/pay
// ✅ v4.5 :
//    - GET /withdrawals       → route manquante ajoutée (causait le 404)
//                               Dispatch par rôle :
//                               ADMIN / COMPANY_ADMIN → adminListAll()
//                               AGENT               → listByAgent()
//                               CLIENT              → listMine()
//    - GET /withdrawals/me    → conservé (rétrocompat frontend)
// =========================================================

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

import { WithdrawalsService }        from './withdrawals.service';
import { CreateWithdrawalDto }        from './dto/create-withdrawal.dto';
import { UpdateWithdrawalStatusDto }  from './dto/update-withdrawal-status.dto';

import { JwtAuthGuard }  from '../auth/jwt-auth.guard';
import { TenantGuard }   from '../tenants/tenant.guard';
import { AdminGuard }    from '../common/guards/admin.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import type { TenantContext }   from '../tenants/tenant-context';

type ReqWithAuth = Request & {
  user?:          AuthUserPayload;
  tenantContext?: TenantContext;
};

@UseGuards(TenantGuard, JwtAuthGuard)
@Controller()
export class WithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  // ── CLIENT : Demander un retrait ─────────────────────────
  @Post('withdrawals')
  async create(@Req() req: ReqWithAuth, @Body() dto: CreateWithdrawalDto) {
    const clientId = req.tenantContext?.clientId;
    if (!clientId)     throw new ForbiddenException('Tenant not resolved');
    if (!req.user?.id) throw new ForbiddenException('Not authenticated');

    return this.withdrawals.create(clientId, req.user.id, dto);
  }

  // ✅ v4.5 — GET /withdrawals — ROUTE MANQUANTE (causait le 404)
  // Dispatch selon le rôle de l'utilisateur connecté :
  //   ADMIN / COMPANY_ADMIN → tous les retraits du tenant
  //   AGENT                → retraits qu'il a lui-même traités
  //   CLIENT               → ses propres demandes
  @Get('withdrawals')
  async list(@Req() req: ReqWithAuth) {
    const clientId = req.tenantContext?.clientId;
    if (!clientId)     throw new ForbiddenException('Tenant not resolved');
    if (!req.user?.id) throw new ForbiddenException('Not authenticated');

    const role = req.user.role;

    if (role === 'ADMIN' || role === 'COMPANY_ADMIN') {
      return this.withdrawals.adminListAll(clientId);
    }

    if (role === 'AGENT') {
      return this.withdrawals.listByAgent(clientId, req.user.id);
    }

    // CLIENT (fallback)
    return this.withdrawals.listMine(clientId, req.user.id);
  }

  // ── CLIENT : Mes retraits (conservé pour rétrocompatibilité) ─
  @Get('withdrawals/me')
  async mine(@Req() req: ReqWithAuth) {
    const clientId = req.tenantContext?.clientId;
    if (!clientId)     throw new ForbiddenException('Tenant not resolved');
    if (!req.user?.id) throw new ForbiddenException('Not authenticated');

    return this.withdrawals.listMine(clientId, req.user.id);
  }

  // ── AGENT : Vérifier un code de retrait ──────────────────
  @Post('withdrawals/agent/check')
  async agentCheckCode(@Req() req: ReqWithAuth, @Body('code') code: string) {
    const clientId = req.tenantContext?.clientId;
    if (!clientId) throw new ForbiddenException('Tenant not resolved');

    if (req.user?.role !== 'AGENT' && req.user?.role !== 'COMPANY_ADMIN') {
      throw new ForbiddenException('Réservé aux agents');
    }

    return this.withdrawals.agentCheckCode(clientId, code);
  }

  // ── AGENT : Valider le paiement (Cash-Out) ───────────────
  @Post('withdrawals/agent/pay')
  async agentProcessPayment(@Req() req: ReqWithAuth, @Body('code') code: string) {
    const clientId = req.tenantContext?.clientId;
    if (!clientId) throw new ForbiddenException('Tenant not resolved');

    if (req.user?.role !== 'AGENT' && req.user?.role !== 'COMPANY_ADMIN') {
      throw new ForbiddenException('Réservé aux agents');
    }

    return this.withdrawals.agentProcessPayment(clientId, req.user!.id, code);
  }

  // ── ADMIN : Lister tout ──────────────────────────────────
  @UseGuards(AdminGuard)
  @Get('admin/withdrawals')
  async adminAll(@Req() req: ReqWithAuth) {
    const clientId = req.tenantContext?.clientId;
    if (!clientId) throw new ForbiddenException('Tenant not resolved');

    return this.withdrawals.adminListAll(clientId);
  }

  // ── ADMIN : Mise à jour manuelle du statut ───────────────
  @UseGuards(AdminGuard)
  @Patch('admin/withdrawals/:id')
  async adminUpdate(
    @Req()       req: ReqWithAuth,
    @Param('id') id:  string,
    @Body()      dto: UpdateWithdrawalStatusDto,
  ) {
    const clientId = req.tenantContext?.clientId;
    if (!clientId)     throw new ForbiddenException('Tenant not resolved');
    if (!req.user?.id) throw new ForbiddenException('Not authenticated');

    return this.withdrawals.adminUpdateStatus(clientId, req.user.id, id, dto);
  }
}