// apps/backend/src/mail/mail.service.ts
// =========================================================
// MAIL SERVICE v4.0
// ✅ Templates multi-devises (XOF, EUR, USD, GNF, GBP)
// ✅ CommunicationLog tracé en base
// ✅ Brand color dynamique (par société)
// ✅ Compatible Gmail / SMTP
// =========================================================

import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

import { PrismaService } from '../prisma/prisma.service';

// =========================================================
// CURRENCY HELPERS
// =========================================================

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  GNF: 'FG',
  XOF: 'FCFA',
};

const CURRENCY_LOCALES: Record<string, string> = {
  EUR: 'fr-FR',
  USD: 'en-US',
  GBP: 'en-GB',
  GNF: 'fr-GN',
  XOF: 'fr-SN',
};

export function formatAmount(
  amount: number | string,
  currency: string = 'XOF',
): string {
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return `0 ${CURRENCY_SYMBOLS[currency] ?? currency}`;

  const locale = CURRENCY_LOCALES[currency] ?? 'fr-FR';
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;

  try {
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: currency === 'GNF' || currency === 'XOF' ? 0 : 2,
      maximumFractionDigits: currency === 'GNF' || currency === 'XOF' ? 0 : 2,
    }).format(n);
    return `${formatted} ${symbol}`;
  } catch {
    return `${n.toFixed(2)} ${symbol}`;
  }
}

// =========================================================
// SERVICE
// =========================================================

export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
  userId?: string;
  transactionId?: string;
  brandColor?: string; // Override couleur de la marque
  brandName?: string;  // Nom de la société
}

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly prisma: PrismaService) {
    // ✅ Support Gmail simplifié OU SMTP custom
    const useGmailService = (process.env.MAIL_SERVICE ?? '').toLowerCase() === 'gmail';

    if (useGmailService) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS ?? process.env.MAIL_PASSWORD,
        },
      });
    } else {
      this.transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT) || 587,
        secure: process.env.MAIL_SECURE === 'true',
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS ?? process.env.MAIL_PASSWORD,
        },
      });
    }
  }

  // ========================================================
  // ENVOI GÉNÉRIQUE (avec log en base)
  // ========================================================

  async sendEmail(
    toOrOptions: string | SendEmailOptions,
    subject?: string,
    htmlContent?: string,
  ): Promise<void> {
    // Support des deux signatures (string ou options)
    const opts: SendEmailOptions =
      typeof toOrOptions === 'string'
        ? {
            to: toOrOptions,
            subject: subject ?? '',
            htmlContent: htmlContent ?? '',
          }
        : toOrOptions;

    if (!opts.to || !opts.subject) {
      this.logger.warn('Email skip: to/subject manquant');
      return;
    }

    // ✅ Crée un CommunicationLog en PENDING
    let logId: string | null = null;
    try {
      const log = await this.prisma.communicationLog.create({
        data: {
          userId: opts.userId ?? null,
          transactionId: opts.transactionId ?? null,
          type: 'EMAIL',
          recipient: opts.to,
          subject: opts.subject,
          htmlBody: opts.htmlContent,
          status: 'PENDING',
          providerName: 'nodemailer',
        },
      });
      logId = log.id;
    } catch (e) {
      this.logger.warn('CommunicationLog création échouée', e);
    }

    try {
      const info = await this.transporter.sendMail({
        from: process.env.MAIL_FROM ?? process.env.MAIL_USER,
        to: opts.to,
        subject: opts.subject,
        html: this.wrapHtml(opts.subject, opts.htmlContent, {
          brandColor: opts.brandColor,
          brandName: opts.brandName,
        }),
      });

      this.logger.log(`✉️  Email → ${opts.to} (${info.messageId})`);

      // ✅ Update log → SENT
      if (logId) {
        await this.prisma.communicationLog
          .update({
            where: { id: logId },
            data: {
              status: 'SENT',
              sentAt: new Date(),
              providerId: info.messageId,
            },
          })
          .catch(() => {});
      }
    } catch (error: any) {
      this.logger.error(`❌ Email → ${opts.to}`, error);

      if (logId) {
        await this.prisma.communicationLog
          .update({
            where: { id: logId },
            data: {
              status: 'FAILED',
              errorMsg: String(error?.message ?? error),
              retryCount: { increment: 1 },
            },
          })
          .catch(() => {});
      }
      // On ne throw pas pour ne pas casser une transaction critique
    }
  }

  // ========================================================
  // TEMPLATE HTML PRO (responsive, dark-mode safe)
  // ========================================================

  private wrapHtml(
    title: string,
    content: string,
    opts: { brandColor?: string; brandName?: string } = {},
  ): string {
    const brandColor = opts.brandColor ?? '#DC2626';
    const brandName = opts.brandName ?? "Direct Transf'air";

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F4F3EE;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#222;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F4F3EE;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <!-- Header gradient -->
          <tr>
            <td style="background:linear-gradient(135deg,${brandColor} 0%,${this.darken(brandColor)} 100%);padding:28px 32px;text-align:left;">
              <h1 style="margin:0;color:#fff;font-size:18px;font-weight:500;letter-spacing:.3px;">
                ${brandName}
              </h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;color:#1f1f1f;line-height:1.7;font-size:15px;">
              <h2 style="margin:0 0 16px 0;color:${brandColor};font-size:20px;font-weight:500;">${title}</h2>
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background:#FAFAF7;border-top:1px solid #EAEAE5;color:#888;font-size:12px;line-height:1.6;">
              Ceci est un message automatique — merci de ne pas y répondre.<br/>
              © ${new Date().getFullYear()} ${brandName}. Tous droits réservés.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  private darken(hex: string): string {
    // Variante plus sombre pour gradient
    if (!hex.startsWith('#') || hex.length !== 7) return hex;
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 40);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 40);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 40);
    return `#${r.toString(16).padStart(2, '0')}${g
      .toString(16)
      .padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  // ========================================================
  // RAW SEND (sans wrapping HTML — pour intégrations externes)
  // ========================================================

  async sendRaw(to: string, subject: string, html: string, text?: string) {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.MAIL_FROM ?? process.env.MAIL_USER,
        to,
        subject,
        html,
        text,
      });
      this.logger.log(`Raw email → ${to} (${info.messageId})`);
      return info;
    } catch (e) {
      this.logger.error(`Raw email failed → ${to}`, e);
    }
  }
}