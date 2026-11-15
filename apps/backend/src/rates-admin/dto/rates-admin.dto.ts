// apps/backend/src/rates-admin/dto/rates-admin.dto.ts
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsPositive, Max, Min } from 'class-validator';

import { MAX_RATE } from '../rate-rules';

export class SetRateDto {
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(MAX_RATE)
  rate!: number;

  /** À vrai pour confirmer une variation supérieure au seuil (voir LARGE_CHANGE_PERCENT). */
  @IsOptional()
  @IsBoolean()
  confirmLargeChange?: boolean;
}

/** Société consultée — utilisé par le SUPER ADMIN (lecture seule) ; ignoré pour un administrateur de société (toujours SA société). */
export class RatesScopeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clientId?: number;
}

export class RateHistoryQueryDto extends RatesScopeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}
