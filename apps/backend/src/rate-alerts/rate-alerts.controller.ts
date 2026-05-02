// apps/backend/src/rate-alerts/rate-alerts.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';

import { RateAlertsService } from './rate-alerts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';

@ApiTags('Rate Alerts')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('rate-alerts')
export class RateAlertsController {
  constructor(private readonly service: RateAlertsService) {}

  @Post()
  create(
    @Req() req: Request & { user?: AuthUserPayload },
    @Body() body: any,
  ) {
    if (!req.user) throw new ForbiddenException('Non authentifié');
    return this.service.create(req.user.id, body);
  }

  @Get()
  findAll(@Req() req: Request & { user?: AuthUserPayload }) {
    if (!req.user) throw new ForbiddenException('Non authentifié');
    return this.service.findForUser(req.user.id);
  }

  @Get(':id')
  findOne(
    @Req() req: Request & { user?: AuthUserPayload },
    @Param('id') id: string,
  ) {
    if (!req.user) throw new ForbiddenException('Non authentifié');
    return this.service.findOne(id, req.user.id);
  }

  @Delete(':id')
  remove(
    @Req() req: Request & { user?: AuthUserPayload },
    @Param('id') id: string,
  ) {
    if (!req.user) throw new ForbiddenException('Non authentifié');
    return this.service.delete(id, req.user.id);
  }

  @Patch(':id/reset')
  reset(
    @Req() req: Request & { user?: AuthUserPayload },
    @Param('id') id: string,
  ) {
    if (!req.user) throw new ForbiddenException('Non authentifié');
    return this.service.resetAlert(id, req.user.id);
  }

  // Admin seulement — déclenche une vérification manuelle
  @Post('admin/trigger-check')
  triggerCheck(@Req() req: Request & { user?: AuthUserPayload }) {
    if (req.user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Réservé au Super Admin');
    }
    return this.service.triggerCheck();
  }
}