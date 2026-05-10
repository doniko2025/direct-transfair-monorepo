// apps/backend/src/treasury/dto/treasury.dto.ts
// =========================================================
// TREASURY DTOs v1.3 — FIX @Transform sur currency (uppercase)
// ✅ Transformation automatique string → number pour amount
// ✅ Transformation automatique string → UPPERCASE pour currency
// ✅ Fonctionne que le montant vienne de @Body() ou @Query()
// =========================================================

import {
  IsString,
  IsNumber,
  IsOptional,
  IsObject,
  IsPositive,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

const SUPPORTED_CURRENCIES = ['XOF', 'EUR', 'USD', 'GNF', 'GBP'];

// =========================================================
// INJECT FUNDS — Auto-alimentation simple devise
// POST /treasury/admin/inject
// Body: { currency: "XOF", amount: 250000 }
// =========================================================

export class InjectFundsDto {
  @Transform(({ value }) => String(value).toUpperCase().trim())
  @IsString()
  @IsIn(SUPPORTED_CURRENCIES)
  currency: string;

  @Transform(({ value }) => Number(value))
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}

// =========================================================
// INJECT ALL — Auto-alimentation multi-devises
// POST /treasury/admin/inject-all
// Body: { amounts: { EUR: 1000, XOF: 500000 }, reason?: "..." }
// =========================================================

export class InjectAllDto {
  @IsObject()
  amounts: Record<string, number>;

  @IsOptional()
  @IsString()
  reason?: string;
}

// =========================================================
// WITHDRAW FUNDS
// POST /treasury/admin/withdraw
// Body: { currency: "EUR", amount: 500 }
// =========================================================

export class WithdrawFundsDto {
  @Transform(({ value }) => String(value).toUpperCase().trim())
  @IsString()
  @IsIn(SUPPORTED_CURRENCIES)
  currency: string;

  @Transform(({ value }) => Number(value))
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

// =========================================================
// SELF-FUND — Alias rétrocompatibilité
// =========================================================

export class SelfFundDto {
  @Transform(({ value }) => String(value).toUpperCase().trim())
  @IsString()
  @IsIn(SUPPORTED_CURRENCIES)
  currency: string;

  @Transform(({ value }) => Number(value))
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}

// =========================================================
// TRANSFER BETWEEN WALLETS
// POST /treasury/transfer
// =========================================================

export class TransferBetweenWalletsDto {
  @IsString()
  fromWalletId: string;

  @IsString()
  toWalletId: string;

  @Transform(({ value }) => Number(value))
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;
}

// =========================================================
// GET OVERVIEW QUERY PARAMS
// =========================================================

export class GetOverviewQueryDto {
  @IsOptional()
  @Transform(({ value }) => String(value).toUpperCase().trim())
  @IsIn(SUPPORTED_CURRENCIES)
  currency?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

// =========================================================
// GET SNAPSHOTS QUERY PARAMS
// =========================================================

export class GetSnapshotsQueryDto {
  @IsOptional()
  @Transform(({ value }) => String(value).toUpperCase().trim())
  @IsIn(SUPPORTED_CURRENCIES)
  currency?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}