// src/auth/dto/register.dto.ts
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export type UserRole = 'USER' | 'ADMIN';

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

  // 🔹 Contact
  @IsString()
  @IsOptional()
  phone?: string;

  // 🔹 Adresse
  @IsString()
  @IsOptional()
  addressNumber?: string; // N° de rue

  @IsString()
  @IsOptional()
  addressStreet?: string; // Libellé de rue

  @IsString()
  @IsOptional()
  postalCode?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  country?: string; // Pays de résidence

  // 🔹 Infos KYC
  @IsString()
  @IsOptional()
  nationality?: string;

  @IsString()
  @IsOptional()
  birthDate?: string; // JJ/MM/AAAA (on garde en string pour l’instant)

  @IsString()
  @IsOptional()
  birthPlace?: string; // Lieu de naissance
}
