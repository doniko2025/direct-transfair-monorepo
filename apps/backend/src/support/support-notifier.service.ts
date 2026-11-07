// apps/backend/src/support/support-notifier.service.ts
// =========================================================
// Messages du service client vers les clients (réponse à une demande, décision sur un litige ou un remboursement, compte suspendu / réactivé)
// sur les trois canaux : notification dans l'application, push, e-mail. Un canal en panne ne bloque ni les autres ni l'opération.
// =========================================================

import { Injectable, Logger } from '@nestjs/common';

import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { expandPermissions, type SupportPermission } from './support-permissions';

export interface SupportMessage {
  title: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
  /** Rubrique de l'application ouverte au toucher / regroupement. */
  kind: 'TICKET_REPLY' | 'TICKET_RESOLVED' | 'REFUND_APPROVED' | 'REFUND_REJECTED' | 'REFUND_FAILED' | 'ACCOUNT_SUSPENDED' | 'ACCOUNT_REACTIVATED' | 'STAFF_REFUND_PENDING';
  type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  email?: boolean;
}

const esc = (v: string): string => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export function supportEmailHtml(firstName: string, m: Pick<SupportMessage, 'body' | 'actionLabel'>): string {
  return (
    `<p>Bonjour <strong>${esc(firstName || '')}</strong>,</p>` +
    `<p>${esc(m.body).replace(/\n/g, '<br/>')}</p>` +
    (m.actionLabel ? `<p style="color:#64748B;font-size:13px">Ouvrez l'application, rubrique <strong>${esc(m.actionLabel)}</strong>.</p>` : '')
  );
}

@Injectable()
export class SupportNotifierService {
  private readonly logger = new Logger(SupportNotifierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly mail: MailService,
  ) {}

  /** Ne lève jamais. */
  async notifyUser(user: { id: string; email?: string | null; firstName?: string | null }, m: SupportMessage): Promise<void> {
    const wantEmail = m.email !== false && !!user.email;
    const safe = async (what: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (err) {
        this.logger.warn(`Support ${m.kind} → ${user.id} : envoi ${what} impossible (${(err as Error).message})`);
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
          priority: 'NORMAL',
          actionUrl: m.actionUrl ?? null,
          actionLabel: m.actionLabel ?? null,
          groupKey: 'support',
          metadata: { kind: m.kind },
        },
      }),
    );
    await safe('push', () => this.push.sendToUser(user.id, { title: m.title, body: m.body, data: { type: 'SUPPORT', kind: m.kind, actionUrl: m.actionUrl ?? '' } }));
    if (wantEmail) {
      await safe('e-mail', () => this.mail.sendEmail({ to: user.email!, subject: m.title, htmlContent: supportEmailHtml(user.firstName ?? '', m), userId: user.id }));
    }
  }

  /** Prévient les personnes qui peuvent décider (admins de la société + support ayant la délégation) — notification et push, pas d'e-mail. */
  async notifyDeciders(clientId: number, m: SupportMessage, permission: string, exceptUserId?: string): Promise<number> {
    const rows = await this.prisma.user.findMany({
      where: {
        clientId,
        isActive: true,
        isSuspended: false,
        deletedAt: null,
        ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
        role: { in: ['COMPANY_ADMIN', 'SUPPORT'] },
      },
      select: { id: true, email: true, firstName: true, role: true, supportPermissions: true },
    });
    // Les délégations stockées sont celles cochées par l'admin ; les délégations impliquées s'ajoutent au calcul.
    const staff = rows.filter((u) => u.role === 'COMPANY_ADMIN' || expandPermissions(u.supportPermissions).includes(permission as SupportPermission));
    for (const u of staff) await this.notifyUser(u, { ...m, email: false });
    return staff.length;
  }
}
