//apps/backend/src/notifications/notifications.service.ts
// ✅ v1.1 : les notifications expirées (expiresAt) ne sont plus renvoyées, la date de lecture (readAt)
//   est enregistrée, la liste accepte limit / unreadOnly et le nombre de non lues est disponible.
//   Sans paramètre, GET /notifications renvoie toujours les 50 dernières (application mobile inchangée).
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Créer une notification brute
  async create(userId: string, title: string, message: string, type: NotificationType = 'INFO', metadata?: any) {
    return this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      },
    });
  }

  /** Une notification dont la date d'expiration est passée n'a plus lieu d'être affichée. */
  private alive() {
    return { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };
  }

  // Récupérer les notifs d'un user
  async findAll(userId: string, opts: { limit?: number; unreadOnly?: boolean } = {}) {
    return this.prisma.notification.findMany({
      where: { userId, ...(opts.unreadOnly ? { isRead: false } : {}), ...this.alive() },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: opts.limit ?? 50, // 50 par défaut pour la perf
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false, ...this.alive() },
    });
    return { count };
  }

  // Marquer comme lue
  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // Tout marquer comme lu
  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}
