//apps/backend/src/notifications/notifications.service.ts
// ✅ v1.3 : comptes séparés — liste, compteur, « tout lu » et suppression acceptent `space` (client | merchant) ; sans valeur : tout, comme avant.
// ✅ v1.2 : deleteMany(userId, {ids|all}) — suppression d'une sélection ou de toutes les notifications de l'utilisateur (jamais celles d'un autre).
// ✅ v1.1 : les notifications expirées (expiresAt) ne sont plus renvoyées, la date de lecture (readAt)
//   est enregistrée, la liste accepte limit / unreadOnly et le nombre de non lues est disponible.
//   Sans paramètre, GET /notifications renvoie toujours les 50 dernières (application mobile inchangée).
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import type { NotificationSpace } from './notification-space';
import type { Lang } from '../i18n/lang';
import { translatePhrase } from '../i18n/phrase-book';
import '../i18n/phrases';

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
  async findAll(userId: string, opts: { limit?: number; unreadOnly?: boolean; space?: NotificationSpace; lang?: Lang | null } = {}) {
    const rows = await this.prisma.notification.findMany({
      where: { userId, ...(opts.space ? { space: opts.space } : {}), ...(opts.unreadOnly ? { isRead: false } : {}), ...this.alive() },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: opts.limit ?? 50, // 50 par défaut pour la perf
    });
    // ✅ langues FR / EN / PT : la base garde le texte français ; il est traduit à la lecture d'après la langue de l'application
    // (changer de langue retraduit donc aussi les anciennes notifications). Sans langue demandée : français, comme avant.
    const lang = opts.lang;
    if (!lang || lang === 'fr') return rows;
    return rows.map((n) => ({ ...n, title: translatePhrase(n.title, lang), message: translatePhrase(n.message, lang) }));
  }

  /** `count` = non lues du compte demandé (ou de tous si aucun) ; `bySpace` = détail, pour signaler l'autre compte sur le sélecteur. */
  async unreadCount(userId: string, space?: NotificationSpace) {
    const base = { userId, isRead: false, ...this.alive() };
    const [client, merchant] = await Promise.all([
      this.prisma.notification.count({ where: { ...base, space: 'client' } }),
      this.prisma.notification.count({ where: { ...base, space: 'merchant' } }),
    ]);
    const count = space === 'client' ? client : space === 'merchant' ? merchant : client + merchant;
    return { count, bySpace: { client, merchant } };
  }

  // Marquer comme lue
  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // Tout marquer comme lu
  async markAllAsRead(userId: string, space?: NotificationSpace) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false, ...(space ? { space } : {}) },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /** Supprime les notifications de CET utilisateur : celles listées dans `ids`, ou toutes si `all`. */
  async deleteMany(userId: string, opts: { ids?: string[]; all?: boolean; space?: NotificationSpace }) {
    const scope = opts.space ? { userId, space: opts.space } : { userId };
    const where = opts.all ? scope : { ...scope, id: { in: opts.ids ?? [] } };
    const res = await this.prisma.notification.deleteMany({ where });
    return { deleted: res.count };
  }
}
