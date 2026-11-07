// apps/backend/src/kyc/kyc-notifier.service.ts
// =========================================================
// KYC NOTIFIER v1.0 — messages de la vérification d'identité, sur les TROIS canaux :
//   notification dans l'application (cloche), notification push, e-mail.
// Un canal en panne n'empêche jamais les autres ni l'opération qui l'a déclenché : on journalise et on continue.
// =========================================================

import { Injectable, Logger } from '@nestjs/common';

import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';

export type KycMessageKind =
  | 'REMINDER'
  | 'RECEIVED'
  | 'APPROVED'
  | 'PARTIAL'
  | 'REJECTED'
  | 'EXPIRED'
  | 'EXPIRING'
  | 'ADMIN_NEW'
  | 'ADMIN_DIGEST';

export interface KycMessage {
  title: string;
  body: string;
  /** Écran de l'application ouvert au toucher. */
  actionUrl: string;
  actionLabel: string;
  kind: KycMessageKind;
  priority?: 'NORMAL' | 'HIGH';
}

const escapeHtml = (v: string): string =>
  v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export function emailHtml(firstName: string, m: KycMessage): string {
  return (
    `<p>Bonjour <strong>${escapeHtml(firstName || '')}</strong>,</p>` +
    `<p>${escapeHtml(m.body).replace(/\n/g, '<br/>')}</p>` +
    `<p style="color:#64748B;font-size:13px">Ouvrez l'application, rubrique <strong>${escapeHtml(m.actionLabel)}</strong>.</p>`
  );
}

@Injectable()
export class KycNotifierService {
  private readonly logger = new Logger(KycNotifierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly mail: MailService,
  ) {}

  /** Envoie le message à un utilisateur sur les trois canaux. Ne lève jamais. */
  async notifyUser(
    user: { id: string; email?: string | null; firstName?: string | null },
    m: KycMessage,
    opts: { email?: boolean } = {},
  ): Promise<void> {
    const wantEmail = opts.email !== false;
    const send = async (what: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (err) {
        this.logger.warn(`KYC ${m.kind} → ${user.id} : envoi ${what} impossible (${(err as Error).message})`);
      }
    };

    await send('notification', () =>
      this.prisma.notification.create({
        data: {
          userId: user.id,
          title: m.title,
          message: m.body,
          type: m.kind === 'APPROVED' ? 'SUCCESS' : m.kind === 'REJECTED' || m.kind === 'EXPIRED' || m.kind === 'EXPIRING' ? 'WARNING' : 'INFO',
          channels: wantEmail && user.email ? ['IN_APP', 'PUSH', 'EMAIL'] : ['IN_APP', 'PUSH'],
          priority: m.priority ?? 'NORMAL',
          actionUrl: m.actionUrl,
          actionLabel: m.actionLabel,
          groupKey: 'kyc',
          metadata: { kind: m.kind },
        },
      }),
    );
    await send('push', () =>
      this.push.sendToUser(user.id, { title: m.title, body: m.body, data: { type: 'KYC', kind: m.kind, actionUrl: m.actionUrl } }),
    );
    if (wantEmail && user.email) {
      await send('e-mail', () => this.mail.sendEmail({ to: user.email!, subject: m.title, htmlContent: emailHtml(user.firstName ?? '', m), userId: user.id }));
    }
  }

  /** Prévient les administrateurs actifs d'une société (notification + push, pas d'e-mail pour ne pas inonder la boîte). */
  async notifyCompanyAdmins(clientId: number, m: KycMessage): Promise<number> {
    const admins = await this.prisma.user.findMany({
      where: { clientId, role: 'COMPANY_ADMIN', isActive: true, deletedAt: null },
      select: { id: true, email: true, firstName: true },
    });
    for (const a of admins) await this.notifyUser(a, m, { email: false });
    return admins.length;
  }
}
