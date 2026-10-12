// apps/backend/src/fees-admin/dto/fees-admin.dto.ts
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

import { MAX_FEE_RATE, MAX_FIXED_FEE } from '../fee-rules';

export class SetFeeDto {
  /** Pourcentage prélevé sur le montant envoyé (1,5 = 1,5 %). */
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_FEE_RATE)
  feeRate!: number;

  /** Frais fixe ajouté, dans la devise de l'envoi. */
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_FIXED_FEE)
  fixedFee!: number;
}

export class FeeHistoryQueryDto {
  /** Super admin : filtre sur une société. Ignoré pour un admin de société (toujours la sienne). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clientId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 30;
}
