// src/beneficiaries/dto/create-beneficiary.dto.ts
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBeneficiaryDto {
  @ApiProperty({ example: 'Alpha Barry', description: 'Nom complet du bénéficiaire' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: 'Sénégal', description: 'Pays de résidence' })
  @IsString()
  @IsNotEmpty()
  country!: string;

  @ApiProperty({ example: 'Dakar', description: 'Ville de résidence' })
  @IsString()
  @IsNotEmpty()
  city!: string;

  @ApiPropertyOptional({ example: '+221770000000', description: 'Téléphone (format international)' })
  @IsString()
  @IsOptional()
  phone?: string;
}