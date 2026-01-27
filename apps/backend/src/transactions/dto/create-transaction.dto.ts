// src/transactions/dto/create-transaction.dto.ts
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
} from 'class-validator';
import { PayoutMethod } from '@prisma/client';

export class CreateTransactionDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string; // ex: "EUR", "XOF"

  @IsEnum(PayoutMethod)
  payoutMethod: PayoutMethod;

  @IsString()
  @IsNotEmpty()
  beneficiaryId: string;
}

// ✅ NOUVEAU : DTO pour le Dépôt
export class CreateDepositDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @IsNotEmpty()
  userPhone: string; // Le téléphone du client à recharger
}