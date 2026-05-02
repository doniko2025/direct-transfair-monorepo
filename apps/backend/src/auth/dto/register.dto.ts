// apps/backend/src/auth/dto/register.dto.ts
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsEnum,
} from 'class-validator';
import { Role } from '@prisma/client';

export class RegisterDto {
  /**
   * ✅ Compat uniquement:
   * - En SaaS "un lien par société", le tenant est résolu via x-tenant-id
   * - Donc le client n'a plus à saisir ce champ.
   */
  @IsString()
  @IsOptional()
  tenantCode?: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsString()
  @IsOptional()
  phone?: string;

  /**
   * ✅ Code ISO alpha-2 (FR, GN, GB, US, SN…)
   *    → utilisé pour déduire la devise principale et créer le wallet automatiquement
   *    Ex: country="FR" → primaryCurrency="EUR" + Wallet EUR créé
   */
  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  addressStreet?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  @IsString()
  @IsOptional()
  nationality?: string;

  @IsString()
  @IsOptional()
  birthDate?: string;

  @IsString()
  @IsOptional()
  birthCountry?: string;

  @IsString()
  @IsOptional()
  birthCity?: string;

  @IsString()
  @IsOptional()
  birthPlace?: string;
}