// apps/backend/src/mail/mail.service.ts
// =========================================================
// MAIL SERVICE v4.4 — Direct Transf'air
// ✅ v4.3 conservé intégralement (double provider, IPv4, timeouts)
// ✅ v4.4 : FALLBACK BASCULÉ EN HTTP API (contourne blocage SMTP)
//
//   PROBLÈME RÉSOLU (v4.4) :
//   Le fallback Resend en SMTP (port 465) timeout systématiquement
//   depuis Railway, alors que Resend est un service fiable. Ça
//   confirme que Railway bloque/restreint les connexions SMTP
//   sortantes sur ce projet — pas un souci spécifique à Gmail.
//
//   FIX 8 — Fallback via l'API REST de Resend (HTTPS, port 443)
//     Au lieu de nodemailer + SMTP pour le fallback, on appelle
//     directement https://api.resend.com/emails en HTTPS classique.
//     Le port 443 n'est quasiment jamais bloqué par les hébergeurs,
//     contrairement aux ports SMTP dédiés (25/465/587).
//     Réutilise MAIL_FALLBACK_PASS comme clé API Resend (re_xxx)
//     et MAIL_FALLBACK_FROM comme expéditeur — aucune nouvelle
//     variable Railway nécessaire.
//     MAIL_FALLBACK_HOST/PORT/SECURE/USER ne sont plus utilisées
//     (laissées sans danger si présentes).
//
//   Le primary (Gmail SMTP) reste inchangé et tenté en premier :
//   s'il fonctionne un jour (réseau Railway débloqué, ou switch
//   vers un autre provider SMTP non bloqué), rien à changer.
//
//   ──────────────────────────────────────────────────────
//   CONFIGURATION RAILWAY (Settings → Variables) :
//
//   ► Provider primaire — Gmail (peut échouer si SMTP bloqué) :
//       MAIL_SERVICE = gmail
//       MAIL_USER    = votre@gmail.com
//       MAIL_PASS    = xxxx xxxx xxxx xxxx   ← APP PASSWORD
//       MAIL_FROM    = votre@gmail.com
//
//   ► Provider fallback — Resend via API HTTP (recommandé, fiable) :
//       MAIL_FALLBACK_PASS = re_xxxxxxxxxxxxxxxx   ← API Key Resend
//       MAIL_FALLBACK_FROM = onboarding@resend.dev (ou domaine vérifié)
//       ⚠️ Régénérez votre clé si elle a été exposée par le passé.
//   ──────────────────────────────────────────────────────
// =========================================================

import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

// =========================================================
// CURRENCY HELPERS (inchangés v4.0)
// =========================================================

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€', USD: '$', GBP: '£', GNF: 'FG', XOF: 'FCFA',
};

const CURRENCY_LOCALES: Record<string, string> = {
  EUR: 'fr-FR', USD: 'en-US', GBP: 'en-GB', GNF: 'fr-GN', XOF: 'fr-SN',
};

export function formatAmount(amount: number | string, currency: string = 'XOF'): string {
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
// TYPES
// =========================================================

export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
  userId?: string;
  transactionId?: string;
  brandColor?: string;
  brandName?: string;
}

type ProviderName = 'primary' | 'fallback';

