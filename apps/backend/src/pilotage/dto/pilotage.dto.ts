// apps/backend/src/pilotage/dto/pilotage.dto.ts
// Corps de requête du pilotage. Les montants arrivent en nombre ou en chaîne : ils sont validés plus finement par pilotage.rules.ts.

import { CurrencyCode } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CloseCashDto {
  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;

  /** Espèces comptées (nombre ou texte « 12 500,50 »). */
  @IsNotEmpty()
  countedAmount!: number | string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  /** Décalage du fuseau de l'appareil en minutes en plus de l'UTC (Paris hiver : 60). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-840)
  @Max(840)
  tzOffsetMin?: number;
}

export class ReviewClosingDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class UpsertLiquidityRuleDto {
  /** Absent ou null = toutes les agences de la société. */
  @IsOptional()
  @IsString()
  agencyId?: string | null;

  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;

  @IsNotEmpty()
  minBalance!: number | string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertTargetDto {
  /** Mois « AAAA-MM ». */
  @IsString()
  month!: string;

  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;

  @IsOptional()
  targetAmount?: number | string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  targetOperations?: number;
}
