// apps/backend/src/transactions/dto/create-transaction.dto.ts
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
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

  // ✅ FIX : @IsOptional() ajouté
  // AVANT : @IsNotEmpty() → rejetait undefined → "beneficiaryId should not be empty"
  //         quand wallet-transfer.tsx envoyait sans beneficiaryId
  // MAINTENANT : optionnel — le service gère le cas null (no beneficiary = pas de
  //              conversion de devise, lookup par phone directement)
  @IsOptional()
  @IsString()
  beneficiaryId?: string;

  @IsOptional()
  @IsString()
  senderFirstName?: string;

  @IsOptional()
  @IsString()
  senderLastName?: string;

  @IsOptional()
  @IsString()
  senderPhone?: string;
}

export class CreateDepositDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @IsNotEmpty()
  userPhone: string;
}

// ✅ DTOs TRÉSORERIE
export class FundSelfDto {
  @IsNumber()
  @IsPositive()
  amount: number;
}

export class RefillAgencyDto {
  @IsString()
  @IsNotEmpty()
  agencyId: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}

export class DeclareB2BDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @IsNotEmpty()
  ref: string;
}