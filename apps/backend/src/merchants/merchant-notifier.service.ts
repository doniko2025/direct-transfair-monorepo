// apps/backend/src/merchants/merchant-notifier.service.ts
// =========================================================
// Messages du compte marchand : paiement reçu / effectué / refusé / expiré, retrait traité, destination modifiée.
// Trois canaux (notification dans l'application, push, e-mail). Un canal en panne ne bloque ni les autres ni l'opération : ne lève jamais.
// =========================================================

import { Injectable, Logger } from '@nestjs/common';

import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';

export type MerchantMessageKind =
  | 'PAYMENT_REQUEST'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_SENT'
  | 'PAYMENT_DECLINED'
  | 'PAYMENT_EXPIRED'
  | 'PAYMENT_CANCELLED'
  | 'PAYMENT_FAILED'
  | 'PAYOUT_REQUESTED'
  | 'PAYOUT_PAID'
  | 'PAYOUT_REJECTED'
  | 'PAYOUT_FAILED'
  | 'PAYOUT_PENDING_ADMIN'
  | 'DESTINATION_CHANGED'
  | 'MERCHANT_ACTIVATED'
  | 'MERCHANT_SUSPENDED'
  | 'MERCHANT_REACTIVATED';

export interface MerchantMessage {
  kind: MerchantMessageKind;
  title: string;
  body: string;
  /** Route de l'application ouverte au toucher de la notification. */
  actionUrl?: string;
  actionLabel?: string;
  type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  /** Par défaut : e-mail pour les résultats définitifs (succès / échec), pas pour les demandes ni les rappels. */
  email?: boolean;
}

const esc = (v: string): string => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export function merchantEmailHtml(firstName: string, m: Pick<MerchantMessage, 'title' | 'body' | 'actionLabel'>): string {
  return (
    `<p>Bonjour <strong>${esc(firstName || '')}</strong>,</p>` +
    `<h3 style="margin:12px 0">${esc(m.title)}</h3>` +
    `<p>${esc(m.body).replace(/\n/g, '<br/>')}</p>` +
    (m.actionLabel ? `<p style="color:#64748B;font-size:13px">Ouvrez l'application, rubrique <strong>${esc(m.actionLabel)}</strong>.</p>` : '')
  );
}

/** Formate un montant pour un message : « 15 000 XOF », « 12,50 EUR ». */
export function formatMoney(amount: number | string | { toString(): string }, currency: string): string {
  const n = Number(amount.toString());
  const zero = currency === 'XOF' || currency === 'GNF';
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: zero ? 0 : 2, maximumFractionDigits: zero ? 0 : 2 })} ${currency}`.replace(/[  ]/g, ' ');
}

@Injectable()
export class MerchantNotifierService {
  private readonly logger = new Logger(MerchantNotifierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly mail: MailService,
  ) {}

  /** Ne lève jamais. */
  async notifyUser(user: { id: string; email?: string | null; firstName?: string | null }, m: MerchantMessage): Promise<void> {
    const wantEmail = (m.email ?? false) && !!user.email;
    const safe = async (what: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (err) {
        this.logger.warn(`Marchand ${m.kind} → ${user.id} : envoi ${what} impossible (${(err as Error).message})`);
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
          priority: m.type === 'ERROR' || m.type === 'WARNING' || m.kind === 'PAYMENT_REQUEST' ? 'HIGH' : 'NORMAL',
          actionUrl: m.actionUrl ?? null,
          actionLabel: m.actionLabel ?? null,
          groupKey: 'merchant',
          metadata: { kind: m.kind },
        },
      }),
    );
    await safe('push', () => this.push.sendToUser(user.id, { title: m.title, body: m.body, data: { type: 'MERCHANT', kind: m.kind, actionUrl: m.actionUrl ?? '' } }));
    if (wantEmail) {
      await safe('e-mail', () => this.mail.sendEmail({ to: user.email!, subject: m.title, htmlContent: merchantEmailHtml(user.firstName ?? '', m), userId: user.id }));
    }
  }
}
