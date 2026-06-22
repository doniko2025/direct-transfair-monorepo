// apps/backend/src/users/dto/create-user.dto.ts
// =========================================================
// CREATE USER DTO v1.1
// ✅ v1.0 : Validation de base (email, password, firstName, lastName,
//   role, clientId).
// ✅ v1.1 : FIX — Ajout des champs `phone` et `country`, manquants
//   alors qu'ils sont lus directement par UsersController.create()
//   via body.phone et body.country, puis transmis à
//   usersService.create() (utilisés pour déterminer primaryCurrency
//   via getCurrencyFromCountry() et pré-remplir le profil).
//   Sans ces champs :
//     - Si ce DTO remplace l'interface inline CreateUserBody
//       actuellement utilisée par le contrôleur → erreur de
//       compilation TypeScript (propriétés inexistantes).
//     - Si un ValidationPipe global avec whitelist est actif →
//       ces champs seraient silencieusement retirés du payload
//       entrant avant d'atteindre le contrôleur.
//   Les deux champs restent optionnels (IsOptional) pour ne pas
//   casser les flux de création existants qui ne les envoient pas
//   systématiquement (ex: création SUPER_ADMIN sans téléphone).
// =========================================================
import { IsEmail, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'jean@doniko.com' })
  @IsEmail({}, { message: "L'email doit être valide" })
  email: string;

  @ApiProperty({ example: 'Secret123!' })
  @IsString()
  @MinLength(6, { message: 'Le mot de passe doit faire au moins 6 caractères' })
  password: string;

  @ApiProperty({ example: 'Jean' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Dupont' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiPropertyOptional({ enum: Role, example: 'AGENT' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ description: "ID de la société (Uniquement pour Super Admin)" })
  @IsOptional()
  @IsNumber()
  clientId?: number;

  // ✅ v1.1
  @ApiPropertyOptional({ example: '+221775099993', description: 'Numéro de téléphone (avec ou sans indicatif)' })
  @IsOptional()
  @IsString()
  phone?: string;

  // ✅ v1.1
  @ApiPropertyOptional({ example: 'Sénégal', description: 'Utilisé pour déterminer la devise principale (primaryCurrency)' })
  @IsOptional()
  @IsString()
  country?: string;
}