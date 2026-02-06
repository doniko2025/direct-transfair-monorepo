//apps/backend/src/commissions/dto/update-commission.dto.ts
import { IsEnum, IsNumber, Min, Max } from 'class-validator';
import { CommissionSourceType, CommissionDestType } from '@prisma/client';

export class UpdateCommissionDto {
  @IsEnum(CommissionSourceType)
  sourceType: CommissionSourceType;

  @IsEnum(CommissionDestType)
  destType: CommissionDestType;

  @IsNumber()
  @Min(0)
  @Max(100)
  senderShare: number; // Part de l'agence qui envoie (en %)

  @IsNumber()
  @Min(0)
  @Max(100)
  payerShare: number; // Part de l'agence qui paie (en %)
}