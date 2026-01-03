// src/beneficiaries/dto/create-beneficiary.dto.ts
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBeneficiaryDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  country!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsOptional()
  phone?: string;
}
