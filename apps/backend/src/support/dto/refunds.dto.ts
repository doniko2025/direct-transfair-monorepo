// apps/backend/src/support/dto/refunds.dto.ts
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateRefundRequestDto {
  @IsString()
  @MaxLength(40)
  transactionId!: string;

  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Indiquez le motif du remboursement (5 caractères minimum).' })
  @MaxLength(500)
  reason!: string;

  /** Litige à l'origine de la demande (optionnel). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  ticketId?: string;
}

export class DecideRefundDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}
