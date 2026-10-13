// apps/backend/src/rate-alerts/rate-alerts.service.ts
// =========================================================
// RATE ALERTS SERVICE v4.1
// ✅ v4.1 (phase 6, passe 3) :
//   (1) Corps de POST /rate-alerts validé (CreateRateAlertDto) : paire connue, direction, seuil, canaux. Avant,
//       `body: any` : une paire non textuelle, une direction inconnue ou un seuil texte donnaient une erreur 500
//       ou une alerte qui ne se déclenchait jamais.
//   (2) Le taux courant se lit aussi par le sens inverse (1 / taux) : seules les paires de base (EUR_XOF…) sont
//       stockées, une alerte XOF_EUR ne se déclenchait donc jamais.
//   (3) Déclenchement « réservé » par une mise à jour conditionnelle : deux passages du cron qui se chevauchent
//       (ou le déclenchement manuel) n'envoient plus deux fois la même alerte.
//   (4) Un échec d'envoi (email, SMS, push) n'interrompt plus les alertes suivantes ; comptes supprimés ou
//       désactivés ignorés ; 20 alertes actives au plus par compte.
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
import { normalizePair, RATE_CURRENCIES } from '../rates-admin/rate-rules';
import { PushService } from '../push/push.service';
import { SmsService } from '../sms/sms.service';
import { MailService } from '../mail/mail.service';

// =========================================================
// TYPES
// =========================================================

import type { CreateRateAlertDto } from './dto/create-rate-alert.dto';
export type { CreateRateAlertDto };

/** Alertes actives (non déclenchées) qu'un même compte peut garder. */
export const MAX_ACTIVE_ALERTS_PER_USER = 20;

/**
 * Taux courant d'une paire « BASE_QUOTE » à partir des lignes enregistrées : le sens direct s'il existe,
 * sinon l'inverse (1 / taux). null si aucun des deux n'est enregistré.
 */
export function currentRateOf(pair: string, rates: ReadonlyMap<string, number>): number | null {
  const direct = rates.get(pair);
  if (direct !== undefined && direct > 0) return direct;
  const [base, quote] = pair.split('_');
  const inverse = rates.get(`${quote}_${base}`);
  return inverse !== undefined && inverse > 0 ? 1 / inverse : null;
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

    const pair = normalizePair(dto.pair);
    const m = /^([A-Z]{3})_([A-Z]{3})$/.exec(pair);
    const known = (c: string) => (RATE_CURRENCIES as readonly string[]).includes(c);
    if (!m || !known(m[1]) || !known(m[2]) || m[1] === m[2]) {
      throw new BadRequestException(
        `Paire invalide : « ${dto.pair} ». Exemple : EUR_GNF. Devises prises en charge : ${RATE_CURRENCIES.join(', ')}.`,
      );
    }

    if (!(dto.threshold > 0)) {
      throw new BadRequestException('Le seuil doit être positif');
    }

    const active = await this.prisma.rateAlert.count({ where: { userId, isActive: true, isTriggered: false } });
    if (active >= MAX_ACTIVE_ALERTS_PER_USER) {
      throw new BadRequestException(`Vous ne pouvez pas garder plus de ${MAX_ACTIVE_ALERTS_PER_USER} alertes actives.`);
    }

    const alert = await this.prisma.rateAlert.create({
      data: {
        userId,
        pair,
        direction: dto.direction as any,
        threshold: dto.threshold,
        notifiedVia: (dto.notifiedVia?.length ? dto.notifiedVia : ['PUSH', 'EMAIL']) as any,
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
      where: {
        isActive: true,
        isTriggered: false,
        // Comptes supprimés ou désactivés : plus d'envoi (l'email d'un compte supprimé est de toute façon invalide).
        user: { isActive: true, deletedAt: null },
      },
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

    // Charge tous les taux utiles (sens direct et inverse) en une seule requête
    const wanted = new Set<string>();
    for (const a of activeAlerts) {
      wanted.add(a.pair);
      const [base, quote] = a.pair.split('_');
      wanted.add(`${quote}_${base}`);
    }
    const rates = await this.prisma.exchangeRate.findMany({
      where: { pair: { in: [...wanted] } },
    });
    const rateMap = new Map<string, number>(rates.map((r) => [r.pair, Number(r.rate)]));

    for (const alert of activeAlerts) {
      const currentRate = currentRateOf(alert.pair, rateMap);
      if (currentRate === null) continue;

      const triggered =
        (alert.direction === 'ABOVE' && currentRate >= alert.threshold) ||
        (alert.direction === 'BELOW' && currentRate <= alert.threshold);

      if (!triggered) continue;

      // Réserve le déclenchement : si un autre passage l'a déjà pris, on n'envoie rien.
      const claimed = await this.prisma.rateAlert.updateMany({
        where: { id: alert.id, isActive: true, isTriggered: false },
        data: { isTriggered: true, triggeredAt: new Date(), isActive: false },
      });
      if (claimed.count !== 1) continue;

      this.logger.log(
        `🔔 Alerte déclenchée : ${alert.pair} ${alert.direction} ${alert.threshold} (actuel: ${currentRate})`,
      );

      const rate = Math.round(currentRate * 1e6) / 1e6;
      const channels = (alert.notifiedVia ?? []) as string[];
      const label = alert.pair.replace('_', ' → ');
      const verb = alert.direction === 'ABOVE' ? 'dépassé' : 'passé sous';

      const send = async (what: string, fn: () => Promise<unknown>) => {
        try {
          await fn();
        } catch (err) {
          this.logger.warn(`Alerte ${alert.id} : envoi ${what} impossible (${(err as Error).message})`);
        }
      };

      if (channels.includes('PUSH')) {
        await send('push', () =>
          this.push.notifyRateAlert(alert.userId, alert.pair, rate, alert.direction as 'ABOVE' | 'BELOW'),
        );
      }

      if (channels.includes('EMAIL') && alert.user?.email) {
        const name = escapeHtml(alert.user.firstName ?? '');
        await send('email', () =>
          this.mail.sendEmail(
            alert.user!.email,
            `Alerte taux ${alert.pair.replace('_', '→')} 📊`,
            `<p>Bonjour <strong>${name}</strong>,</p>
           <p>Le taux <strong>${label}</strong> a ${verb} votre seuil de <strong>${alert.threshold}</strong>.</p>
           <table cellpadding="8" style="background:#DBEAFE;border-radius:8px;width:100%">
             <tr><td style="color:#1E40AF">Seuil défini</td><td style="font-weight:500;color:#1E40AF;text-align:right">${alert.threshold}</td></tr>
             <tr><td style="color:#1E40AF">Taux actuel</td><td style="font-weight:500;color:#1E40AF;text-align:right">${rate}</td></tr>
           </table>`,
          ),
        );
      }

      if (channels.includes('SMS') && alert.user?.phone) {
        await send('sms', () =>
          this.sms.sendRateAlert({
            to: alert.user!.phone!,
            pair: alert.pair,
            rate,
            direction: alert.direction as 'ABOVE' | 'BELOW',
            userId: alert.userId,
          }),
        );
      }

      // Notification in-app
      await send('in-app', () =>
        this.prisma.notification.create({
          data: {
            userId: alert.userId,
            title: `Alerte taux ${alert.pair.replace('_', '→')} 📊`,
            message:
              `Le taux ${alert.pair.replace('_', '→')} a ${verb}` +
              ` votre seuil de ${alert.threshold}. Taux actuel : ${rate}`,
            type: 'INFO',
            channels: ['IN_APP'] as any,
          },
        }),
      );
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

const escapeHtml = (v: string): string =>
  v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
