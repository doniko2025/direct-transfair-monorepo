// apps/backend/src/notifications/dto/list-notifications.dto.ts
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListNotificationsQueryDto {
  /** Nombre de notifications renvoyées, les plus récentes d'abord. 50 par défaut, comme avant. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;

  /** « true » : uniquement les notifications non lues. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unreadOnly?: boolean;
}
