// apps/backend/src/withdrawals/dto/create-withdrawal.dto.ts
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { PayoutMethod } from '@prisma/client';

export class CreateWithdrawalDto {
  @IsString()
  @IsNotEmpty()
  transactionId!: string; // ✅ Transaction.id est string

  @IsEnum(PayoutMethod)
  method!: PayoutMethod; // ✅ champ requis dans Prisma Withdrawal.method
}
