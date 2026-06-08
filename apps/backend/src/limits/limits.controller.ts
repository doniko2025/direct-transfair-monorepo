//apps/backend/src/limits/limits.controller.ts
import { BadRequestException, Controller, Get, Req, UseGuards } from '@nestjs/common';
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

  @Get()
  async getLimits(@Req() req: AuthTenantRequest) {
    const clientId = req.tenantContext?.clientId;
    if (typeof clientId !== 'number' || clientId <= 0)
      throw new BadRequestException('Tenant non résolu');
    if (!req.user?.id)
      throw new BadRequestException('Utilisateur non authentifié');
    return this.limits.getLimits(clientId, req.user.id);
  }
}
// limits.controller.ts — ajouter
@Post('request')
async requestIncrease(@Req() req: AuthTenantRequest, @Body() dto: { reason: string }) {
  return this.limits.requestIncrease(req.tenantContext.clientId, req.user.id, dto.reason);
}