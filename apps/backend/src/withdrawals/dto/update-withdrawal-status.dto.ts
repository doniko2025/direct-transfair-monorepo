//apps/backend/src/withdrawals/dto/update-withdrawal-status.dto.ts
import { IsEnum } from 'class-validator';
import { WithdrawalStatus } from '@prisma/client';

export class UpdateWithdrawalStatusDto {
  @IsEnum(WithdrawalStatus)
  status!: WithdrawalStatus;
}
