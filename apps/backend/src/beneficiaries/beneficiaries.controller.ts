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

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenants/tenant.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';

@UseGuards(TenantGuard, JwtAuthGuard)
@Controller('beneficiaries')
export class BeneficiariesController {
  constructor(private readonly beneficiariesService: BeneficiariesService) {}

  private getUserId(req: { user?: AuthUserPayload }): string {
    const user = req.user;
    if (!user?.id) {
      throw new UnauthorizedException('Missing authenticated user in request');
    }
    return user.id;
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateBeneficiaryDto) {
    const userId = this.getUserId(req);
    return this.beneficiariesService.create(userId, dto);
  }

  @Get()
  async findAll(@Req() req: any) {
    const userId = this.getUserId(req);
    return this.beneficiariesService.findAllForUser(userId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.beneficiariesService.findOneForUser(id, userId);
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateBeneficiaryDto,
  ) {
    const userId = this.getUserId(req);
    return this.beneficiariesService.updateForUser(id, userId, dto);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.beneficiariesService.deleteForUser(id, userId);
  }
}
