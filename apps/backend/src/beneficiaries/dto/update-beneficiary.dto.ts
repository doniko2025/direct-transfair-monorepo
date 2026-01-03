//apps/backend/src/beneficiaries/dto/update-beneficiary.dto.ts
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateBeneficiaryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  country?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  city?: string;

  // autorise null pour "effacer" le téléphone
  @IsOptional()
  @IsString()
  phone?: string | null;
}
