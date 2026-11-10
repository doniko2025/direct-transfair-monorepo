// apps/backend/src/notifications/notifications.controller.ts
// =========================================================
// NOTIFICATIONS CONTROLLER v4.3 — Direct Transf'air
// ✅ v4.4 : comptes séparés — ?space=client|merchant sur la liste, le compteur et « tout lu » ; `space` dans le corps de la suppression.
// ✅ v4.3 : POST /notifications/delete { ids?: string[], all?: boolean } → { deleted } (suppression partielle ou totale,
//   limitée aux notifications de l'utilisateur connecté).
// ✅ v4.2 : GET /notifications accepte ?limit (1-100) et ?unreadOnly=true ;
//   nouvelle route GET /notifications/unread-count → { count } (pastille du menu web).
// ✅ v4.1 : FIX ordre des routes PATCH
//   PATCH 'read-all' doit être DÉCLARÉ AVANT PATCH ':id/read'
//   Sinon NestJS capture "read-all" comme id et ne trouve
//   jamais la route exacte → updateMany ne tourne jamais
// =========================================================

import { BadRequestException, Body, Controller, Get, HttpCode, Patch, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ListNotificationsQueryDto } from './dto/list-notifications.dto';
import { DeleteNotificationsDto } from './dto/delete-notifications.dto';
import { parseNotificationSpace } from './notification-space';
import { langFromRequest } from '../i18n/lang';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // Récupère les notifications de l'utilisateur connecté (les siennes uniquement)
  @Get()
  async getMyNotifications(@Req() req, @Query() query: ListNotificationsQueryDto) {
    return this.notificationsService.findAll(req.user.id, {
      limit: query.limit,
      unreadOnly: query.unreadOnly,
      space: parseNotificationSpace(query.space),
      lang: langFromRequest(req),   // ✅ langues FR / EN / PT (en-tête x-app-lang)
    });
  }

  // Route exacte, sans conflit avec les routes dynamiques ci-dessous
  @Get('unread-count')
  async unreadCount(@Req() req, @Query('space') space?: string) {
    return this.notificationsService.unreadCount(req.user.id, parseNotificationSpace(space));
  }

  // ✅ FIX v4.1 : route EXACTE déclarée AVANT la route dynamique
  // Avant : @Patch(':id/read') en premier → "read-all" capté comme id
  // Maintenant : NestJS match "read-all" avant de tomber sur ":id"
  @Patch('read-all')
  async markAllAsRead(@Req() req, @Query('space') space?: string) {
    return this.notificationsService.markAllAsRead(req.user.id, parseNotificationSpace(space));
  }

  // Suppression : une sélection (ids) ou tout (all: true). Route exacte, sans conflit avec ':id'.
  @Post('delete')
  @HttpCode(200)
  async deleteNotifications(@Req() req, @Body() body: DeleteNotificationsDto) {
    if (!body.all && !body.ids?.length) {
      throw new BadRequestException('Indiquez les notifications à supprimer (ids) ou all: true.');
    }
    return this.notificationsService.deleteMany(req.user.id, { ids: body.ids, all: body.all === true, space: parseNotificationSpace(body.space) });
  }

  // Route dynamique toujours APRÈS la route exacte
  @Patch(':id/read')
  async markAsRead(@Req() req, @Param('id') id: string) {
    return this.notificationsService.markAsRead(id, req.user.id);
  }
}
