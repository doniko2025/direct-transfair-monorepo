//apps/backend/src/agencies/agencies.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Delete, // ✅ Import indispensable
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AgenciesService } from './agencies.service';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';
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

  @Post()
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN)
  async create(@Req() req: AuthedReq, @Body() dto: CreateAgencyDto) {
    const clientId = req.user?.clientId ?? null;
    if (!clientId) throw new BadRequestException("Aucun client associé");
    return this.agenciesService.create(clientId, dto);
  }

  @Patch(':id')
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN)
  async update(@Req() req: AuthedReq, @Param('id') id: string, @Body() dto: UpdateAgencyDto) {
      const clientId = req.user?.clientId ?? null;
      if (!clientId) throw new BadRequestException("Aucun client associé");
      return this.agenciesService.update(id, clientId, dto);
  }

  // ✅ Route de suppression
  @Delete(':id')
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN)
  async remove(@Req() req: AuthedReq, @Param('id') id: string) {
      const clientId = req.user?.clientId ?? null;
      if (!clientId) throw new BadRequestException("Aucun client associé");
      return this.agenciesService.remove(id, clientId);
  }

  @Get()
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN, Role.AGENT)
  async findAll(@Req() req: AuthedReq) {
    const clientId = req.user?.clientId ?? null;
    if (!clientId) return [];
    return this.agenciesService.findAllByClient(clientId);
  }

  @Get(':id')
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN, Role.AGENT)
  async findOne(@Req() req: AuthedReq, @Param('id') id: string) {
    const clientId = req.user?.clientId ?? null;
    if (!clientId) throw new BadRequestException('Aucun client associé');
    return this.agenciesService.findOne(id, clientId);
  }
}