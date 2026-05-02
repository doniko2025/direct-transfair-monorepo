// apps/backend/src/agencies/dto/create-agency.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAgencyDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  city!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  address!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  /**
   * ✅ Code ISO alpha-2 (FR, GN, GB, SN…)
   * → détermine automatiquement primaryCurrency
   */
  @ApiPropertyOptional({ description: 'ISO alpha-2 : FR, GN, GB, SN…' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminFirstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminLastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminPassword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerName?: string;

  // Champs tolérés (envoyés par certains fronts)
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  subscriptionType?: string;

  // ✅ Conservé pour rétrocompatibilité frontend
  // Si envoyé, sera ignoré — on utilise country à la place
  @IsOptional()
  @IsString()
  currency?: string;
}