// apps/backend/src/agent-desk/dto/agent-desk.dto.ts
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class DeskQueryDto {
  /** Début de « aujourd'hui » chez l'agent (ISO). Au plus 36 h en arrière ; sinon minuit UTC. */
  @IsOptional() @IsDateString()
  since?: string;
}

export class LookupClientQueryDto {
  @IsString() @MinLength(6) @MaxLength(25)
  phone!: string;
}

export class SendPreviewQueryDto {
  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0.01) @Max(1_000_000_000_000)
  amount!: number;

  /** Pays de réception : code ISO (« GN ») ou nom (« Guinée »). */
  @IsString() @MinLength(2) @MaxLength(60)
  receiveCountry!: string;
}
