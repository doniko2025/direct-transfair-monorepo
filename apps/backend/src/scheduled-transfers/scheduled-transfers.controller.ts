// apps/backend/src/scheduled-transfers/scheduled-transfers.controller.ts
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

import { ScheduledTransfersService } from './scheduled-transfers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';

@ApiTags('Scheduled Transfers')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('scheduled-transfers')
export class ScheduledTransfersController {
  constructor(private readonly service: ScheduledTransfersService) {}

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

  @Patch(':id/pause')
  pause(
    @Req() req: Request & { user?: AuthUserPayload },
    @Param('id') id: string,
  ) {
    if (!req.user) throw new ForbiddenException('Non authentifié');
    return this.service.pause(id, req.user.id);
  }

  @Patch(':id/resume')
  resume(
    @Req() req: Request & { user?: AuthUserPayload },
    @Param('id') id: string,
  ) {
    if (!req.user) throw new ForbiddenException('Non authentifié');
    return this.service.resume(id, req.user.id);
  }

  @Patch(':id/cancel')
  cancel(
    @Req() req: Request & { user?: AuthUserPayload },
    @Param('id') id: string,
  ) {
    if (!req.user) throw new ForbiddenException('Non authentifié');
    return this.service.cancel(id, req.user.id);
  }
}