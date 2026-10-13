// apps/backend/src/scheduled-transfers/scheduled-transfers.controller.ts
// v1.1 (phase 6) : réservé aux clients (rôle USER) — un virement programmé débite le wallet personnel de l'expéditeur ;
// corps de POST validé par CreateScheduledTransferDto (avant : `body: any`).
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
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateScheduledTransferDto } from './dto/create-scheduled-transfer.dto';
import { Role } from '@prisma/client';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';

@ApiTags('Scheduled Transfers')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER)
@Controller('scheduled-transfers')
export class ScheduledTransfersController {
  constructor(private readonly service: ScheduledTransfersService) {}

  @Post()
  create(
    @Req() req: Request & { user?: AuthUserPayload },
    @Body() body: CreateScheduledTransferDto,
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