interface SendResult {
  messageId: string;
  usedProvider: ProviderName;
}

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class MailService {
  // ✅ v4.3 : transporter SMTP pour le primary (Gmail)
  private transporterPrimary: nodemailer.Transporter | null = null;
  private isPrimaryReady = false;

  // ✅ v4.4 : le fallback n'utilise plus SMTP — juste une clé API
  private fallbackApiKey: string | null = null;
  private fallbackFrom: string = 'onboarding@resend.dev';
  private isFallbackReady = false;

  private readonly logger = new Logger(MailService.name);

  private static readonly SMTP_CONNECTION_TIMEOUT_MS = 10_000;
  private static readonly SMTP_GREETING_TIMEOUT_MS   = 10_000;
  private static readonly SMTP_SOCKET_TIMEOUT_MS      = 10_000;
  private static readonly RESEND_API_TIMEOUT_MS       = 10_000;
  private static readonly RESEND_API_URL              = 'https://api.resend.com/emails';

  constructor(private readonly prisma: PrismaService) {
    this.initPrimaryTransporter();
    this.initFallbackApi();
  }

  // ========================================================
  // ✅ v4.3 — INIT PRIMARY (Gmail par défaut, ou SMTP générique)
  // ========================================================

  private initPrimaryTransporter(): void {
    const user = process.env.MAIL_USER?.trim();
    const pass = (process.env.MAIL_PASS ?? process.env.MAIL_PASSWORD)?.trim();
    const useGmailService = (process.env.MAIL_SERVICE ?? '').toLowerCase() === 'gmail';

    if (!user || !pass) {
      this.logger.error(
        '[MAIL][primary] ❌ SMTP non configuré — MAIL_USER/MAIL_PASS manquants.\n' +
        `  Variables manquantes sur Railway :\n` +
        (!user ? `  → MAIL_USER  (ex: votre@gmail.com)\n`               : '') +
        (!pass ? `  → MAIL_PASS  (App Password Gmail ou clé SMTP)\n`     : '') +
        `  → Ajoutez ces variables : Railway → Settings → Variables → Redéployez.`,
      );
      return;
    }

    const commonOptions = {
      family: 4,
      connectionTimeout: MailService.SMTP_CONNECTION_TIMEOUT_MS,
      greetingTimeout:   MailService.SMTP_GREETING_TIMEOUT_MS,
      socketTimeout:     MailService.SMTP_SOCKET_TIMEOUT_MS,
    };

    if (useGmailService) {
      this.transporterPrimary = nodemailer.createTransport({
        service: 'gmail',
        auth:    { user, pass },
        ...commonOptions,
      } as any);
      this.logger.log(`[MAIL][primary] Transporter Gmail créé (${user})`);
    } else {
      const host = process.env.MAIL_HOST;
      const port = Number(process.env.MAIL_PORT) || 587;
      if (!host) {
        this.logger.error(
          '[MAIL][primary] ❌ MAIL_HOST manquant pour le mode SMTP.\n' +
          `  → Définissez MAIL_HOST sur Railway, ou passez en mode Gmail :\n` +
          `     MAIL_SERVICE=gmail`,
        );
        return;
      }
      this.transporterPrimary = nodemailer.createTransport({
        host,
        port,
        secure: process.env.MAIL_SECURE === 'true',
        auth:   { user, pass },
        ...commonOptions,
      } as any);
      this.logger.log(`[MAIL][primary] Transporter SMTP créé (${host}:${port})`);
    }

    this.isPrimaryReady = true;

    // Test de connexion au démarrage (non bloquant)
    setTimeout(() => {
      if (!this.transporterPrimary) return;
      void this.transporterPrimary
        .verify()
        .then(() => {
          this.logger.log('[MAIL][primary] ✅ Connexion SMTP vérifiée — opérationnel');
        })
        .catch((err: Error) => {
          this.isPrimaryReady = false;
          this.logger.error(
            `[MAIL][primary] ❌ Test SMTP échoué : ${err.message}\n` +
            `  → Si l'erreur est un timeout/ENETUNREACH, le réseau sortant ` +
            `bloque probablement le SMTP direct sur ce projet Railway.\n` +
            `  → Le fallback Resend (API HTTP) prendra le relais si configuré.`,
          );
        });
    }, 3000);
  }

  // ========================================================
  // ✅ v4.4 — INIT FALLBACK via l'API HTTP Resend (pas de SMTP)
  // ========================================================

  private initFallbackApi(): void {
    const apiKey = process.env.MAIL_FALLBACK_PASS?.trim();
    const from   = process.env.MAIL_FALLBACK_FROM?.trim();

    if (!apiKey) {
      this.logger.warn(
        '[MAIL][fallback] ⚠️ Non configuré (MAIL_FALLBACK_PASS absente) ' +
        '— aucun secours en cas d\'échec du provider primaire.',
      );
      return;
    }

    this.fallbackApiKey = apiKey;
    if (from) this.fallbackFrom = from;
    this.isFallbackReady = true;

    this.logger.log(
      `[MAIL][fallback] Prêt via API Resend (HTTPS) — from: ${this.fallbackFrom}`,
    );
  }

  // ========================================================
  // ✅ v4.4 — Envoi via l'API HTTP Resend
  // ========================================================

  private async sendViaResendApi(mailOptions: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ messageId: string }> {
    if (!this.fallbackApiKey) {
      throw new Error('Clé API Resend (MAIL_FALLBACK_PASS) manquante');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      MailService.RESEND_API_TIMEOUT_MS,
    );

    try {
      const res = await fetch(MailService.RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.fallbackApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    this.fallbackFrom,
          to:      [mailOptions.to],
          subject: mailOptions.subject,
          html:    mailOptions.html,
          text:    mailOptions.text,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`Resend API ${res.status} : ${errBody || res.statusText}`);
      }

      const data = (await res.json().catch(() => ({}))) as { id?: string };
      return { messageId: data.id ?? 'unknown' };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ========================================================
  // ✅ v4.4 — Envoi avec fallback automatique (SMTP → API HTTP)
  // ========================================================

  private async sendWithFallback(
    mailOptions: { to: string; subject: string; html: string; text?: string },
    recipientForLog: string,
  ): Promise<SendResult | null> {
    // ── Tentative 1 : primary (Gmail SMTP) ─────────────────
    if (this.isPrimaryReady && this.transporterPrimary) {
      try {
        const from = process.env.MAIL_FROM ?? process.env.MAIL_USER;
        const info = await this.transporterPrimary.sendMail({ ...mailOptions, from });
        this.logger.log(
          `[MAIL][primary] ✉️  Envoyé → ${recipientForLog} (messageId: ${info.messageId})`,
        );
        return { messageId: info.messageId, usedProvider: 'primary' };
      } catch (error: any) {
        this.logger.warn(
          `[MAIL][primary] ⚠️ Échec → ${recipientForLog} : ${error?.message ?? error} ` +
          `— tentative fallback (Resend API)...`,
        );
      }
    } else {
      this.logger.warn('[MAIL][primary] Non prêt — passage direct au fallback');
    }

    // ── Tentative 2 : fallback (Resend, API HTTP) ──────────
    if (this.isFallbackReady) {
      try {
        const result = await this.sendViaResendApi(mailOptions);
        this.logger.log(
          `[MAIL][fallback] ✉️  Envoyé via API Resend → ${recipientForLog} ` +
          `(messageId: ${result.messageId})`,
        );
        return { messageId: result.messageId, usedProvider: 'fallback' };
      } catch (error: any) {
        this.logger.error(
          `[MAIL][fallback] ❌ Échec API Resend → ${recipientForLog} : ${error?.message ?? error}`,
        );
      }
    }

    this.logger.error(
      `[MAIL] ❌ Échec total (primary + fallback) → ${recipientForLog}`,
    );
    return null;
  }

  // ========================================================
  // ENVOI GÉNÉRIQUE (avec log en base)
  // ========================================================

  async sendEmail(
    toOrOptions: string | SendEmailOptions,
    subject?: string,
    htmlContent?: string,
  ): Promise<void> {
    const opts: SendEmailOptions =
      typeof toOrOptions === 'string'
        ? { to: toOrOptions, subject: subject ?? '', htmlContent: htmlContent ?? '' }
        : toOrOptions;

    if (!opts.to || !opts.subject) {
      this.logger.warn('[MAIL] Email skip: to/subject manquant');
      return;
    }

    if (!this.isPrimaryReady && !this.isFallbackReady) {
      this.logger.warn(
        `[MAIL] ⚠️  Aucun provider prêt — email NON envoyé :\n` +
        `  → Destinataire : ${opts.to}\n` +
        `  → Objet        : ${opts.subject}\n` +
        `  → Action       : configurez MAIL_USER + MAIL_PASS (primary) et/ou ` +
        `MAIL_FALLBACK_PASS (fallback API Resend) sur Railway et redéployez.`,
      );
      return;
    }

    let logId: string | null = null;
    try {
      const log = await this.prisma.communicationLog.create({
        data: {
          userId:        opts.userId        ?? null,
          transactionId: opts.transactionId ?? null,
          type:          'EMAIL',
          recipient:     opts.to,
          subject:       opts.subject,
          htmlBody:      opts.htmlContent,
          status:        'PENDING',
          providerName:  'nodemailer',
        },
      });
      logId = log.id;
    } catch (e) {
      this.logger.warn('[MAIL] CommunicationLog création échouée', e);
    }

    const result = await this.sendWithFallback(
      {
        to:      opts.to,
        subject: opts.subject,
        html:    this.wrapHtml(opts.subject, opts.htmlContent, {
          brandColor: opts.brandColor,
          brandName:  opts.brandName,
        }),
      },
      opts.to,
    );

    if (!logId) return;

    if (result) {
      await this.prisma.communicationLog
        .update({
          where: { id: logId },
          data: {
            status:       'SENT',
            sentAt:       new Date(),
            providerId:   result.messageId,
            providerName: `nodemailer:${result.usedProvider}`,
          },
        })
        .catch(() => {});
    } else {
      await this.prisma.communicationLog
        .update({
          where: { id: logId },
          data: {
            status:     'FAILED',
            errorMsg:   'Échec primary + fallback',
            retryCount: { increment: 1 },
          },
        })
        .catch(() => {});
    }
  }

  // ========================================================
  // TEMPLATE HTML PRO (inchangé v4.0)
  // ========================================================

  private wrapHtml(
    title:   string,
    content: string,
    opts:    { brandColor?: string; brandName?: string } = {},
  ): string {
    const brandColor = opts.brandColor ?? '#DC2626';
    const brandName  = opts.brandName  ?? "Direct Transf'air";

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
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"
          style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <tr>
            <td style="background:linear-gradient(135deg,${brandColor} 0%,${this.darken(brandColor)} 100%);padding:28px 32px;text-align:left;">
              <h1 style="margin:0;color:#fff;font-size:18px;font-weight:500;letter-spacing:.3px;">
                ${brandName}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#1f1f1f;line-height:1.7;font-size:15px;">
              <h2 style="margin:0 0 16px 0;color:${brandColor};font-size:20px;font-weight:500;">
                ${title}
              </h2>
              ${content}
            </td>
          </tr>
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
</html>`.trim();
  }

  private darken(hex: string): string {
    if (!hex.startsWith('#') || hex.length !== 7) return hex;
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 40);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 40);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 40);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  // ========================================================
  // RAW SEND — ✅ v4.4 avec fallback API HTTP
  // ========================================================

  async sendRaw(to: string, subject: string, html: string, text?: string) {
    if (!this.isPrimaryReady && !this.isFallbackReady) {
      this.logger.warn(
        `[MAIL] ⚠️  sendRaw NON envoyé (aucun provider prêt) → ${to} | ${subject}`,
      );
      return;
    }

    const result = await this.sendWithFallback({ to, subject, html, text }, to);
    return result ? { messageId: result.messageId } : undefined;
  }
}