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
  // 🔹 Code Société (Pour s'inscrire dans un Tenant spécifique)
  @IsString()
  @IsOptional()
  tenantCode?: string;

  // 🔹 Identité
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  // 🔹 Auth
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  // 🔹 Contact
  @IsString()
  @IsOptional()
  phone?: string;

  // 🔹 Adresse & Lieu
  @IsString()
  @IsOptional()
  country?: string; // Pays de résidence

  @IsString()
  @IsOptional()
  city?: string;    // Ville de résidence

  @IsString()
  @IsOptional()
  addressStreet?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  // 🔹 KYC / État Civil
  @IsString()
  @IsOptional()
  nationality?: string;

  @IsString()
  @IsOptional()
  birthDate?: string;    // ISO Date ou String

  @IsString()
  @IsOptional()
  birthCountry?: string; // ✅ Nouveau

  @IsString()
  @IsOptional()
  birthCity?: string;    // ✅ Nouveau

  @IsString()
  @IsOptional()
  birthPlace?: string;   // (Garder pour compatibilité)
}