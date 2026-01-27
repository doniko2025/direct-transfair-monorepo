// apps/backend/src/withdrawals/dto/create-withdrawal.dto.ts
import { IsOptional, IsString, IsNumber, IsPositive, IsEnum } from 'class-validator';
import { PayoutMethod } from '@prisma/client';

export class CreateWithdrawalDto {
  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsEnum(PayoutMethod)
  method?: PayoutMethod;
}