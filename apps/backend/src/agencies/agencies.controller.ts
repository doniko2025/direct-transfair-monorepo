//apps/backend/src/agencies/agencies.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AgenciesService } from './agencies.service';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

type AuthedReq = {
  user?: {
    id: string;
    role: Role;
    clientId?: number | null;
  };
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('agencies')
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  // ✅ Création Agence (Admin Société)
  @Post()
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN)
  async create(@Req() req: AuthedReq, @Body() dto: CreateAgencyDto) {
    const user = req.user;
    const clientId = user?.clientId ?? null;

    if (!clientId) {
      throw new BadRequestException(
        "Impossible de créer une agence : Aucun client (Société) associé à ce compte.",
      );
    }

    return this.agenciesService.create(clientId, dto);
  }

  // ✅ Liste des Agences
  @Get()
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN, Role.AGENT)
  async findAll(@Req() req: AuthedReq) {
    const clientId = req.user?.clientId ?? null;
    if (!clientId) return [];
    return this.agenciesService.findAllByClient(clientId);
  }

  // ✅ Détail Agence
  @Get(':id')
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN, Role.AGENT)
  async findOne(@Req() req: AuthedReq, @Param('id') id: string) {
    const clientId = req.user?.clientId ?? null;
    if (!clientId) throw new BadRequestException('Aucun client associé');
    return this.agenciesService.findOne(id, clientId);
  }
}
