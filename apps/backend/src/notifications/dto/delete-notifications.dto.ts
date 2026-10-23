// apps/backend/src/notifications/dto/delete-notifications.dto.ts
// Corps de POST /notifications/delete : soit une sélection (ids), soit tout (all: true).
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class DeleteNotificationsDto {
  /** Identifiants à supprimer (sélection partielle). 200 au plus par appel. */
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  ids?: string[];

  /** true : supprime toutes les notifications de l'utilisateur connecté. */
  @IsOptional()
  @IsBoolean()
  all?: boolean;
}
