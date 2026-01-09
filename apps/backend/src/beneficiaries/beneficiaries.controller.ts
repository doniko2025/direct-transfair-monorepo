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
  Logger,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { BeneficiariesService } from './beneficiaries.service';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';

// Assure-toi que ces imports pointent vers tes fichiers existants
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/tenant.guard';

@ApiTags('Beneficiaries')
@ApiBearerAuth()
@UseGuards(TenantGuard, JwtAuthGuard)
@Controller('beneficiaries')
export class BeneficiariesController {
  private readonly logger = new Logger(BeneficiariesController.name);

  constructor(private readonly beneficiariesService: BeneficiariesService) {}

  // --- Helper pour extraire l'utilisateur proprement ---
  private getUserInfo(req: any) {
    const user = req.user;
    
    // Debug pour voir ce que le serveur reçoit
    // this.logger.log(`User Payload: ${JSON.stringify(user)}`);

    // On accepte 'id' (standard) ou 'sub' (JWT brut) ou 'userId'
    const userId = user?.id || user?.sub || user?.userId;
    const clientId = user?.clientId;

    if (!userId) {
      this.logger.error('❌ User ID missing in request context');
      throw new UnauthorizedException('Utilisateur non identifié (User ID missing)');
    }

    return { userId, clientId };
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateBeneficiaryDto) {
    const { userId, clientId } = this.getUserInfo(req);
    // On passe le clientId (qui peut être undefined pour un admin global, mais requis pour un tenant)
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
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateBeneficiaryDto,
  ) {
    const { userId } = this.getUserInfo(req);
    return this.beneficiariesService.updateForUser(id, userId, dto);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const { userId } = this.getUserInfo(req);
    return this.beneficiariesService.deleteForUser(id, userId);
  }
}