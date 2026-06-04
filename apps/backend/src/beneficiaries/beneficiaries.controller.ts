// apps/backend/src/beneficiaries/beneficiaries.controller.ts
// =========================================================
// BENEFICIARIES CONTROLLER v4.1
// ✅ v4.0 : chemin JwtAuthGuard corrigé
// ✅ v4.1 : GET /beneficiaries/lookup?phone=...
//    Recherche un destinataire par numéro de téléphone.
//    Utilisé par le frontend wallet-transfer pour auto-suggérer
//    les infos du destinataire dès la saisie du numéro.
// =========================================================

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { BeneficiariesService } from './beneficiaries.service';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenants/tenant.guard';

@ApiTags('Beneficiaries')
@ApiBearerAuth('access-token')
@UseGuards(TenantGuard, JwtAuthGuard)
@Controller('beneficiaries')
export class BeneficiariesController {
  private readonly logger = new Logger(BeneficiariesController.name);

  constructor(private readonly beneficiariesService: BeneficiariesService) {}

  private getUserInfo(req: any) {
    const user     = req.user;
    const userId   = user?.id || user?.sub || user?.userId;
    const clientId = user?.clientId;

    if (!userId) {
      this.logger.error('❌ User ID missing in request context');
      throw new UnauthorizedException('Utilisateur non identifié (User ID missing)');
    }

    return { userId, clientId };
  }

  // ========================================================
  // LOOKUP PAR TÉLÉPHONE — v4.1
  // GET /beneficiaries/lookup?phone=+221775099995
  //
  // Doit être déclaré AVANT /:id pour ne pas être capturé
  // par la route @Get(':id').
  //
  // Retourne :
  //   { found: true, isPlatformUser: true, fullName, country, city, ... }
  //   { found: false, isPlatformUser: false }
  // ========================================================

  @Get('lookup')
  @ApiOperation({
    summary: 'Recherche un destinataire par numéro de téléphone',
    description:
      'Renvoie les infos du destinataire (bénéficiaire existant ou ' +
      'utilisateur enregistré sur la plateforme) pour auto-suggestion ' +
      'dans le formulaire de transfert wallet.',
  })
  @ApiQuery({
    name:        'phone',
    required:    true,
    description: 'Numéro en format international, ex: +221775099995',
  })
  async lookupByPhone(
    @Req() req: any,
    @Query('phone') phone: string,
  ) {
    const { userId } = this.getUserInfo(req);

    if (!phone?.trim()) {
      throw new BadRequestException('Le paramètre "phone" est requis.');
    }

    return this.beneficiariesService.lookupByPhone(phone.trim(), userId);
  }

  // ========================================================
  // CRUD STANDARD
  // ========================================================

  @Post()
  async create(@Req() req: any, @Body() dto: CreateBeneficiaryDto) {
    const { userId, clientId } = this.getUserInfo(req);
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