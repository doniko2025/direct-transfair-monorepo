//apps/backend/src/agencies/dto/create-agency.dto.ts
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAgencyDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  city: string;

  @IsNotEmpty()
  @IsString()
  address: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsNotEmpty()
  @IsEmail()
  email: string; // Email de l'agent guichetier

  @IsOptional()
  @IsString()
  adminPassword?: string; // Mot de passe de l'agent (facultatif)

  @IsOptional()
  @IsString()
  managerName?: string; // Nom complet du gérant pour créer l'agent

  @IsOptional()
  @IsString()
  adminFirstName?: string;

  @IsOptional()
  @IsString()
  adminLastName?: string;
}