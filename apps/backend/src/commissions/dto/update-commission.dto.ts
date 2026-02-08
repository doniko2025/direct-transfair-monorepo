// apps/backend/src/commissions/dto/update-commission.dto.ts
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
  senderShare: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  payerShare: number;
}
