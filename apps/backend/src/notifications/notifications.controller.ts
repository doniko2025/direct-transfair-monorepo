// apps/backend/src/notifications/notifications.controller.ts
// =========================================================
// NOTIFICATIONS CONTROLLER v4.1 — Direct Transf'air
// ✅ v4.1 : FIX ordre des routes PATCH
//   PATCH 'read-all' doit être DÉCLARÉ AVANT PATCH ':id/read'
//   Sinon NestJS capture "read-all" comme id et ne trouve
//   jamais la route exacte → updateMany ne tourne jamais
// =========================================================

import { Controller, Get, Patch, Param, Req, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // Récupère toutes les notifications de l'utilisateur connecté
  @Get()
  async getMyNotifications(@Req() req) {
    return this.notificationsService.findAll(req.user.id);
  }

  // ✅ FIX v4.1 : route EXACTE déclarée AVANT la route dynamique
  // Avant : @Patch(':id/read') en premier → "read-all" capté comme id
  // Maintenant : NestJS match "read-all" avant de tomber sur ":id"
  @Patch('read-all')
  async markAllAsRead(@Req() req) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  // Route dynamique toujours APRÈS la route exacte
  @Patch(':id/read')
  async markAsRead(@Req() req, @Param('id') id: string) {
    return this.notificationsService.markAsRead(id, req.user.id);
  }
}