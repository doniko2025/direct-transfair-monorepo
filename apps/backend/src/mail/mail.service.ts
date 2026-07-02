// apps/backend/src/mail/mail.service.ts
// =========================================================
// MAIL SERVICE v4.5 — Direct Transf'air
// ✅ v4.4 conservé (provider HTTPS Resend disponible)
// ✅ v4.5 : le provider HTTP (Resend) devient PRINCIPAL
//
//   POURQUOI CE CHANGEMENT :
//   Railway bloque le SMTP sortant (ports 25/465/587/2525) sur les
//   plans Free / Trial / Hobby — disponible uniquement à partir du
//   plan Pro. Peu importe MAIL_SERVICE / MAIL_HOST / la famille IP
//   forcée : sur ces plans, aucune connexion SMTP ne passera jamais,
//   y compris vers Gmail.
//   → https://docs.railway.com/networking/outbound-networking
//
//   Par ailleurs, l'ENETUNREACH observé sur l'adresse IPv6 de Gmail
//   n'était de toute façon pas corrigible via `family: 4` : nodemailer
//   ne lit tout simplement pas cette option dans SMTPConnection
//   (vérifié dans les sources de nodemailer@9.0.3) — elle n'a jamais
//   eu d'effet, ici ou ailleurs.
//
//   FIX v4.5 — On inverse l'ordre de tentative : le provider HTTP
//   (Resend, port 443, jamais bloqué par Railway) est tenté EN
//   PREMIER pour CHAQUE envoi. Le SMTP (Gmail par défaut) passe en
//   second, comme filet de sécurité : il continue de fonctionner en
//   local (le SMTP n'y est pas bloqué) et fonctionnera sur Railway
//   si vous passez un jour au plan Pro — mais l'appli ne dépend plus
//   de lui pour délivrer un email.
//
//   ──────────────────────────────────────────────────────
//   CONFIGURATION RAILWAY (Settings → Variables) — noms INCHANGÉS,
//   aucune variable à renommer :
//
//   ► Provider HTTP — Resend (tenté en premier, marche partout) :
//       MAIL_FALLBACK_PASS = re_xxxxxxxxxxxxxxxx   ← API Key Resend
//       MAIL_FALLBACK_FROM = onboarding@resend.dev  (ou domaine vérifié)
//
//   ► Provider SMTP — Gmail (tenté en second, filet de sécurité) :
//       MAIL_SERVICE = gmail
//       MAIL_USER    = votre@gmail.com
//       MAIL_PASS    = xxxx xxxx xxxx xxxx   ← APP PASSWORD
//       MAIL_FROM    = votre@gmail.com
//       ⚠️ Ne fonctionnera pas sur Railway tant que le plan est en
//          dessous de Pro (SMTP bloqué côté plateforme) — c'est
//          normal, le provider HTTP prend le relais automatiquement.
//   ──────────────────────────────────────────────────────
// =========================================================

import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

// =========================================================
// CURRENCY HELPERS (inchangés)
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

