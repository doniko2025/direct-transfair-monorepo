//apps/backend/src/beneficiaries/dto/update-beneficiary.dto.ts
import { IsOptional, IsString, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBeneficiaryDto {
  @ApiPropertyOptional({ example: 'Alpha Barry' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @ApiPropertyOptional({ example: 'Sénégal' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  country?: string;

  @ApiPropertyOptional({ example: 'Dakar' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  city?: string;

  @ApiPropertyOptional({ example: '+221770000000' })
  @IsOptional()
  @IsString()
  phone?: string | null;
}