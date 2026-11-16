// apps/backend/src/bills/bills-notifier.service.ts
// =========================================================
// Messages du paiement de factures : facture payée, facture réglée (reçu), facture refusée et remboursée, facture à régler (côté société).
// Trois canaux (notification dans l'application, push, e-mail). Un canal en panne ne bloque ni les autres ni l'opération : ne lève jamais.
// Les messages du client ouvrent un écran « /bills… » → boîte de réception « client » (jamais « marchand »).
// =========================================================

import { Injectable, Logger } from '@nestjs/common';

import { MailService } from '../mail/mail.service';
import { merchantEmailHtml } from '../merchants/merchant-notifier.service';
import { spaceOfAction } from '../notifications/notification-space';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';

export type BillMessageKind = 'BILL_SUBMITTED' | 'BILL_COMPLETED' | 'BILL_REFUNDED' | 'BILL_TO_SETTLE' | 'BILL_LATE' | 'BILL_REMINDER' | 'BILL_SCHEDULE_FAILED' | 'BILL_SCHEDULE_PAUSED';

export interface BillMessage {
  kind: BillMessageKind;
  title: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
  type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  email?: boolean;
}

@Injectable()
export class BillsNotifierService {
  private readonly logger = new Logger(BillsNotifierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly mail: MailService,
  ) {}

  /** Ne lève jamais. */
  async notifyUser(user: { id: string; email?: string | null; firstName?: string | null }, m: BillMessage): Promise<void> {
    const wantEmail = (m.email ?? false) && !!user.email;
    const safe = async (what: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (err) {
        this.logger.warn(`Facture ${m.kind} → ${user.id} : envoi ${what} impossible (${(err as Error).message})`);
      }
    };
    await safe('notification', () =>
      this.prisma.notification.create({
        data: {
          userId: user.id,
          title: m.title,
          message: m.body,
          type: m.type ?? 'INFO',
          channels: wantEmail ? ['IN_APP', 'PUSH', 'EMAIL'] : ['IN_APP', 'PUSH'],
          priority: m.type === 'ERROR' || m.type === 'WARNING' ? 'HIGH' : 'NORMAL',
          actionUrl: m.actionUrl ?? null,
          actionLabel: m.actionLabel ?? null,
          groupKey: 'bills',
          space: spaceOfAction(m.actionUrl),
          metadata: { kind: m.kind },
        },
      }),
    );
    await safe('push', () => this.push.sendToUser(user.id, { title: m.title, body: m.body, data: { type: 'BILL', kind: m.kind, space: spaceOfAction(m.actionUrl), actionUrl: m.actionUrl ?? '' } }));
    if (wantEmail) {
      await safe('e-mail', () => this.mail.sendEmail({ to: user.email!, subject: m.title, htmlContent: merchantEmailHtml(user.firstName ?? '', m), userId: user.id }));
    }
  }

  /** Prévient les administrateurs de la société (une facture est à régler, ou en retard). Ne lève jamais. */
  async notifyCompanyAdmins(clientId: number, m: BillMessage): Promise<void> {
    try {
      const admins = await this.prisma.user.findMany({
        where: { clientId, role: 'COMPANY_ADMIN', isActive: true, deletedAt: null },
        select: { id: true, email: true, firstName: true },
        take: 20,
      });
      await Promise.all(admins.map((a) => this.notifyUser(a, m)));
    } catch (err) {
      this.logger.warn(`Facture ${m.kind} → administrateurs de la société ${clientId} : ${(err as Error).message}`);
    }
  }
}
