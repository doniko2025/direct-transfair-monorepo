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

export class RateHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}
