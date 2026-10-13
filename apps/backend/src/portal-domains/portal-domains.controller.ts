// apps/backend/src/portal-domains/portal-domains.controller.ts
// =========================================================
// /portal-domains v1.0 — domaines des portails de sociétés. Réservé au SUPER_ADMIN (console du Grand Chef).
//   GET    /portal-domains/config            état des intégrations (Vercel, Cloudflare, sous-domaines)
//   GET    /portal-domains                   toutes les sociétés + leur domaine
//   GET    /portal-domains/:clientId         une société
//   PUT    /portal-domains/:clientId         définir / remplacer le domaine
//   POST   /portal-domains/:clientId/check   revérifier maintenant
//   DELETE /portal-domains/:clientId         retirer le domaine
// =========================================================

import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { PortalDomainsService } from './portal-domains.service';

export class SetPortalDomainDto {
  @IsIn(['SUBDOMAIN', 'CUSTOM'])
  kind!: 'SUBDOMAIN' | 'CUSTOM';

  @IsOptional() @IsString() @MaxLength(64)
  subdomain?: string;

  @IsOptional() @IsString() @MaxLength(255)
  domain?: string;

  @IsOptional() @IsIn(['CLOUDFLARE', 'EXTERNAL'])
  dnsMode?: 'CLOUDFLARE' | 'EXTERNAL';

  @IsOptional() @IsString() @MaxLength(255)
  zoneName?: string;
}

type Req = { user?: AuthUserPayload };

@ApiTags('Portal domains')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('portal-domains')
export class PortalDomainsController {
  constructor(private readonly service: PortalDomainsService) {}

  @Get('config')
  @ApiOperation({ summary: 'État des intégrations de domaine (Vercel, Cloudflare, sous-domaines)' })
  config() {
    return this.service.config();
  }

  @Get()
  @ApiOperation({ summary: 'Sociétés et domaine de leur portail' })
  list() {
    return this.service.list();
  }

  @Get(':clientId')
  get(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.service.get(clientId);
  }

  @Put(':clientId')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: "Définir ou remplacer le domaine du portail d'une société" })
  set(@Param('clientId', ParseIntPipe) clientId: number, @Body() dto: SetPortalDomainDto, @Req() req: Req) {
    return this.service.setDomain(req.user?.id, clientId, dto);
  }

  @Post(':clientId/check')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Revérifier le domaine maintenant' })
  check(@Param('clientId', ParseIntPipe) clientId: number, @Req() req: Req) {
    return this.service.recheck(req.user?.id, clientId);
  }

  @Delete(':clientId')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: "Retirer le domaine du portail d'une société" })
  remove(@Param('clientId', ParseIntPipe) clientId: number, @Req() req: Req) {
    return this.service.remove(req.user?.id, clientId);
  }
}
