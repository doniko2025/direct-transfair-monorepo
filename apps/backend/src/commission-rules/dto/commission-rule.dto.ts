// apps/backend/src/commission-rules/dto/commission-rule.dto.ts
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class SetSplitDto {
  /** Part de l'agence d'envoi, en % des frais. */
  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0) @Max(100)
  senderShare!: number;

  /** Part de l'agence qui paie le cash, en % des frais. */
  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0) @Max(100)
  payerShare!: number;
}

export class SplitQueryDto {
  /** Super admin : société à consulter. Ignoré pour un admin de société. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  clientId?: number;
}

export class SplitHistoryQueryDto extends SplitQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 20;
}
