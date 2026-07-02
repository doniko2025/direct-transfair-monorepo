// apps/backend/src/mail/mail.service.ts
// =========================================================
// MAIL SERVICE v4.2 — Direct Transf'air
// ✅ v4.0 conservé intégralement
// ✅ v4.1 conservé intégralement (diagnostic SMTP au démarrage)
// ✅ v4.2 : FIX IPv6 (ENETUNREACH) + timeouts fail-fast
//
//   PROBLÈME RÉSOLU (v4.2) :
//   En prod (Railway), le transporter Gmail tentait de résoudre
//   smtp.gmail.com en IPv6 (ex: 2a00:1450:4025:401::6c:587), mais
//   le réseau sortant de Railway ne route pas correctement l'IPv6
//   → connect ENETUNREACH → isReady repasse à false → aucun email
//   n'est envoyé, malgré des credentials MAIL_USER/MAIL_PASS valides.
//
//   Pire : comme sendEmail() est await-é dans le flux de login
//   (dispatchVerificationOtps → sendOtpInternal), une tentative de
//   connexion SMTP qui traîne bloque toute la requête HTTP appelante
//   jusqu'au timeout client (30s côté mobile) — même si l'email
//   finit par échouer proprement côté serveur.
//
//   FIX 4 — family: 4 forcé sur les deux transporters
//     Force la résolution DNS en IPv4 uniquement, évite ENETUNREACH
//     sur les réseaux qui ne routent pas l'IPv6 sortant.
//     ⚠️ Complément recommandé (hors code) : variable Railway
//        NODE_OPTIONS=--dns-result-order=ipv4first
//        (protège aussi les autres appels réseau de l'app)
//
//   FIX 5 — Timeouts SMTP explicites (fail-fast)
//     AVANT : timeouts par défaut de nodemailer/socket pouvaient
//     laisser une tentative de connexion traîner plusieurs dizaines
//     de secondes en cas d'incident réseau, bloquant l'appelant.
//     APRÈS : connectionTimeout/greetingTimeout/socketTimeout à 10s
//     → en cas de souci réseau, sendEmail() échoue vite et proprement
//     (catch interne, ne throw jamais) au lieu de faire attendre
//     l'utilisateur jusqu'au timeout du client mobile.
//
//   ──────────────────────────────────────────────────────
//   CONFIGURATION RAILWAY (Settings → Variables) :
//
//   ► Option Gmail (recommandé, gratuit) :
//       MAIL_SERVICE = gmail
//       MAIL_USER    = votre@gmail.com
//       MAIL_PASS    = xxxx xxxx xxxx xxxx   ← APP PASSWORD
//       MAIL_FROM    = votre@gmail.com
//       ⚠️  App Password ≠ mot de passe Google normal
//       Google Account → Security → 2-Step Verification
//       → App Passwords → "Mail" → Générer
//
//   ► Option Resend (gratuit, 3000 emails/mois) :
//       MAIL_HOST    = smtp.resend.com
//       MAIL_PORT    = 465
//       MAIL_SECURE  = true
//       MAIL_USER    = resend
//       MAIL_PASS    = re_xxxxxxxxxxxxxxxx   ← API Key Resend
//       MAIL_FROM    = noreply@votredomaine.com
//
//   ► Option Brevo / Mailgun / etc — même structure SMTP
//
//   ► Recommandé en complément (Railway → Variables) :
//       NODE_OPTIONS = --dns-result-order=ipv4first
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

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class MailService {
  // ✅ v4.1 : null si non configuré, pour éviter les crashes
  private transporter: nodemailer.Transporter | null = null;
  // ✅ v4.1 : false tant que credentials non vérifiés
  private isReady = false;
  private readonly logger = new Logger(MailService.name);

  // ✅ v4.2 : timeouts SMTP fail-fast (évite de bloquer l'appelant)
  private static readonly SMTP_CONNECTION_TIMEOUT_MS = 10_000;
  private static readonly SMTP_GREETING_TIMEOUT_MS   = 10_000;
  private static readonly SMTP_SOCKET_TIMEOUT_MS      = 10_000;

  constructor(private readonly prisma: PrismaService) {
    // ✅ v4.1 : init déplacé dans une méthode dédiée pour clarté
    this.initTransporter();
  }

  // ========================================================
  // ✅ v4.1 — INIT TRANSPORTER avec validation + verify()
  // ✅ v4.2 — family: 4 (IPv4 forcé) + timeouts fail-fast
  // ========================================================

  private initTransporter(): void {
    const user = process.env.MAIL_USER?.trim();
    const pass = (process.env.MAIL_PASS ?? process.env.MAIL_PASSWORD)?.trim();
    const useGmailService = (process.env.MAIL_SERVICE ?? '').toLowerCase() === 'gmail';

    // ── FIX 1 : Credentials obligatoires ──────────────────
    if (!user || !pass) {
      this.logger.error(
        '[MAIL] ❌ SMTP non configuré — AUCUN EMAIL ne sera envoyé.\n' +
        `  Variables manquantes sur Railway :\n` +
        (!user ? `  → MAIL_USER  (ex: votre@gmail.com)\n`               : '') +
        (!pass ? `  → MAIL_PASS  (App Password Gmail ou clé SMTP)\n`     : '') +
        `  → Ajoutez ces variables : Railway → Settings → Variables → Redéployez.`,
      );
      return; // isReady reste false, transporter reste null
    }

    // ✅ v4.2 : options communes IPv4 + timeouts, appliquées aux deux modes
    const commonTransportOptions = {
      family: 4, // ← force IPv4 : évite ENETUNREACH sur réseaux sans IPv6 sortant (Railway)
      connectionTimeout: MailService.SMTP_CONNECTION_TIMEOUT_MS,
      greetingTimeout:   MailService.SMTP_GREETING_TIMEOUT_MS,
      socketTimeout:     MailService.SMTP_SOCKET_TIMEOUT_MS,
    };

    // ── Création du transporter ────────────────────────────
    if (useGmailService) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth:    { user, pass },
        ...commonTransportOptions,
      });
      this.logger.log(`[MAIL] Transporter Gmail créé (${user}) — IPv4 forcé`);
    } else {
      const host = process.env.MAIL_HOST;
      const port = Number(process.env.MAIL_PORT) || 587;
      if (!host) {
        this.logger.error(
          '[MAIL] ❌ MAIL_HOST manquant pour le mode SMTP.\n' +
          `  → Définissez MAIL_HOST sur Railway, ou passez en mode Gmail :\n` +
          `     MAIL_SERVICE=gmail`,
        );
        return;
      }
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: process.env.MAIL_SECURE === 'true',
        auth:   { user, pass },
        ...commonTransportOptions,
      });
      this.logger.log(`[MAIL] Transporter SMTP créé (${host}:${port}) — IPv4 forcé`);
    }

    this.isReady = true;

    // ── FIX 2 : Test de connexion SMTP au démarrage ────────
    // Délai 3s pour laisser NestJS finir son boot sans bloquer
    setTimeout(() => {
      void this.transporter!
        .verify()
        .then(() => {
          this.logger.log('[MAIL] ✅ Connexion SMTP vérifiée — emails opérationnels');
        })
        .catch((err: Error) => {
          this.isReady = false;
          this.logger.error(
            `[MAIL] ❌ Test SMTP échoué : ${err.message}\n` +
            `  → Gmail : utilisez un App Password, PAS votre mot de passe Google.\n` +
            `       Google Account → Security → 2-Step Verification → App Passwords\n` +
            `  → SMTP : vérifiez MAIL_HOST / MAIL_PORT / MAIL_SECURE sur Railway.\n` +
            `  → Réseau : si l'erreur mentionne ENETUNREACH avec une adresse IPv6 ` +
            `(ex: 2a00:...), le family:4 aurait dû l'empêcher — vérifiez que ce ` +
            `déploiement inclut bien le correctif v4.2.`,
          );
        });
    }, 3000);
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

    // ✅ v4.1 : Skip propre si SMTP non configuré ou test échoué
    if (!this.isReady || !this.transporter) {
      this.logger.warn(
        `[MAIL] ⚠️  Email NON envoyé (SMTP non prêt) :\n` +
        `  → Destinataire : ${opts.to}\n` +
        `  → Objet        : ${opts.subject}\n` +
        `  → Action       : configurez MAIL_USER + MAIL_PASS sur Railway et redéployez.`,
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

    try {
      const info = await this.transporter.sendMail({
        from:    process.env.MAIL_FROM ?? process.env.MAIL_USER,
        to:      opts.to,
        subject: opts.subject,
        html:    this.wrapHtml(opts.subject, opts.htmlContent, {
          brandColor: opts.brandColor,
          brandName:  opts.brandName,
        }),
      });

      this.logger.log(`[MAIL] ✉️  Envoyé → ${opts.to} (messageId: ${info.messageId})`);

      if (logId) {
        await this.prisma.communicationLog
          .update({
            where: { id: logId },
            data:  { status: 'SENT', sentAt: new Date(), providerId: info.messageId },
          })
          .catch(() => {});
      }
    } catch (error: any) {
      // ✅ v4.1 : FIX 3 — message d'erreur inclus dans le log Railway
      this.logger.error(
        `[MAIL] ❌ Échec envoi → ${opts.to} : ${error?.message ?? String(error)}`,
      );

      if (logId) {
        await this.prisma.communicationLog
          .update({
            where: { id: logId },
            data:  {
              status:     'FAILED',
              errorMsg:   String(error?.message ?? error),
              retryCount: { increment: 1 },
            },
          })
          .catch(() => {});
      }
      // On ne throw pas — comportement v4.0 conservé
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
  // RAW SEND — ✅ v4.1 : isReady check ajouté
  // ========================================================

  async sendRaw(to: string, subject: string, html: string, text?: string) {
    // ✅ v4.1 : même garde que sendEmail()
    if (!this.isReady || !this.transporter) {
      this.logger.warn(
        `[MAIL] ⚠️  sendRaw NON envoyé (SMTP non prêt) → ${to} | ${subject}`,
      );
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: process.env.MAIL_FROM ?? process.env.MAIL_USER,
        to,
        subject,
        html,
        text,
      });
      this.logger.log(`[MAIL] Raw email → ${to} (${info.messageId})`);
      return info;
    } catch (e: any) {
      this.logger.error(`[MAIL] ❌ sendRaw échoué → ${to} : ${e?.message ?? e}`);
    }
  }
}