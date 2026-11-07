// apps/backend/src/support/support-desk.controller.ts
// =========================================================
// BUREAU D'ASSISTANCE — routes du service client (et de l'administrateur de société).
// Chaque route exige une délégation (@RequirePermissions) : un administrateur les a toutes, un compte SUPPORT seulement celles que
// l'administrateur a activées. Le contrôle est refait à chaque requête avec les droits lus en base.
//
//   GET   /support-desk/overview                     compteurs + délégations du compte
//   GET   /support-desk/clients[?search&status&page]  CLIENTS_VIEW
//   GET   /support-desk/clients/:id                   CLIENTS_VIEW
//   PATCH /support-desk/clients/:id/suspend           ACCOUNT_SUSPEND   { reason }
//   PATCH /support-desk/clients/:id/reactivate        ACCOUNT_REACTIVATE
//   GET   /support-desk/transactions[/:id]            TRANSACTIONS_VIEW
//   GET   /support-desk/tickets[/:id]                 TICKETS_HANDLE
//   POST  /support-desk/tickets/:id/take|reply|resolve|close    TICKETS_HANDLE (litige : DISPUTES_RESOLVE pour resolve)
//   GET   /support-desk/refunds                       REFUNDS_DECIDE ou DISPUTES_RESOLVE
//   POST  /support-desk/refunds                       REFUNDS_DECIDE ou DISPUTES_RESOLVE
//   POST  /support-desk/refunds/:id/decide            REFUNDS_DECIDE
// =========================================================

import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateRefundRequestDto, DecideRefundDto } from './dto/refunds.dto';
import { ResolveTicketDto, TicketReplyDto } from './dto/tickets.dto';
import { RequirePermissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';
import { RefundsService } from './refunds.service';
import { SupportDeskService } from './support-desk.service';
import { TicketsService } from './tickets.service';

type AuthRequest = Request & { user?: AuthUserPayload };

function me(req: AuthRequest): AuthUserPayload {
  if (!req.user) throw new ForbiddenException('Non authentifié');
  return req.user;
}
const num = (v?: string): number | undefined => (v ? Number(v) || undefined : undefined);

class SuspendDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

@ApiTags('Service client — bureau')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.SUPPORT)
@Controller('support-desk')
export class SupportDeskController {
  constructor(
    private readonly desk: SupportDeskService,
    private readonly tickets: TicketsService,
    private readonly refunds: RefundsService,
  ) {}

  @Get('overview')
  overview(@Req() req: AuthRequest) {
    return this.desk.overview(me(req));
  }

  // ── Clients ──────────────────────────────────────────
  @Get('clients')
  @RequirePermissions('CLIENTS_VIEW')
  clients(@Req() req: AuthRequest, @Query('search') search?: string, @Query('status') status?: string, @Query('page') page?: string, @Query('limit') limit?: string, @Query('clientId') clientId?: string) {
    return this.desk.listClients(me(req), { search, status, page: num(page), limit: num(limit), clientId: num(clientId) });
  }

  @Get('clients/:id')
  @RequirePermissions('CLIENTS_VIEW')
  client(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.desk.clientDetail(me(req), id);
  }

  @Patch('clients/:id/suspend')
  @Roles(Role.COMPANY_ADMIN, Role.SUPPORT)
  @RequirePermissions('ACCOUNT_SUSPEND')
  suspend(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: SuspendDto) {
    return this.desk.suspend(me(req), id, body?.reason ?? '');
  }

  @Patch('clients/:id/reactivate')
  @Roles(Role.COMPANY_ADMIN, Role.SUPPORT)
  @RequirePermissions('ACCOUNT_REACTIVATE')
  reactivate(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.desk.reactivate(me(req), id);
  }

  // ── Opérations ───────────────────────────────────────
  @Get('transactions')
  @RequirePermissions('TRANSACTIONS_VIEW')
  transactions(@Req() req: AuthRequest, @Query('search') search?: string, @Query('status') status?: string, @Query('page') page?: string, @Query('limit') limit?: string, @Query('clientId') clientId?: string) {
    return this.desk.searchTransactions(me(req), { search, status, page: num(page), limit: num(limit), clientId: num(clientId) });
  }

  @Get('transactions/:id')
  @RequirePermissions('TRANSACTIONS_VIEW')
  transaction(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.desk.transactionDetail(me(req), id);
  }

  // ── Demandes et litiges ──────────────────────────────
  @Get('tickets')
  @RequirePermissions('TICKETS_HANDLE')
  ticketList(@Req() req: AuthRequest, @Query('status') status?: string, @Query('kind') kind?: string, @Query('search') search?: string, @Query('mine') mine?: string, @Query('page') page?: string, @Query('limit') limit?: string, @Query('clientId') clientId?: string) {
    return this.tickets.list(me(req), { status, kind, search, mine: mine === 'true', page: num(page), limit: num(limit), clientId: num(clientId) });
  }

  @Get('tickets/:id')
  @RequirePermissions('TICKETS_HANDLE')
  ticket(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.tickets.detail(me(req), id);
  }

  @Post('tickets/:id/take')
  @Roles(Role.COMPANY_ADMIN, Role.SUPPORT)
  @RequirePermissions('TICKETS_HANDLE')
  take(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.tickets.takeOver(me(req), id);
  }

  @Post('tickets/:id/reply')
  @Roles(Role.COMPANY_ADMIN, Role.SUPPORT)
  @RequirePermissions('TICKETS_HANDLE')
  reply(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: TicketReplyDto) {
    return this.tickets.reply(me(req), id, body);
  }

  @Post('tickets/:id/resolve')
  @Roles(Role.COMPANY_ADMIN, Role.SUPPORT)
  @RequirePermissions('TICKETS_HANDLE')
  resolve(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: ResolveTicketDto) {
    return this.tickets.resolve(me(req), id, body);
  }

  @Post('tickets/:id/close')
  @Roles(Role.COMPANY_ADMIN, Role.SUPPORT)
  @RequirePermissions('TICKETS_HANDLE')
  close(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.tickets.close(me(req), id);
  }

  // ── Remboursements ───────────────────────────────────
  @Get('refunds')
  @RequirePermissions('REFUNDS_DECIDE', 'DISPUTES_RESOLVE')
  refundList(@Req() req: AuthRequest, @Query('status') status?: string, @Query('page') page?: string, @Query('limit') limit?: string, @Query('clientId') clientId?: string) {
    return this.refunds.list(me(req), { status, page: num(page), limit: num(limit), clientId: num(clientId) });
  }

  @Post('refunds')
  @Roles(Role.COMPANY_ADMIN, Role.SUPPORT)
  @RequirePermissions('REFUNDS_DECIDE', 'DISPUTES_RESOLVE')
  refundCreate(@Req() req: AuthRequest, @Body() body: CreateRefundRequestDto) {
    return this.refunds.create(me(req), body);
  }

  @Post('refunds/:id/decide')
  @Roles(Role.COMPANY_ADMIN, Role.SUPPORT)
  @RequirePermissions('REFUNDS_DECIDE')
  refundDecide(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: DecideRefundDto) {
    return this.refunds.decide(me(req), id, body);
  }
}
