// apps/backend/src/transfer-limits/dto/transfer-limit.dto.ts
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, Max, Min, ValidateIf } from 'class-validator';

export const MAX_LIMIT = 1_000_000_000_000;

/** Les quatre champs sont obligatoires ; null = pas de plafond sur cette période. */
export class SetLimitsDto {
  @ValidateIf((o: SetLimitsDto) => o.perTransaction !== null)
  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0) @Max(MAX_LIMIT)
  perTransaction!: number | null;

  @ValidateIf((o: SetLimitsDto) => o.daily !== null)
  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0) @Max(MAX_LIMIT)
  daily!: number | null;

  @ValidateIf((o: SetLimitsDto) => o.monthly !== null)
  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0) @Max(MAX_LIMIT)
  monthly!: number | null;

  @ValidateIf((o: SetLimitsDto) => o.yearly !== null)
  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0) @Max(MAX_LIMIT)
  yearly!: number | null;
}

export class SetKycLevelDto {
  @IsIn(['LEVEL_0', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3'])
  kycLevel!: 'LEVEL_0' | 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
}

export class LimitsQueryDto {
  /** Super admin : société à consulter. Ignoré pour un admin de société. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  clientId?: number;
}

export class LimitsHistoryQueryDto extends LimitsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 20;
}
