// apps/backend/src/kyc/kyc-reminders.service.ts
// =========================================================
// KYC REMINDERS v1.0 — tâches planifiées de la vérification d'identité.
//
//  1. Rappels quotidiens (10 h, Paris) aux clients wallet NON vérifiés qui n'ont aucune pièce en attente de validation :
//     notification dans l'application + push + e-mail, aux jours 1, 3, 7 puis chaque semaine (12 rappels au plus).
//     Un compare-and-set sur kycLastReminderAt garantit UN seul envoi même avec plusieurs instances.
//  2. Pièces expirées (3 h 40) : une pièce validée dont la date est passée devient EXPIRED ; si plus rien ne prouve l'identité,
//     le client retombe au niveau 0 (il doit renvoyer une pièce) et en est prévenu.
//  2 bis. Alertes d'expiration (10 h) : 30 puis 7 jours avant la date de fin de la pièce d'identité validée (une fois par seuil).
//  3. Rappel aux ADMINISTRATEURS (10 h) : dossiers en attente de validation depuis plus de 24 h.
// KYC_ENFORCEMENT=off arrête les rappels clients (recette).
// =========================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service';
import { KycNotifierService } from './kyc-notifier.service';
import { expiryNoticeMessage, reminderMessage } from './kyc-messages';
import { DOC_LABEL, daysUntilExpiry, enforcementEnabled, expiryNoticeDue, IDENTITY_TYPES, isExpired, levelFromDocs, levelRank, MAX_REMINDERS, overallStatus, reminderDue } from './kyc-rules';

const BATCH = 300;

@Injectable()
export class KycRemindersService {
  private readonly logger = new Logger(KycRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: KycNotifierService,
  ) {}

  @Cron('0 10 * * *', { timeZone: 'Europe/Paris' })
  async dailyReminders(): Promise<void> {
    try {
      const sent = await this.sendDueReminders(new Date());
      const admins = await this.remindAdmins(new Date());
      const expiring = await this.remindExpiring(new Date());
      if (sent || admins || expiring) this.logger.log(`KYC : ${sent} rappel(s) client, ${expiring} alerte(s) d'expiration, ${admins} rappel(s) administrateur`);
    } catch (err) {
      this.logger.error(`Rappels KYC en échec : ${(err as Error).message}`);
    }
  }

  @Cron('40 3 * * *')
  async dailyExpiry(): Promise<void> {
    try {
      const n = await this.expireDocuments(new Date());
      if (n) this.logger.log(`KYC : ${n} pièce(s) expirée(s)`);
    } catch (err) {
      this.logger.error(`Expiration KYC en échec : ${(err as Error).message}`);
    }
  }

