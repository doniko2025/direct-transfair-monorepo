// apps/backend/src/transactions/dto/create-transaction.dto.ts
// ✅ v1.1 : FIX — note (motif du transfert) manquant
//
//   PROBLÈME RÉSOLU (juillet 2026) :
//   send.tsx envoie note: motif depuis la v2.4, et Transaction.note
//   existe dans schema.prisma depuis le début — mais ce DTO ne
//   déclarait pas ce champ. Le ValidationPipe global (whitelist:true,
//   main.ts) supprime silencieusement toute propriété non déclarée
//   AVANT que le controller/service ne la voie : dto.note valait donc
//   toujours undefined dans TransactionsService.create(), quelle que
//   soit la correction apportée côté service (v4.19). Les deux bouts
//   (service + DTO) devaient être corrigés ensemble.
//
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

  // ✅ v1.1 — FIX : motif du transfert (voir changelog en tête de fichier)
  @IsOptional()
  @IsString()
  note?: string;
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