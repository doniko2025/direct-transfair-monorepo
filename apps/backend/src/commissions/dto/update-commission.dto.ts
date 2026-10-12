// apps/backend/src/commissions/dto/update-commission.dto.ts
// ✅ v1.1 : payoutMethod limité aux modes connus, taux de frais plafonné à 25 % et frais fixe plafonné
//   (avant : n'importe quelle chaîne créait une ligne parasite, un taux de 100 % ou un frais fixe de
//   plusieurs milliards étaient acceptés).
import {
  IsEnum, IsIn, IsNumber, IsOptional, IsString,
  Min, Max,
} from 'class-validator';
import { CommissionSourceType, CommissionDestType } from '@prisma/client';
import { FEE_METHOD_KEYS, MAX_FEE_RATE, MAX_FIXED_FEE } from '../../fees-admin/fee-rules';

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

  @IsOptional() @IsString() @IsIn([...FEE_METHOD_KEYS])
  payoutMethod?: string;  // "CASH_PICKUP" | "BANK_DEPOSIT" | "MOBILE_MONEY" | "IBAN_TRANSFER"

  @IsOptional() @IsNumber() @Min(0) @Max(MAX_FEE_RATE)
  feeRate?: number;  // Taux réel prélevé sur l'expéditeur, ex: 1.5 (= 1.5%)

  @IsOptional() @IsNumber() @Min(0) @Max(MAX_FIXED_FEE)
  fixedFee?: number;  // Frais fixe en devise locale, ex: 200 (= 200 XOF)
}