  /** Envoie les rappels dus. Renvoie le nombre de clients rappelés. Exposé pour les tests. */
  async sendDueReminders(now: Date): Promise<number> {
    if (!enforcementEnabled()) return 0;

    const candidates = await this.prisma.user.findMany({
      where: {
        role: 'USER',
        isActive: true,
        isSuspended: false,
        deletedAt: null,
        kycLevel: 'LEVEL_0',
        kycReminderCount: { lt: MAX_REMINDERS },
        createdAt: { lte: new Date(now.getTime() - 86_400_000) },
        // Un dossier déjà déposé attend l'administrateur : on ne relance pas le client.
        kyc: { none: { status: 'PENDING' } },
      },
      orderBy: [{ kycLastReminderAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
      take: BATCH,
      select: {
        id: true, email: true, firstName: true, createdAt: true, kycLevel: true, kycReminderCount: true, kycLastReminderAt: true,
        kyc: { orderBy: { createdAt: 'desc' }, select: { type: true, status: true, expiryDate: true, rejectionReason: true } },
      },
    });

    let count = 0;
    for (const u of candidates) {
      if (!reminderDue({ count: u.kycReminderCount, lastAt: u.kycLastReminderAt, createdAt: u.createdAt, now })) continue;
      // Compare-and-set : une seule instance gagne.
      const claimed = await this.prisma.user.updateMany({
        where: { id: u.id, kycReminderCount: u.kycReminderCount, kycLastReminderAt: u.kycLastReminderAt },
        data: { kycReminderCount: { increment: 1 }, kycLastReminderAt: now },
      });
      if (claimed.count !== 1) continue;
      const status = overallStatus(u.kycLevel, u.kyc, now);
      await this.notifier.notifyUser(u, reminderMessage(status, u.kyc.find((d) => d.status === 'REJECTED')?.rejectionReason ?? null));
      count++;
    }
    return count;
  }

  /**
   * Prévient les clients dont la pièce d'identité validée expire dans 30 puis 7 jours. Un seuil n'est envoyé qu'une fois par pièce
   * (compare-and-set sur expiryNoticeDays). Pas d'alerte si le client a déjà une autre pièce valide plus longue ou une pièce en attente.
   * Renvoie le nombre de clients prévenus.
   */
  async remindExpiring(now: Date): Promise<number> {
    if (!enforcementEnabled()) return 0;
    const horizon = new Date(now.getTime() + 31 * 86_400_000);
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const docs = await this.prisma.kycDocument.findMany({
      where: {
        status: 'APPROVED',
        type: { in: [...IDENTITY_TYPES] },
        expiryDate: { gte: startOfToday, lte: horizon },
        user: { role: 'USER', isActive: true, isSuspended: false, deletedAt: null },
      },
      orderBy: { expiryDate: 'asc' },
      take: BATCH,
      select: { id: true, userId: true, type: true, expiryDate: true, expiryNoticeDays: true, user: { select: { id: true, email: true, firstName: true } } },
    });

    let count = 0;
    const done = new Set<string>();
    for (const d of docs) {
      if (!d.expiryDate || done.has(d.userId)) continue;
      const threshold = expiryNoticeDue(d.expiryDate, d.expiryNoticeDays, now);
      if (threshold === null) continue;
      // Une pièce plus récente valable plus longtemps, ou déjà déposée en remplacement : inutile d'alerter.
      const others = await this.prisma.kycDocument.findMany({
        where: { userId: d.userId, id: { not: d.id }, type: { in: [...IDENTITY_TYPES] }, status: { in: ['APPROVED', 'PENDING'] } },
        select: { status: true, expiryDate: true },
      });
      if (others.some((o) => o.status === 'PENDING' || !o.expiryDate || o.expiryDate > d.expiryDate!)) continue;
      const claimed = await this.prisma.kycDocument.updateMany({
        where: { id: d.id, status: 'APPROVED', expiryNoticeDays: d.expiryNoticeDays },
        data: { expiryNoticeDays: threshold },
      });
      if (claimed.count !== 1) continue;
      done.add(d.userId);
      const label = DOC_LABEL[d.type as keyof typeof DOC_LABEL] ?? "pièce d'identité";
      await this.notifier.notifyUser(d.user, expiryNoticeMessage(daysUntilExpiry(d.expiryDate, now), d.expiryDate, label));
      count++;
    }
    return count;
  }

  /** Marque EXPIRED les pièces validées dont la date est passée et recalcule le niveau. Renvoie le nombre de pièces. */
  async expireDocuments(now: Date): Promise<number> {
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const stale = await this.prisma.kycDocument.findMany({
      where: { status: 'APPROVED', expiryDate: { lt: startOfToday } },
      take: 500,
      select: { id: true, userId: true, type: true, expiryDate: true, user: { select: { id: true, email: true, firstName: true, clientId: true, kycLevel: true } } },
    });
    let n = 0;
    for (const d of stale) {
      if (!isExpired(d.expiryDate, now)) continue;
      const claimed = await this.prisma.kycDocument.updateMany({ where: { id: d.id, status: 'APPROVED' }, data: { status: 'EXPIRED' } });
      if (claimed.count !== 1) continue;
      n++;
      const docs = await this.prisma.kycDocument.findMany({ where: { userId: d.userId }, select: { type: true, status: true, expiryDate: true } });
      const computed = levelFromDocs(docs, now);
      // Plus rien ne prouve l'identité : retour au niveau 0 (nouvelle vérification exigée).
      const dropped = levelRank(computed) < 1 && levelRank(d.user.kycLevel) >= 1;
      if (dropped) {
        await this.prisma.user.update({ where: { id: d.userId }, data: { kycLevel: 'LEVEL_0', kycReminderCount: 0, kycLastReminderAt: null } });
      }
      try {
        await this.prisma.auditLog.create({
          data: { userId: null, clientId: d.user.clientId, action: 'KYC_REJECT', entity: 'KycDocument', entityId: d.id, details: { userId: d.userId, type: d.type, expired: true, automatic: true, levelDropped: dropped }, successful: true },
        });
      } catch (err) {
        this.logger.error(`Journal d'audit non écrit (KYC expiré ${d.id}) : ${(err as Error).message}`);
      }
      if (dropped) await this.notifier.notifyUser(d.user, reminderMessage('EXPIRED', null));
    }
    return n;
  }

  /** Prévient les administrateurs des sociétés qui ont des dossiers en attente depuis plus de 24 h. */
  async remindAdmins(now: Date): Promise<number> {
    const old = await this.prisma.kycDocument.findMany({
      where: { status: 'PENDING', createdAt: { lte: new Date(now.getTime() - 86_400_000) }, user: { clientId: { not: null }, deletedAt: null } },
      select: { userId: true, user: { select: { clientId: true } } },
    });
    const perCompany = new Map<number, Set<string>>();
    for (const d of old) {
      const c = d.user.clientId;
      if (c === null) continue;
      if (!perCompany.has(c)) perCompany.set(c, new Set());
      perCompany.get(c)!.add(d.userId);
    }
    let n = 0;
    for (const [clientId, users] of perCompany) {
      n += await this.notifier.notifyCompanyAdmins(clientId, {
        kind: 'ADMIN_DIGEST',
        title: 'Dossiers KYC en attente',
        body: `${users.size} client${users.size > 1 ? 's attendent' : ' attend'} la validation de ${users.size > 1 ? 'leurs' : 'sa'} pièce d'identité depuis plus de 24 h.`,
        actionUrl: '/admin/kyc',
        actionLabel: 'Vérifications KYC',
        priority: 'HIGH',
      });
    }
    return n;
  }
}
