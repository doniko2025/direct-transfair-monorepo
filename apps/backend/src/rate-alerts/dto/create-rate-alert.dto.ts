// apps/backend/src/rate-alerts/dto/create-rate-alert.dto.ts
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength } from 'class-validator';

/** Canaux disponibles pour une alerte (valeurs de l'enum CommsType utilisées ici). */
export const ALERT_CHANNELS = ['PUSH', 'EMAIL', 'SMS'] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

export class CreateRateAlertDto {
  /** Ex : « EUR_GNF » (« EUR/GNF » est accepté). */
  @IsString()
  @MaxLength(12)
  pair!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsIn(['ABOVE', 'BELOW'])
  direction!: 'ABOVE' | 'BELOW';

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(1_000_000_000)
  threshold!: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(ALERT_CHANNELS.length)
  @Transform(({ value }) => (Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v)) : value))
  @IsIn([...ALERT_CHANNELS], { each: true })
  notifiedVia?: AlertChannel[];
}
