// apps/backend/src/payments/dto/initiate-payment.dto.ts
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class InitiatePaymentDto {
  @IsString()
  @IsNotEmpty()
  transactionId!: string;

  // Nouveau nom (canonique)
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  // Ancien nom (compat)
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  // Dev/test: OrangeMoney mock (true=success, false=failure). Ignoré pour les autres méthodes.
  @IsOptional()
  @IsBoolean()
  simulateSuccess?: boolean;
}
