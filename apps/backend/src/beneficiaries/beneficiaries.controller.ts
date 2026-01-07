// apps/backend/src/beneficiaries/beneficiaries.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { BeneficiariesService } from './beneficiaries.service';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // ⚠️ Vérifie ton chemin d'import (auth/guards vs auth/jwt-auth.guard)
// Si ton fichier est à la racine de auth, laisse comme tu avais. Sinon utilise auth/guards/jwt-auth.guard
// Pour éviter les erreurs, je remets ton import original s'il marchait, ou le standard :
// import { JwtAuthGuard } from '../auth/jwt-auth.guard'; 

import { TenantGuard } from '../tenants/tenant.guard';

@UseGuards(TenantGuard, JwtAuthGuard)
@Controller('beneficiaries')
export class BeneficiariesController {
  constructor(private readonly beneficiariesService: BeneficiariesService) {}

  private getUserInfo(req: any) {
    const user = req.user;
    if (!user?.id) throw new UnauthorizedException('User missing');
    return { userId: user.id, clientId: user.clientId };
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateBeneficiaryDto) {
    const { userId, clientId } = this.getUserInfo(req);
    // ✅ On passe le clientId pour lier le bénéficiaire à la société
    return this.beneficiariesService.create(userId, clientId, dto);
  }

  @Get()
  async findAll(@Req() req: any) {
    const { userId } = this.getUserInfo(req);
    return this.beneficiariesService.findAllForUser(userId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const { userId } = this.getUserInfo(req);
    return this.beneficiariesService.findOneForUser(id, userId);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateBeneficiaryDto) {
    const { userId } = this.getUserInfo(req);
    return this.beneficiariesService.updateForUser(id, userId, dto);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const { userId } = this.getUserInfo(req);
    return this.beneficiariesService.deleteForUser(id, userId);
  }
}