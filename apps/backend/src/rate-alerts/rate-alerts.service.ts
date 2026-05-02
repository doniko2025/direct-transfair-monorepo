// apps/backend/src/rate-alerts/rate-alerts.service.ts
// =========================================================
// RATE ALERTS SERVICE v4.0
// ✅ Alerte quand un taux dépasse / passe sous un seuil
// ✅ Notification push + email + SMS
// ✅ Cron toutes les 15 minutes
// =========================================================

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { SmsService } from '../sms/sms.service';
import { MailService } from '../mail/mail.service';

// =========================================================
// TYPES
// =========================================================

export interface CreateRateAlertDto {
  pair: string;             // Ex: "EUR_GNF"
  direction: 'ABOVE' | 'BELOW';
  threshold: number;
  notifiedVia?: string[];   // ["PUSH", "EMAIL", "SMS"]
}

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class RateAlertsService {
  private readonly logger = new Logger(RateAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly sms: SmsService,
    private readonly mail: MailService,
  ) {}

  // ========================================================
  // CRUD
  // ========================================================

  async create(userId: string, dto: CreateRateAlertDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('Utilisateur invalide');

    const client = user.clientId
      ? await this.prisma.client.findUnique({ where: { id: user.clientId } })
      : null;

    if (client && !client.featureRateAlerts) {
      throw new ForbiddenException(
        "Les alertes de taux ne sont pas activées pour cette société.",
      );
    }

    const pair = dto.pair.toUpperCase().trim();
    if (!pair.includes('_') || pair.split('_').length !== 2) {
      throw new BadRequestException(
        'Format de paire invalide. Exemple : EUR_GNF',
      );
    }

    if (dto.threshold <= 0) {
      throw new BadRequestException('Le seuil doit être positif');
    }

    const alert = await this.prisma.rateAlert.create({
      data: {
        userId,
        pair,
        direction: dto.direction as any,
        threshold: dto.threshold,
        notifiedVia: (dto.notifiedVia ?? ['PUSH', 'EMAIL']) as any,
        isActive: true,
        isTriggered: false,
      },
    });

    return this.serialize(alert);
  }

  async findForUser(userId: string) {
    const alerts = await this.prisma.rateAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return alerts.map(this.serialize);
  }

  async findOne(id: string, userId: string) {
    const alert = await this.prisma.rateAlert.findFirst({
      where: { id, userId },
    });
    if (!alert) throw new NotFoundException('Alerte introuvable');
    return this.serialize(alert);
  }

  async delete(id: string, userId: string) {
    const alert = await this.prisma.rateAlert.findFirst({
      where: { id, userId },
    });
    if (!alert) throw new NotFoundException('Alerte introuvable');
    await this.prisma.rateAlert.delete({ where: { id } });
    return { deleted: true, id };
  }

  async resetAlert(id: string, userId: string) {
    const alert = await this.prisma.rateAlert.findFirst({
      where: { id, userId },
    });
    if (!alert) throw new NotFoundException('Alerte introuvable');

    const updated = await this.prisma.rateAlert.update({
      where: { id },
      data: { isTriggered: false, triggeredAt: null, isActive: true },
    });
    return this.serialize(updated);
  }

  // ========================================================
  // CRON — Vérification toutes les 15 minutes
  // ========================================================

  @Cron('*/15 * * * *')
  async checkAlerts(): Promise<void> {
    const activeAlerts = await this.prisma.rateAlert.findMany({
      where: { isActive: true, isTriggered: false },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (activeAlerts.length === 0) return;

    // Charge tous les taux en une seule requête
    const pairs = [...new Set(activeAlerts.map((a) => a.pair))];
    const rates = await this.prisma.exchangeRate.findMany({
      where: { pair: { in: pairs } },
    });
    const rateMap = new Map(rates.map((r) => [r.pair, r.rate]));

    for (const alert of activeAlerts) {
      const currentRate = rateMap.get(alert.pair);
      if (currentRate === undefined) continue;

      const triggered =
        (alert.direction === 'ABOVE' && currentRate >= alert.threshold) ||
        (alert.direction === 'BELOW' && currentRate <= alert.threshold);

      if (!triggered) continue;

      this.logger.log(
        `🔔 Alerte déclenchée : ${alert.pair} ${alert.direction} ${alert.threshold} (actuel: ${currentRate})`,
      );

      // Marque comme déclenchée
      await this.prisma.rateAlert.update({
        where: { id: alert.id },
        data: {
          isTriggered: true,
          triggeredAt: new Date(),
          isActive: false,
        },
      });

      // Notifications selon les canaux choisis
      const channels = (alert.notifiedVia ?? []) as string[];

      if (channels.includes('PUSH')) {
        await this.push.notifyRateAlert(
          alert.userId,
          alert.pair,
          currentRate,
          alert.direction as 'ABOVE' | 'BELOW',
        );
      }

      if (channels.includes('EMAIL') && alert.user?.email) {
        await this.mail.sendEmail(
          alert.user.email,
          `Alerte taux ${alert.pair.replace('_', '→')} 📊`,
          `<p>Bonjour <strong>${alert.user.firstName}</strong>,</p>
           <p>Le taux <strong>${alert.pair.replace('_', ' → ')}</strong> a 
           ${alert.direction === 'ABOVE' ? 'dépassé' : 'passé sous'} votre seuil 
           de <strong>${alert.threshold}</strong>.</p>
           <table cellpadding="8" style="background:#DBEAFE;border-radius:8px;width:100%">
             <tr><td style="color:#1E40AF">Seuil défini</td><td style="font-weight:500;color:#1E40AF;text-align:right">${alert.threshold}</td></tr>
             <tr><td style="color:#1E40AF">Taux actuel</td><td style="font-weight:500;color:#1E40AF;text-align:right">${currentRate}</td></tr>
           </table>`,
        );
      }

      if (channels.includes('SMS') && alert.user?.phone) {
        await this.sms.sendRateAlert({
          to: alert.user.phone,
          pair: alert.pair,
          rate: currentRate,
          direction: alert.direction as 'ABOVE' | 'BELOW',
          userId: alert.userId,
        });
      }

      // Notification in-app
      await this.prisma.notification.create({
        data: {
          userId: alert.userId,
          title: `Alerte taux ${alert.pair.replace('_', '→')} 📊`,
          message:
            `Le taux ${alert.pair.replace('_', '→')} a ` +
            (alert.direction === 'ABOVE' ? 'dépassé' : 'passé sous') +
            ` votre seuil de ${alert.threshold}. Taux actuel : ${currentRate}`,
          type: 'INFO',
          channels: ['IN_APP'] as any,
        },
      });
    }
  }

  // ========================================================
  // TRIGGER MANUEL (pour les tests admin)
  // ========================================================

  async triggerCheck(): Promise<{ checked: number; triggered: number }> {
    const before = await this.prisma.rateAlert.count({
      where: { isTriggered: true },
    });
    await this.checkAlerts();
    const after = await this.prisma.rateAlert.count({
      where: { isTriggered: true },
    });
    const total = await this.prisma.rateAlert.count({
      where: { isActive: true },
    });
    return { checked: total, triggered: after - before };
  }

  private serialize(a: any) {
    return {
      id: a.id,
      userId: a.userId,
      pair: a.pair,
      direction: a.direction,
      threshold: a.threshold,
      isTriggered: a.isTriggered,
      triggeredAt: a.triggeredAt,
      isActive: a.isActive,
      notifiedVia: a.notifiedVia,
      createdAt: a.createdAt,
    };
  }
}