// apps/backend/src/account-deletion/account-deletion.controller.ts
// POST /account/delete  { phone, pin } — suppression de son propre compte (téléphone + code secret).
import { Body, Controller, ForbiddenException, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { AccountDeletionService } from './account-deletion.service';

export class DeleteAccountDto {
  /** Numéro de téléphone du compte, avec indicatif. */
  @IsString()
  @MinLength(6)
  @MaxLength(30)
  phone: string;

  /** Code secret à 6 chiffres. */
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  pin: string;
}

@ApiTags('Account')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('account')
export class AccountDeletionController {
  constructor(private readonly deletion: AccountDeletionService) {}

  @Post('delete')
  @HttpCode(200)
  remove(@Req() req: Request & { user?: AuthUserPayload }, @Body() dto: DeleteAccountDto) {
    if (!req.user?.id) throw new ForbiddenException('Non authentifié');
    return this.deletion.deleteMyAccount(req.user.id, { phone: dto.phone, pin: dto.pin });
  }
}
