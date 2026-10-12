// apps/backend/src/supervision/dto/supervision.dto.ts
// =========================================================
// SUPERVISION — DTOs de requête
//   Le ValidationPipe global a `transform: true` sans conversion implicite :
//   les nombres et booléens venant de la query string sont donc convertis ici.
// =========================================================

import { AlertSeverity, AuditAction } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const AUDIT_ACTIONS = Object.values(AuditAction);
const SEVERITIES = Object.values(AlertSeverity);

/** "true" / "false" (query string) → booléen ; toute autre valeur est rejetée par @IsBoolean. */
const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' || value === true ? true : value === 'false' || value === false ? false : value;

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 30;
}

export class ListAuditLogsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(AUDIT_ACTIONS)
  action?: AuditAction;

  /** true = actions réussies, false = échecs uniquement. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  successful?: boolean;

  /** Réservé au super admin : filtrer sur une société. Ignoré pour un admin de société. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clientId?: number;
}

export class ListAlertsQueryDto extends PageQueryDto {
  /** open (défaut) | resolved | all */
  @IsOptional()
  @IsIn(['open', 'resolved', 'all'])
  status: 'open' | 'resolved' | 'all' = 'open';

  @IsOptional()
  @IsIn(SEVERITIES)
  severity?: AlertSeverity;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clientId?: number;
}
