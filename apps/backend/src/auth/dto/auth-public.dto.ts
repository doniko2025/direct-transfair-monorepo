// apps/backend/src/auth/dto/auth-public.dto.ts
// =========================================================
// CORPS DES ROUTES /auth PUBLIQUES ET DE PROFIL — typés par des classes pour que le ValidationPipe les contrôle.
//
// Avant, ces routes déclaraient leur corps en type inline (`@Body() body: { userId: string }`) : TypeScript efface
// ces types à l'exécution, le ValidationPipe n'avait rien à valider, et un client pouvait envoyer un OBJET à la place
// d'une chaîne (ex. { "userId": { "not": "x" } }) qui arrivait tel quel dans la requête Prisma (injection d'opérateur).
// @IsString() refuse tout ce qui n'est pas une chaîne.
// =========================================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const REQUIRED = { message: 'Données incomplètes' };
const NOT_TEXT = { message: 'Format de données invalide' };

export class FindAccountDto {
  @ApiProperty() @IsString(NOT_TEXT) @IsNotEmpty({ message: 'Identifiant requis' }) @MaxLength(200)
  identifier!: string;
}

export class LoginByPhoneDto {
  @ApiProperty() @IsString(NOT_TEXT) @IsNotEmpty({ message: 'Numéro de téléphone requis' }) @MaxLength(40)
  phone!: string;
}

export class SendOtpDto {
  @ApiProperty() @IsString(NOT_TEXT) @IsNotEmpty(REQUIRED) @MaxLength(60)
  userId!: string;

  @ApiProperty({ enum: ['EMAIL', 'PHONE'] })
  @IsString(NOT_TEXT) @IsIn(['EMAIL', 'PHONE'], { message: 'Canal inconnu (EMAIL ou PHONE)' })
  channel!: 'EMAIL' | 'PHONE';

  @ApiPropertyOptional() @IsOptional() @IsString(NOT_TEXT) @MaxLength(40)
  purpose?: string;
}

export class VerifyOtpDto {
  @ApiProperty() @IsString(NOT_TEXT) @IsNotEmpty(REQUIRED) @MaxLength(60)
  userId!: string;

  @ApiProperty() @IsString(NOT_TEXT) @IsNotEmpty(REQUIRED) @MaxLength(12)
  code!: string;

  @ApiPropertyOptional() @IsOptional() @IsString(NOT_TEXT) @MaxLength(40)
  type?: string;
}

export class ResetPasswordDto {
  @ApiProperty() @IsString(NOT_TEXT) @IsNotEmpty(REQUIRED) @MaxLength(60)
  userId!: string;

  @ApiProperty() @IsString(NOT_TEXT) @IsNotEmpty(REQUIRED) @MaxLength(12)
  code!: string;

  @ApiProperty() @IsString(NOT_TEXT) @IsNotEmpty(REQUIRED) @MaxLength(200)
  newPassword!: string;
}

export class RefreshTokenDto {
  /** Absent pour le portail web : le refresh token est alors lu dans le cookie httpOnly (voir refresh-cookie.ts). */
  @ApiPropertyOptional() @IsOptional() @IsString(NOT_TEXT) @IsNotEmpty({ message: 'refresh_token requis' }) @MaxLength(500)
  refresh_token?: string;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString(NOT_TEXT) @IsNotEmpty({ message: 'Champs manquants' }) @MaxLength(200)
  oldPass!: string;

  @ApiProperty() @IsString(NOT_TEXT) @IsNotEmpty({ message: 'Champs manquants' }) @MaxLength(200)
  newPass!: string;
}
