//apps/backend/src/agencies/dto/update-agency.dto.ts
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateAgencyDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsEmail()
  @IsOptional()
  email?: string; // Si modifié, mettra à jour le login agent

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  code?: string;
  
  @IsString()
  @IsOptional()
  managerName?: string;
}