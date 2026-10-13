// apps/backend/src/auth/platform-sso.controller.ts
// =========================================================
// POST /auth/platform-sso v1.0 — voir platform-sso.service.ts
// Public (c'est la signature de l'assertion qui authentifie), limité à 10 essais / minute / IP.
// =========================================================

import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString, MaxLength, MinLength } from 'class-validator';

import { Public } from '../common/decorators/public.decorator';
import { APP_CLIENT_HEADER } from './app-client.policy';
import { PlatformSsoService } from './platform-sso.service';

export class PlatformSsoDto {
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  assertion!: string;
}

@Public()
@Controller('auth')
@ApiTags('Auth')
export class PlatformSsoController {
  constructor(private readonly sso: PlatformSsoService) {}

  @Post('platform-sso')
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Connexion unique depuis la console dkmoney.store (assertion signée, usage unique)',
  })
  login(@Body() dto: PlatformSsoDto, @Headers(APP_CLIENT_HEADER) appClient?: string) {
    return this.sso.login(dto.assertion, appClient ?? null);
  }
}
