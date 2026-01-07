// src/auth/dto/register.dto.ts
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsEnum, // ✅ Ajout
} from 'class-validator';
import { Role } from '@prisma/client'; // ✅ Import Prisma

export class RegisterDto {
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

  // ✅ 🔹 Rôle (optionnel, par défaut USER)
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  // 🔹 Contact
  @IsString()
  @IsOptional()
  phone?: string;

  // 🔹 Adresse (Mise à jour SaaS)
  @IsString()
  @IsOptional()
  addressStreet?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  country?: string;

  // 🔹 Infos KYC
  @IsString()
  @IsOptional()
  nationality?: string;

  @IsString()
  @IsOptional()
  birthDate?: string;

  @IsString()
  @IsOptional()
  birthPlace?: string;
}