type ProviderName = 'http' | 'smtp';

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class MailService {
  private smtpTransporter: nodemailer.Transporter | null = null;
  private isSmtpReady = false;

  // Le provider HTTP (Resend) n'a pas besoin de "transporter" : un fetch() suffit.
  private isHttpConfigured = false;

  private readonly logger = new Logger(MailService.name);

  private static readonly SMTP_CONNECTION_TIMEOUT_MS = 10_000;
  private static readonly SMTP_GREETING_TIMEOUT_MS   = 10_000;
  private static readonly SMTP_SOCKET_TIMEOUT_MS      = 10_000;
  private static readonly API_TIMEOUT_MS              = 10_000;

  constructor(private readonly prisma: PrismaService) {
    this.initHttpProvider();
    this.initSmtpTransporter();
  }

  // ========================================================
  // ✅ PROVIDER HTTP (Resend) — tenté en premier, marche partout
  // ========================================================

  private initHttpProvider(): void {
    const apiKey = process.env.MAIL_FALLBACK_PASS?.trim();
    const from = (process.env.MAIL_FALLBACK_FROM ?? process.env.MAIL_FALLBACK_USER)?.trim();

    if (!apiKey || !from) {
      this.logger.warn(
        '[MAIL][http] ⚠️ Non configuré (MAIL_FALLBACK_PASS et/ou MAIL_FALLBACK_FROM ' +
        'absents) — aucun envoi possible tant que le SMTP reste bloqué (Railway < plan Pro).',
      );
      return;
    }

    this.isHttpConfigured = true;
    this.logger.log(
      `[MAIL][http] API Resend configurée (from: ${from}) — provider principal, ` +
      `utilisé pour chaque envoi.`,
    );
  }

  private async sendViaResendApi(mailOptions: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ messageId: string }> {
    const apiKey = process.env.MAIL_FALLBACK_PASS?.trim();
    const from = (process.env.MAIL_FALLBACK_FROM ?? process.env.MAIL_FALLBACK_USER)?.trim();

    if (!apiKey || !from) {
      throw new Error('Provider HTTP non configuré (MAIL_FALLBACK_PASS/FROM manquants)');
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(
      () => controller.abort(),
      MailService.API_TIMEOUT_MS,
    );

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [mailOptions.to],
          subject: mailOptions.subject,
          html: mailOptions.html,
          ...(mailOptions.text ? { text: mailOptions.text } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`Resend API ${res.status} : ${errBody || res.statusText}`);
      }

      const data = (await res.json()) as { id?: string };
      return { messageId: data.id ?? 'unknown' };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  // ========================================================
  // ✅ PROVIDER SMTP (Gmail par défaut) — filet de sécurité.
  //    Fonctionne en local. Sur Railway, uniquement à partir du plan
  //    Pro (SMTP bloqué en dessous, quelle que soit la config).
  // ========================================================

  private initSmtpTransporter(): void {
    const user = process.env.MAIL_USER?.trim();
    const pass = (process.env.MAIL_PASS ?? process.env.MAIL_PASSWORD)?.trim();
    const useGmailService = (process.env.MAIL_SERVICE ?? '').toLowerCase() === 'gmail';

    if (!user || !pass) {
      this.logger.warn(
        '[MAIL][smtp] Non configuré — MAIL_USER/MAIL_PASS manquants. ' +
        'Sans impact si le provider HTTP est prêt : il gère déjà tous les envois.',
      );
      return;
    }

    const commonOptions = {
      family: 4, // ⚠️ ignoré par nodemailer@9 (jamais lu par SMTPConnection) — laissé
                 // en place pour rester explicite sur l'intention, sans effet réel.
      connectionTimeout: MailService.SMTP_CONNECTION_TIMEOUT_MS,
      greetingTimeout:   MailService.SMTP_GREETING_TIMEOUT_MS,
      socketTimeout:     MailService.SMTP_SOCKET_TIMEOUT_MS,
    };

    if (useGmailService) {
      this.smtpTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth:    { user, pass },
        ...commonOptions,
      } as any);
      this.logger.log(`[MAIL][smtp] Transporter Gmail créé (${user})`);
    } else {
      const host = process.env.MAIL_HOST;
      const port = Number(process.env.MAIL_PORT) || 587;
      if (!host) {
        this.logger.warn(
          '[MAIL][smtp] MAIL_HOST manquant pour le mode SMTP générique. ' +
          'Définissez MAIL_HOST, ou MAIL_SERVICE=gmail pour utiliser le shortcut Gmail.',
        );
        return;
      }
      this.smtpTransporter = nodemailer.createTransport({
        host,
        port,
        secure: process.env.MAIL_SECURE === 'true',
        auth:   { user, pass },
        ...commonOptions,
      } as any);
      this.logger.log(`[MAIL][smtp] Transporter SMTP créé (${host}:${port})`);
    }

    this.isSmtpReady = true;
    this.verifySmtp();
  }

  private verifySmtp(): void {
    setTimeout(() => {
      if (!this.smtpTransporter) return;
      void this.smtpTransporter
        .verify()
        .then(() => {
          this.logger.log('[MAIL][smtp] ✅ Connexion SMTP vérifiée — opérationnel');
        })
        .catch((err: Error) => {
          this.isSmtpReady = false;
          this.logger.warn(
            `[MAIL][smtp] ❌ Test SMTP échoué : ${err.message}\n` +
            `  → Attendu sur Railway en dessous du plan Pro (SMTP sortant bloqué côté ` +
            `plateforme, quels que soient MAIL_HOST/MAIL_PORT/MAIL_SECURE) : ` +
            `https://docs.railway.com/networking/outbound-networking\n` +
            `  → Le provider HTTP (Resend) prend le relais si configuré. Sinon, ` +
            `vérifiez MAIL_USER / MAIL_PASS, ou passez au plan Pro pour débloquer le SMTP.`,
          );
        });
    }, 3000);
  }

  // ========================================================
  // ✅ Envoi avec double provider : HTTP en premier, SMTP en secours
  // ========================================================

  private async sendMail(
    mailOptions: { to: string; subject: string; html: string; text?: string },
    recipientForLog: string,
  ): Promise<{ messageId: string; usedProvider: ProviderName } | null> {
    // ── Tentative 1 : HTTP (Resend) — jamais bloqué par Railway ────
    if (this.isHttpConfigured) {
      try {
        const result = await this.sendViaResendApi(mailOptions);
        this.logger.log(
          `[MAIL][http] ✉️  Envoyé → ${recipientForLog} (messageId: ${result.messageId})`,
        );
        return { messageId: result.messageId, usedProvider: 'http' };
      } catch (error: any) {
        this.logger.warn(
          `[MAIL][http] ⚠️ Échec → ${recipientForLog} : ${error?.message ?? error} ` +
          `— tentative SMTP...`,
        );
      }
    } else {
      this.logger.warn('[MAIL][http] Non configuré — passage direct au SMTP');
    }

    // ── Tentative 2 : SMTP (Gmail) — filet de sécurité ─────────────
    if (this.isSmtpReady && this.smtpTransporter) {
      try {
        const from = process.env.MAIL_FROM ?? process.env.MAIL_USER;
        const info = await this.smtpTransporter.sendMail({ ...mailOptions, from });
        this.logger.log(
          `[MAIL][smtp] ✉️  Envoyé → ${recipientForLog} (messageId: ${info.messageId})`,
        );
        return { messageId: info.messageId, usedProvider: 'smtp' };
      } catch (error: any) {
        this.logger.error(
          `[MAIL][smtp] ❌ Échec → ${recipientForLog} : ${error?.message ?? error}`,
        );
      }
    } else {
      this.logger.warn('[MAIL][smtp] Non prêt — aucun autre provider disponible');
    }

    this.logger.error(
      `[MAIL] ❌ Échec total (http + smtp) → ${recipientForLog}`,
    );
    return null;
  }

  // ========================================================
  // ENVOI GÉNÉRIQUE (avec log en base) — signature inchangée
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

    if (!this.isHttpConfigured && !this.isSmtpReady) {
      this.logger.warn(
        `[MAIL] ⚠️  Aucun provider prêt — email NON envoyé :\n` +
        `  → Destinataire : ${opts.to}\n` +
        `  → Objet        : ${opts.subject}\n` +
        `  → Action       : configurez MAIL_FALLBACK_PASS + MAIL_FALLBACK_FROM (HTTP, ` +
        `recommandé) et/ou MAIL_USER + MAIL_PASS (SMTP) sur Railway et redéployez.`,
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

    const result = await this.sendMail(
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
            errorMsg:   'Échec http + smtp',
            retryCount: { increment: 1 },
          },
        })
        .catch(() => {});
    }
  }

  // ========================================================
  // TEMPLATE HTML PRO (inchangé)
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
  // RAW SEND — signature inchangée
  // ========================================================

  async sendRaw(to: string, subject: string, html: string, text?: string) {
    if (!this.isHttpConfigured && !this.isSmtpReady) {
      this.logger.warn(
        `[MAIL] ⚠️  sendRaw NON envoyé (aucun provider prêt) → ${to} | ${subject}`,
      );
      return;
    }

    const result = await this.sendMail({ to, subject, html, text }, to);
    return result ? { messageId: result.messageId } : undefined;
  }
}