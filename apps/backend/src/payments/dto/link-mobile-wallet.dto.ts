//apps/backend/src/payments/dto/link-mobile-wallet.dto.ts
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class LinkMobileWalletDto {
  @IsEnum(PaymentMethod)
  provider!: PaymentMethod;

  /** null ou absent = délier */
  @IsOptional()
  @IsString()
  number?: string | null;
}