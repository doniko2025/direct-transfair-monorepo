// apps/backend/src/commissions/dto/update-commission.dto.ts
import {
  IsEnum, IsNumber, IsOptional, IsString,
  Min, Max,
} from 'class-validator';
import { CommissionSourceType, CommissionDestType } from '@prisma/client';

export class UpdateCommissionDto {
  @IsEnum(CommissionSourceType)
  sourceType: CommissionSourceType;

  @IsEnum(CommissionDestType)
  destType: CommissionDestType;

  @IsNumber() @Min(0) @Max(100)
  senderShare: number;

  @IsNumber() @Min(0) @Max(100)
  payerShare: number;

  // ── Champs fee config (optionnels) ────────────────────
  // Présents uniquement quand sourceType = WALLET (fee par méthode)

  @IsOptional() @IsString()
  payoutMethod?: string;  // "CASH_PICKUP" | "BANK_DEPOSIT" | "MOBILE_MONEY" | "IBAN_TRANSFER"

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  feeRate?: number;  // Taux réel prélevé sur l'expéditeur, ex: 1.5 (= 1.5%)

  @IsOptional() @IsNumber() @Min(0)
  fixedFee?: number;  // Frais fixe en devise locale, ex: 200 (= 200 XOF)
}