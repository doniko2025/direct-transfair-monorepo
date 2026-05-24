// apps/backend/src/agencies/dto/update-agency.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateAgencyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerName?: string;

  /** ✅ Si changé, recalcule primaryCurrency */
  @ApiPropertyOptional({ description: 'ISO alpha-2 : FR, GN, GB…' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'SUBSIDIARY | PARTNER' })
  @IsOptional()
  @IsString()
  type?: string;
}