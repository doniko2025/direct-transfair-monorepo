// apps/backend/src/mail/mail.service.ts
// =========================================================
// MAIL SERVICE v4.3 — Direct Transf'air
// ✅ v4.2 conservé intégralement (IPv4 forcé + timeouts fail-fast)
// ✅ v4.3 : DOUBLE PROVIDER avec fallback automatique
//
//   PROBLÈME RÉSOLU (v4.3) :
//   Gmail peut timeout de façon intermittente depuis Railway
//   (throttling/blocage IP datacenter, cf. v4.2). Plutôt que
//   d'abandonner l'envoi, on retente automatiquement avec un
//   second provider (Resend) avant de déclarer l'échec.
//
//   FIX 6 — transporterPrimary (Gmail) + transporterFallback (Resend)
//     sendEmail()/sendRaw() essaient d'abord le primary.
//     Si échec (catch), tentative automatique sur le fallback,
//     avec log clair indiquant lequel a servi.
//     Le fallback est optionnel : si ses variables ne sont pas
//     configurées, le comportement reste identique à la v4.2
//     (échec silencieux et proprement loggé, sans throw).
//
//   FIX 7 — `as any` sur les options createTransport()
//     Les types nodemailer n'infèrent pas correctement la bonne
//     surcharge quand on fusionne `service`/`host` avec des options
//     SMTP additionnelles (family, timeouts...) via spread.
//     Cast nécessaire pour satisfaire TypeScript ; sans impact
//     runtime, nodemailer ignore les clés qu'il ne reconnaît pas.
//
//   ──────────────────────────────────────────────────────
//   CONFIGURATION RAILWAY (Settings → Variables) :
//
//   ► Provider primaire — Gmail (recommandé, gratuit) :
//       MAIL_SERVICE = gmail
//       MAIL_USER    = votre@gmail.com
//       MAIL_PASS    = xxxx xxxx xxxx xxxx   ← APP PASSWORD
//       MAIL_FROM    = votre@gmail.com
//       ⚠️  App Password ≠ mot de passe Google normal
//       Google Account → Security → 2-Step Verification
//       → App Passwords → "Mail" → Générer
//
//   ► Provider primaire (alternative) — SMTP générique :
//       MAIL_HOST    = smtp.xxx.com
//       MAIL_PORT    = 587
//       MAIL_SECURE  = false
//       MAIL_USER    = ...
//       MAIL_PASS    = ...
//       MAIL_FROM    = ...
//       (ne pas définir MAIL_SERVICE dans ce cas)
//
//   ► Provider fallback — Resend (gratuit, 3000 emails/mois) :
//       MAIL_FALLBACK_HOST   = smtp.resend.com
//       MAIL_FALLBACK_PORT   = 465
//       MAIL_FALLBACK_SECURE = true
//       MAIL_FALLBACK_USER   = resend
//       MAIL_FALLBACK_PASS   = re_xxxxxxxxxxxxxxxx   ← API Key Resend
//       MAIL_FALLBACK_FROM   = noreply@votredomaine.com (ou onboarding@resend.dev)
//       ⚠️ Optionnel : si absent, aucun fallback n'est utilisé,
//          comportement identique à la v4.2.
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

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class MailService {
  // ✅ v4.3 : deux transporters distincts
  private transporterPrimary: nodemailer.Transporter | null = null;
  private transporterFallback: nodemailer.Transporter | null = null;

  private isPrimaryReady = false;
  private isFallbackReady = false;

  private readonly logger = new Logger(MailService.name);

  private static readonly SMTP_CONNECTION_TIMEOUT_MS = 10_000;
  private static readonly SMTP_GREETING_TIMEOUT_MS   = 10_000;
  private static readonly SMTP_SOCKET_TIMEOUT_MS      = 10_000;

  constructor(private readonly prisma: PrismaService) {
    this.initPrimaryTransporter();
    this.initFallbackTransporter();
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

    // ✅ v4.2 : options communes IPv4 + timeouts fail-fast
    const commonOptions = {
      family: 4, // ← force IPv4 : évite ENETUNREACH sur réseaux sans IPv6 sortant
      connectionTimeout: MailService.SMTP_CONNECTION_TIMEOUT_MS,
      greetingTimeout:   MailService.SMTP_GREETING_TIMEOUT_MS,
      socketTimeout:     MailService.SMTP_SOCKET_TIMEOUT_MS,
    };

    if (useGmailService) {
      // ✅ v4.3 FIX 7 : cast `as any` — les types nodemailer n'infèrent pas
      // correctement la surcharge quand on fusionne `service` + options SMTP.
      this.transporterPrimary = nodemailer.createTransport({
        service: 'gmail',
        auth:    { user, pass },
        ...commonOptions,
      } as any);
      this.logger.log(`[MAIL][primary] Transporter Gmail créé (${user}) — IPv4 forcé`);
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
      this.logger.log(`[MAIL][primary] Transporter SMTP créé (${host}:${port}) — IPv4 forcé`);
    }

    this.isPrimaryReady = true;
    this.verifyTransporter('primary');
  }

  // ========================================================
  // ✅ v4.3 — INIT FALLBACK (Resend, optionnel)
  // ========================================================

  private initFallbackTransporter(): void {
    const host = process.env.MAIL_FALLBACK_HOST?.trim();
    const user = process.env.MAIL_FALLBACK_USER?.trim();
    const pass = process.env.MAIL_FALLBACK_PASS?.trim();
    const port = Number(process.env.MAIL_FALLBACK_PORT) || 465;
    const secure = process.env.MAIL_FALLBACK_SECURE !== 'false'; // true par défaut

    if (!host || !user || !pass) {
      this.logger.warn(
        '[MAIL][fallback] ⚠️ Non configuré (MAIL_FALLBACK_HOST/USER/PASS absents) ' +
        '— aucun secours en cas d\'échec du provider primaire.',
      );
      return;
    }

    // ✅ v4.3 FIX 7 : cast `as any` — même raison que le primary
    this.transporterFallback = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      family: 4,
      connectionTimeout: MailService.SMTP_CONNECTION_TIMEOUT_MS,
      greetingTimeout:   MailService.SMTP_GREETING_TIMEOUT_MS,
      socketTimeout:     MailService.SMTP_SOCKET_TIMEOUT_MS,
    } as any);

    this.isFallbackReady = true;
    this.logger.log(`[MAIL][fallback] Transporter créé (${host}:${port}) — IPv4 forcé`);
    this.verifyTransporter('fallback');
  }

  // ========================================================
  // ✅ v4.3 — Vérification SMTP au démarrage (non bloquant)
  // ========================================================

  private verifyTransporter(which: ProviderName): void {
    setTimeout(() => {
      const transporter =
        which === 'primary' ? this.transporterPrimary : this.transporterFallback;
      if (!transporter) return;

      void transporter
        .verify()
        .then(() => {
          this.logger.log(`[MAIL][${which}] ✅ Connexion SMTP vérifiée — opérationnel`);
        })
        .catch((err: Error) => {
          if (which === 'primary') this.isPrimaryReady = false;
          else this.isFallbackReady = false;
          this.logger.error(
            `[MAIL][${which}] ❌ Test SMTP échoué : ${err.message}\n` +
            (which === 'primary'
              ? `  → Gmail : utilisez un App Password, PAS votre mot de passe Google.\n` +
                `       Google Account → Security → 2-Step Verification → App Passwords\n` +
                `  → SMTP : vérifiez MAIL_HOST / MAIL_PORT / MAIL_SECURE sur Railway.\n` +
                `  → Si le fallback (Resend) est configuré, il prendra le relais.`
              : `  → Vérifiez MAIL_FALLBACK_HOST / MAIL_FALLBACK_USER / MAIL_FALLBACK_PASS sur Railway.`),
          );
        });
    }, 3000);
  }

  // ========================================================
  // ✅ v4.3 — Envoi via un transporter donné
  // ========================================================

  private async sendViaTransporter(
    which: ProviderName,
    mailOptions: nodemailer.SendMailOptions,
  ): Promise<nodemailer.SentMessageInfo> {
    const transporter =
      which === 'primary' ? this.transporterPrimary : this.transporterFallback;
    if (!transporter) throw new Error(`Transporter ${which} non initialisé`);

    // Le "from" doit correspondre au provider utilisé
    const from =
      which === 'primary'
        ? (process.env.MAIL_FROM ?? process.env.MAIL_USER)
        : (process.env.MAIL_FALLBACK_FROM ?? process.env.MAIL_FALLBACK_USER);

    return transporter.sendMail({ ...mailOptions, from });
  }

  // ========================================================
  // ✅ v4.3 — Envoi avec fallback automatique
  // ========================================================

  private async sendWithFallback(
    mailOptions: nodemailer.SendMailOptions,
    recipientForLog: string,
  ): Promise<{ info: nodemailer.SentMessageInfo; usedProvider: ProviderName } | null> {
    // ── Tentative 1 : primary ──────────────────────────────
    if (this.isPrimaryReady && this.transporterPrimary) {
      try {
        const info = await this.sendViaTransporter('primary', mailOptions);
        this.logger.log(
          `[MAIL][primary] ✉️  Envoyé → ${recipientForLog} (messageId: ${info.messageId})`,
        );
        return { info, usedProvider: 'primary' };
      } catch (error: any) {
        this.logger.warn(
          `[MAIL][primary] ⚠️ Échec → ${recipientForLog} : ${error?.message ?? error} ` +
          `— tentative fallback...`,
        );
      }
    } else {
      this.logger.warn('[MAIL][primary] Non prêt — passage direct au fallback');
    }

    // ── Tentative 2 : fallback ──────────────────────────────
    if (this.isFallbackReady && this.transporterFallback) {
      try {
        const info = await this.sendViaTransporter('fallback', mailOptions);
        this.logger.log(
          `[MAIL][fallback] ✉️  Envoyé → ${recipientForLog} (messageId: ${info.messageId})`,
        );
        return { info, usedProvider: 'fallback' };
      } catch (error: any) {
        this.logger.error(
          `[MAIL][fallback] ❌ Échec → ${recipientForLog} : ${error?.message ?? error}`,
        );
      }
    }

    // ── Les deux ont échoué (ou ne sont pas configurés) ────
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

    // ✅ v4.3 : skip si aucun des deux providers n'est prêt
    if (!this.isPrimaryReady && !this.isFallbackReady) {
      this.logger.warn(
        `[MAIL] ⚠️  Aucun provider prêt — email NON envoyé :\n` +
        `  → Destinataire : ${opts.to}\n` +
        `  → Objet        : ${opts.subject}\n` +
        `  → Action       : configurez MAIL_USER + MAIL_PASS (primary) et/ou ` +
        `MAIL_FALLBACK_* (fallback) sur Railway et redéployez.`,
      );
      return;
    }

    // ── CommunicationLog (inchangé v4.0) ──────────────────
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

    // ── Envoi avec fallback automatique ────────────────────
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
            providerId:   result.info.messageId,
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
  // RAW SEND — ✅ v4.3 avec fallback automatique
  // ========================================================

  async sendRaw(to: string, subject: string, html: string, text?: string) {
    if (!this.isPrimaryReady && !this.isFallbackReady) {
      this.logger.warn(
        `[MAIL] ⚠️  sendRaw NON envoyé (aucun provider prêt) → ${to} | ${subject}`,
      );
      return;
    }

    const result = await this.sendWithFallback({ to, subject, html, text }, to);
    return result?.info;
  }
}