//apps/backend/src/withdrawals/dto/update-withdrawal-status.dto.ts
import { IsEnum, IsNotEmpty } from 'class-validator';
import { WithdrawalStatus } from '@prisma/client'; // ✅ Import Prisma

export class UpdateWithdrawalStatusDto {
  @IsNotEmpty()
  @IsEnum(WithdrawalStatus, {
    message: `status must be one of: ${Object.values(WithdrawalStatus).join(', ')}`,
  })
  status: WithdrawalStatus;
}