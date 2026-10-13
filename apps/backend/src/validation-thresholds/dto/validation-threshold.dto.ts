// apps/backend/src/validation-thresholds/dto/validation-threshold.dto.ts
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

/** Plafond de saisie : le champ SQL est un DECIMAL(18,4), on reste très en dessous. */
export const MAX_THRESHOLD = 1_000_000_000_000;

export class SetThresholdDto {
  /** Montant (dans la devise de l'URL) au-dessus duquel un envoi cash attend la validation d'un administrateur. 0 = tout valider à la main. */
  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0) @Max(MAX_THRESHOLD)
  amount!: number;
}

export class ThresholdQueryDto {
  /** Super admin : société à consulter. Ignoré pour un admin de société. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  clientId?: number;
}

export class ThresholdHistoryQueryDto extends ThresholdQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 20;
}
