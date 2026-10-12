// apps/backend/src/fees-admin/fees-admin.controller.ts
// =========================================================
// FEES ADMIN CONTROLLER v1.0
//   GET   /fees-admin/mine         COMPANY_ADMIN : les frais de sa société
//   GET   /fees-admin/companies    SUPER_ADMIN   : les frais de chaque société (lecture seule)
//   GET   /fees-admin/history      SUPER_ADMIN, COMPANY_ADMIN : journal des modifications
//   PATCH /fees-admin/:method      COMPANY_ADMIN : { feeRate, fixedFee }
//
// Les frais sont le tarif de chaque société : le super admin les consulte, il ne les fixe pas.
// =========================================================

import { Body, Controller, ForbiddenException, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { FeeHistoryQueryDto, SetFeeDto } from './dto/fees-admin.dto';
import { FeesAdminService } from './fees-admin.service';

type AuthRequest = Request & { user?: AuthUserPayload };

function currentUser(req: AuthRequest): AuthUserPayload {
  if (!req.user) throw new ForbiddenException('Non authentifié');
  return req.user;
}

@ApiTags('Fees admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fees-admin')
export class FeesAdminController {
  constructor(private readonly fees: FeesAdminService) {}

  @Get('mine')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Frais d’envoi de ma société, par mode de retrait' })
  mine(@Req() req: AuthRequest) {
    return this.fees.mine(currentUser(req));
  }

  @Get('companies')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Frais d’envoi de chaque société (lecture seule)' })
  companies() {
    return this.fees.companies();
  }

  @Get('history')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Journal des modifications de frais' })
  history(@Req() req: AuthRequest, @Query() query: FeeHistoryQueryDto) {
    return this.fees.history(currentUser(req), query);
  }

  @Patch(':method')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Modifie le taux et le frais fixe d’un mode de retrait' })
  set(@Req() req: AuthRequest, @Param('method') method: string, @Body() body: SetFeeDto) {
    return this.fees.set(currentUser(req), method, body);
  }
}
