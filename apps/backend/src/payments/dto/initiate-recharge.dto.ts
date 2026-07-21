// apps/backend/src/payments/dto/initiate-recharge.dto.ts
// ✅ v1.1 — Ajout de RechargeByMobileMoneyDto (numéro à débiter,
// obligatoire pour Orange Money — voir recharge.service.ts)
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
} from 'class-validator';
import { CurrencyCode } from '@prisma/client';

export class InitiateRechargeDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(CurrencyCode)
  currency: CurrencyCode;

  // Dev/test uniquement — même logique que InitiatePaymentDto.simulateSuccess
  @IsOptional()
  @IsBoolean()
  simulateSuccess?: boolean;
}

export class RechargeByCardDto extends InitiateRechargeDto {
  @IsString()
  @IsNotEmpty()
  cardholderName: string;

  @IsString()
  @Matches(/^\d{13,19}$/, { message: 'Numéro de carte invalide (13–19 chiffres)' })
  cardNumber: string;

  @IsString()
  @Matches(/^(0[1-9]|1[0-2])\/\d{2}$/, { message: 'Format MM/AA attendu' })
  expiry: string;

  // ⚠️ CVV volontairement absent — jamais transmis au backend
  // (cf. payment-methods.tsx v6.2 / PCI-DSS : le CVV ne doit jamais
  // être persisté après autorisation).
}

// ✅ v1.1 (nouveau) — Mobile Money (Orange Money) : le numéro à
// débiter est obligatoire pour identifier le compte opérateur, même
// en mock (sera indispensable à la vraie intégration).
export class RechargeByMobileMoneyDto extends InitiateRechargeDto {
  @IsString()
  @IsNotEmpty()
  momoPhone: string;
}