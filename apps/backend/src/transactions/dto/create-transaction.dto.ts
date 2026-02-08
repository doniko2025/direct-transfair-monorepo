// src/transactions/dto/create-transaction.dto.ts
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

  @IsString()
  @IsNotEmpty()
  beneficiaryId: string;

  // ✅ AJOUTS : Infos de l'expéditeur réel (Client invité)
  // Optionnels car les utilisateurs de l'app mobile (Clients) ne les envoient pas
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