//apps/backend/src/payments/dto/link-mobile-wallet.dto.ts
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class LinkMobileWalletDto {
  @IsEnum(PaymentMethod)
  provider!: PaymentMethod;

  /** null ou absent = délier */
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 ().-]{6,25}$/, { message: 'Numéro de téléphone invalide' })
  number?: string | null;
}