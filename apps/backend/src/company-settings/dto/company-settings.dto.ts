// apps/backend/src/company-settings/dto/company-settings.dto.ts
import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';

/**
 * Modification partielle des paramètres. Le contenu de chaque section est validé finement (messages en français)
 * par company-settings.logic.ts::applyPatch : ici on s'assure seulement qu'il s'agit d'objets.
 */
export class UpdateCompanySettingsDto {
  @IsOptional() @IsObject()
  fees?: Record<string, unknown>;

  @IsOptional() @IsObject()
  commissions?: Record<string, unknown>;

  @IsOptional() @IsObject()
  pickup?: Record<string, unknown>;

  @IsOptional() @IsObject()
  alerts?: Record<string, unknown>;

  @IsOptional() @IsObject()
  recharge?: Record<string, unknown>;
}

export class SettingsQueryDto {
  /** Super admin : société à consulter. Ignoré pour un admin de société. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  clientId?: number;
}

export class SettingsHistoryQueryDto extends SettingsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 20;
}
