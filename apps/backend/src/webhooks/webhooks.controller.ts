// apps/backend/src/webhooks/webhooks.controller.ts
// =========================================================
// WEBHOOKS CONTROLLER v1.0 (lot 17) — administrateur de société
//   GET  /webhooks-admin                      points de réception + statistiques 24 h + catalogue d'événements
//   POST /webhooks-admin                      créer (le secret n'est renvoyé qu'ici)
//   PATCH /webhooks-admin/:id                 modifier / activer / désactiver
//   POST /webhooks-admin/:id/rotate-secret    régénérer le secret          POST /webhooks-admin/:id/test   envoyer un ping
//   POST /webhooks-admin/:id/replay-failed    remettre en file les échecs   DELETE /webhooks-admin/:id
//   GET  /webhooks-admin/deliveries           journal des envois           POST /webhooks-admin/deliveries/:id/replay
// =========================================================

import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhooks.dto';
import { WebhooksService } from './webhooks.service';

type AuthRequest = Request & { user?: AuthUserPayload };

function currentUser(req: AuthRequest): AuthUserPayload {
  if (!req.user) throw new ForbiddenException('Non authentifié');
  return req.user;
}

@ApiTags('Webhooks')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.COMPANY_ADMIN)
@Controller('webhooks-admin')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  list(@Req() req: AuthRequest) {
    return this.webhooks.list(currentUser(req));
  }

  @Post()
  create(@Req() req: AuthRequest, @Body() dto: CreateWebhookDto) {
    return this.webhooks.create(currentUser(req), dto);
  }

  // Routes « deliveries » déclarées AVANT « :id » pour ne pas être prises pour un identifiant.
  @Get('deliveries')
  deliveries(@Req() req: AuthRequest, @Query('endpointId') endpointId?: string, @Query('status') status?: string, @Query('take') take?: string) {
    return this.webhooks.deliveries(currentUser(req), { endpointId, status, take: take ? Number(take) : undefined });
  }

  @Post('deliveries/:id/replay')
  @HttpCode(HttpStatus.OK)
  replay(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.webhooks.replay(currentUser(req), id);
  }

  @Patch(':id')
  update(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.webhooks.update(currentUser(req), id, dto);
  }

  @Post(':id/rotate-secret')
  @HttpCode(HttpStatus.OK)
  rotate(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.webhooks.rotateSecret(currentUser(req), id);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  test(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.webhooks.test(currentUser(req), id);
  }

  @Post(':id/replay-failed')
  @HttpCode(HttpStatus.OK)
  replayFailed(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.webhooks.replayFailed(currentUser(req), id);
  }

  @Delete(':id')
  remove(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.webhooks.remove(currentUser(req), id);
  }
}
