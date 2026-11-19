import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateWebhookDto {
  @IsString() @MaxLength(500)
  url!: string;

  /** Vide = tous les événements. */
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true })
  events?: string[];

  @IsOptional() @IsString() @MaxLength(120)
  description?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(8)
  maxRetries?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1000) @Max(3_600_000)
  retryDelayMs?: number;
}

export class UpdateWebhookDto {
  @IsOptional() @IsString() @MaxLength(500)
  url?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true })
  events?: string[];

  @IsOptional() @IsString() @MaxLength(120)
  description?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(8)
  maxRetries?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1000) @Max(3_600_000)
  retryDelayMs?: number;
}
