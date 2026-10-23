// apps/backend/src/transactions/dto/create-transaction.dto.ts
// ✅ v1.2 (audit point 11) : montants bornés — @Max(MAX_AMOUNT) et au plus 4 décimales (précision Decimal(18,4) des
//   colonnes). Avant, 0,0001 et 1e12 passaient la validation. Les montants des devises sans décimales (XOF, GNF) sont
//   de toute façon arrondis plus loin ; ce contrôle écarte les valeurs absurdes dès l'entrée.
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
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PayoutMethod } from '@prisma/client';

/** Plafond technique d'un montant unitaire (les plafonds métier par niveau KYC se règlent dans TransferLimits). */
export const MAX_AMOUNT = 1_000_000_000;

export class CreateTransactionDto {
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  @Min(0.01)
  @Max(MAX_AMOUNT)
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

  // ✅ v1.2 (audit point 3) — clé d'idempotence en alternative à l'en-tête Idempotency-Key (l'en-tête est prioritaire).
  // Utile aux clients dont la couche réseau ne permet pas d'ajouter un en-tête par appel. Même format que l'en-tête.
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_\-:.]{8,128}$/, { message: 'idempotencyKey invalide : 8 à 128 caractères (lettres, chiffres, - _ : .).' })
  idempotencyKey?: string;
}

export class CreateDepositDto {
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  @Min(0.01)
  @Max(MAX_AMOUNT)
  amount: number;

  @IsString()
  @IsNotEmpty()
  userPhone: string;

  // ✅ v1.2 (audit point 3) — clé d'idempotence en alternative à l'en-tête Idempotency-Key (l'en-tête est prioritaire).
  // Utile aux clients dont la couche réseau ne permet pas d'ajouter un en-tête par appel. Même format que l'en-tête.
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_\-:.]{8,128}$/, { message: 'idempotencyKey invalide : 8 à 128 caractères (lettres, chiffres, - _ : .).' })
  idempotencyKey?: string;
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