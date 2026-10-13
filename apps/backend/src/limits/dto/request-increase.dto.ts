// apps/backend/src/limits/dto/request-increase.dto.ts
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RequestIncreaseDto {
  @IsString() @IsNotEmpty() @MaxLength(500)
  reason!: string;
}
