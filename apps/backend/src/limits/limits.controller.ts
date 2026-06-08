// apps/backend/src/limits/limits.controller.ts
// =========================================================
// LIMITS CONTROLLER v1.2 — Direct Transf'air
// ✅ v1.2 : requestIncrease déplacé DANS la classe LimitsController
//           (était collé après l'accolade fermante → erreurs TS2304/TS1146)
//           + ajout des imports Post et Body manquants
// =========================================================

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LimitsService } from './limits.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenants/tenant.guard';
import type { AuthTenantRequest } from '../common/types/auth-request';

@ApiTags('Limits')
@ApiBearerAuth('access-token')
@UseGuards(TenantGuard, JwtAuthGuard)
@Controller('limits')
export class LimitsController {
  constructor(private readonly limits: LimitsService) {}

  // ======================================================
  // GET /limits — Limites & utilisation courante
  // ======================================================

  @Get()
  async getLimits(@Req() req: AuthTenantRequest) {
    const clientId = req.tenantContext?.clientId;
    if (typeof clientId !== 'number' || clientId <= 0)
      throw new BadRequestException('Tenant non résolu');
    if (!req.user?.id)
      throw new BadRequestException('Utilisateur non authentifié');
    return this.limits.getLimits(clientId, req.user.id);
  }

  // ======================================================
  // POST /limits/request — Demande d'augmentation de plafond
  // ✅ v1.2 : route déplacée DANS la classe (était après la `}` fermante)
  // ======================================================

  @Post('request')
  async requestIncrease(
    @Req()  req: AuthTenantRequest,
    @Body() dto: { reason: string },
  ) {
    const clientId = req.tenantContext?.clientId;
    if (typeof clientId !== 'number' || clientId <= 0)
      throw new BadRequestException('Tenant non résolu');
    if (!req.user?.id)
      throw new BadRequestException('Utilisateur non authentifié');
    return this.limits.requestIncrease(clientId, req.user.id, dto.reason);
  }
}