//apps/backend/src/payments/dto/initiate-payment.dto.ts
import { IsEnum, IsString } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class InitiatePaymentDto {
  @IsString()
  transactionId: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
