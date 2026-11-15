// apps/backend/src/rates-admin/rates-admin.controller.ts
// =========================================================
// RATES ADMIN CONTROLLER v2.0 — taux PAR SOCIÉTÉ
//   GET /rates-admin                    COMPANY_ADMIN : SES taux · SUPER_ADMIN : ?clientId= obligatoire, LECTURE SEULE
//   GET /rates-admin/:pair/history      idem
//   PATCH /rates-admin/:pair              COMPANY_ADMIN uniquement (SES taux) : { rate, confirmLargeChange? }
// Chaque société est libre de ses taux, indépendamment des autres : un administrateur de société ne lit ni n'écrit jamais ceux
// d'une autre société (le clientId vient du jeton, jamais de la requête) ; le super admin ne peut qu'observer.
// =========================================================

import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RateHistoryQueryDto, RatesScopeQueryDto, SetRateDto } from './dto/rates-admin.dto';
import { RatesAdminService } from './rates-admin.service';

type AuthRequest = Request & { user?: AuthUserPayload };

@ApiTags('Rates admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rates-admin')
export class RatesAdminController {
  constructor(
    private readonly admin: RatesAdminService,
    private readonly prisma: PrismaService,
  ) {}

  /** Société visée : celle du jeton pour un admin de société ; ?clientId= (société existante) pour le super admin. */
  private async scopeOf(req: AuthRequest, query: RatesScopeQueryDto): Promise<number> {
    const user = req.user;
    if (!user) throw new ForbiddenException('Non authentifié');
    if (user.role === Role.SUPER_ADMIN) {
      if (!query.clientId) throw new BadRequestException('Choisissez une société (clientId).');
      const exists = await this.prisma.client.findUnique({ where: { id: query.clientId }, select: { id: true } });
      if (!exists) throw new NotFoundException('Société introuvable.');
      return exists.id;
    }
    if (!user.clientId) throw new ForbiddenException('Aucune société rattachée à ce compte.');
    return user.clientId;
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Taux de change d’une société, par couple de devises (le super admin : lecture seule)' })
  async list(@Req() req: AuthRequest, @Query() query: RatesScopeQueryDto) {
    return this.admin.list(await this.scopeOf(req, query));
  }

  @Get(':pair/history')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Historique d’une paire (société)' })
  async history(@Req() req: AuthRequest, @Param('pair') pair: string, @Query() query: RateHistoryQueryDto) {
    return this.admin.history(await this.scopeOf(req, query), pair, query.limit);
  }

  @Patch(':pair')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Enregistre un taux de SA société (le sens inverse se déduit)' })
  set(@Req() req: AuthRequest, @Param('pair') pair: string, @Body() body: SetRateDto) {
    const user = req.user;
    if (!user) throw new ForbiddenException('Non authentifié');
    if (!user.clientId) throw new ForbiddenException('Aucune société rattachée à ce compte.');
    return this.admin.set(user, user.clientId, pair, body);
  }
}
