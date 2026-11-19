// apps/backend/src/compliance/compliance.controller.ts
// =========================================================
// CONFORMITÉ CONTROLLER v1.0 (lot 17) — administrateur de société
//   GET  /compliance-admin/overview
//   GET  /compliance-admin/cases              ?status=OPEN_ALL|OPEN|…  &kind=SANCTION_MATCH|AML_RULE  &search=
//   POST /compliance-admin/cases/:id/action   TAKE | ESCALATE | RESOLVE | DISMISS | RELEASE | REJECT
//   GET/POST /compliance-admin/watchlist      PATCH/DELETE /compliance-admin/watchlist/:id
//   POST /compliance-admin/watchlist/import   POST /compliance-admin/watchlist/test   POST /compliance-admin/screen-customers
//   GET/PUT /compliance-admin/settings
//   GET  /compliance-admin/official-lists   PUT /compliance-admin/official-lists/:provider {enabled}   POST /compliance-admin/official-lists/:provider/sync   (lot 17b)
// =========================================================

import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { ComplianceService } from './compliance.service';
import { CaseActionDto, ImportWatchlistDto, TestNameDto, ToggleOfficialListDto, UpdateComplianceSettingsDto, UpdateWatchlistEntryDto, WatchlistEntryDto } from './dto/compliance.dto';

type AuthRequest = Request & { user?: AuthUserPayload };

function currentUser(req: AuthRequest): AuthUserPayload {
  if (!req.user) throw new ForbiddenException('Non authentifié');
  return req.user;
}

@ApiTags('Conformité')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.COMPANY_ADMIN)
@Controller('compliance-admin')
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get('overview')
  overview(@Req() req: AuthRequest) {
    return this.compliance.overview(currentUser(req));
  }

  @Get('cases')
  cases(@Req() req: AuthRequest, @Query('status') status?: string, @Query('kind') kind?: string, @Query('search') search?: string, @Query('take') take?: string) {
    return this.compliance.listCases(currentUser(req), { status, kind, search, take: take ? Number(take) : undefined });
  }

  @Post('cases/:id/action')
  @HttpCode(HttpStatus.OK)
  act(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: CaseActionDto) {
    return this.compliance.actOnCase(currentUser(req), id, dto);
  }

  @Get('watchlist')
  watchlist(@Req() req: AuthRequest, @Query('kind') kind?: string, @Query('search') search?: string, @Query('active') active?: string) {
    return this.compliance.listWatchlist(currentUser(req), { kind, search, active });
  }

  @Post('watchlist')
  create(@Req() req: AuthRequest, @Body() dto: WatchlistEntryDto) {
    return this.compliance.createEntry(currentUser(req), dto);
  }

  @Post('watchlist/import')
  @HttpCode(HttpStatus.OK)
  import(@Req() req: AuthRequest, @Body() dto: ImportWatchlistDto) {
    return this.compliance.importEntries(currentUser(req), dto);
  }

  @Post('watchlist/test')
  @HttpCode(HttpStatus.OK)
  test(@Req() req: AuthRequest, @Body() dto: TestNameDto) {
    return this.compliance.testName(currentUser(req), dto.name);
  }

  @Patch('watchlist/:id')
  update(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: UpdateWatchlistEntryDto) {
    return this.compliance.updateEntry(currentUser(req), id, dto);
  }

  @Delete('watchlist/:id')
  remove(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.compliance.removeEntry(currentUser(req), id);
  }

  @Post('screen-customers')
  @HttpCode(HttpStatus.OK)
  screenCustomers(@Req() req: AuthRequest) {
    return this.compliance.screenCustomers(currentUser(req));
  }

  @Get('settings')
  settings(@Req() req: AuthRequest) {
    return this.compliance.getSettings(currentUser(req));
  }

  @Put('settings')
  updateSettings(@Req() req: AuthRequest, @Body() dto: UpdateComplianceSettingsDto) {
    return this.compliance.updateSettings(currentUser(req), dto);
  }

  @Get('official-lists')
  officialLists(@Req() req: AuthRequest) {
    return this.compliance.officialLists(currentUser(req));
  }

  @Put('official-lists/:provider')
  setOfficialList(@Req() req: AuthRequest, @Param('provider') provider: string, @Body() dto: ToggleOfficialListDto) {
    return this.compliance.setOfficialList(currentUser(req), provider, dto.enabled);
  }

  @Post('official-lists/:provider/sync')
  @HttpCode(HttpStatus.ACCEPTED)
  syncOfficialList(@Req() req: AuthRequest, @Param('provider') provider: string) {
    return this.compliance.syncOfficialList(currentUser(req), provider);
  }
}
