// apps/backend/src/mail/channels/company-mail.service.ts
// =========================================================
// COMPANY MAIL — Notifications société cliente B2B
// ✅ Multi-devises
// ✅ Trésorerie 5 devises
// ✅ Virements bancaires (déclaration, validation, rejet)
// =========================================================

import { Injectable } from '@nestjs/common';
import { MailService, formatAmount } from '../mail.service';

@Injectable()
export class CompanyMailService {
  constructor(private readonly mailService: MailService) {}

  // ========================================================
  // VIREMENT B2B — Déclaration
  // ========================================================

  async sendB2BRequestSent(params: {
    email: string;
    companyName: string;
    amount: number;
    currency: string;
    ref: string;
    userId?: string;
    brandColor?: string;
    brandName?: string;
  }) {
    const amountText = formatAmount(params.amount, params.currency);

    const html = `
      <p>Bonjour <strong>${params.companyName}</strong>,</p>
      <p>Votre demande de virement B2B a bien été enregistrée.</p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#FEF3C7;border-radius:8px;">
        <tr><td style="color:#92400E;">Montant</td><td style="text-align:right;font-weight:500;color:#92400E;">${amountText}</td></tr>
        <tr><td style="color:#92400E;">Devise</td><td style="text-align:right;font-weight:500;color:#92400E;">${params.currency}</td></tr>
        <tr><td style="color:#92400E;">Référence</td><td style="text-align:right;font-family:monospace;color:#92400E;">${params.ref}</td></tr>
        <tr><td style="color:#92400E;">Statut</td><td style="text-align:right;color:#92400E;">⏳ En attente de validation</td></tr>
      </table>
      <p>Vous serez notifié dès la validation par notre équipe.</p>
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `Virement B2B en cours — ${amountText} ⏳`,
      htmlContent: html,
      userId: params.userId,
      brandColor: params.brandColor,
      brandName: params.brandName,
    });
  }

  // ========================================================
  // VIREMENT B2B — Validé
  // ========================================================

  async sendB2BValidated(params: {
    email: string;
    companyName: string;
    amount: number;
    currency: string;
    ref: string;
    userId?: string;
    brandColor?: string;
    brandName?: string;
  }) {
    const amountText = formatAmount(params.amount, params.currency);

    const html = `
      <p>Bonjour <strong>${params.companyName}</strong>,</p>
      <p>✅ Votre virement de <strong style="color:#15803D;">${amountText}</strong> a été validé et crédité sur votre compte plateforme.</p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#DCFCE7;border-radius:8px;">
        <tr><td style="color:#166534;">Référence</td><td style="text-align:right;font-family:monospace;color:#166534;">${params.ref}</td></tr>
      </table>
      <p>Merci pour votre collaboration.</p>
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `Virement B2B validé ✅`,
      htmlContent: html,
      userId: params.userId,
      brandColor: params.brandColor,
      brandName: params.brandName,
    });
  }

  // ========================================================
  // VIREMENT B2B — Rejeté
  // ========================================================

  async sendB2BRejected(params: {
    email: string;
    companyName: string;
    amount: number;
    currency: string;
    ref: string;
    reason?: string;
    userId?: string;
  }) {
    const amountText = formatAmount(params.amount, params.currency);

    const html = `
      <p>Bonjour <strong>${params.companyName}</strong>,</p>
      <p>Nous sommes au regret de vous informer que votre virement de <strong>${amountText}</strong> a été rejeté.</p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#FEE2E2;border-radius:8px;">
        <tr><td style="color:#991B1B;">Référence</td><td style="text-align:right;font-family:monospace;color:#991B1B;">${params.ref}</td></tr>
        ${params.reason ? `<tr><td style="color:#991B1B;">Motif</td><td style="text-align:right;color:#991B1B;">${params.reason}</td></tr>` : ''}
      </table>
      <p>Pour plus d'informations, contactez notre support.</p>
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `Virement B2B rejeté ❌`,
      htmlContent: html,
      userId: params.userId,
    });
  }

  // ========================================================
  // RECHARGEMENT REÇU
  // ========================================================

  async sendRefillReceived(params: {
    email: string;
    companyName: string;
    amount: number;
    currency: string;
    newBalance: number;
    userId?: string;
    brandColor?: string;
    brandName?: string;
  }) {
    const amountText = formatAmount(params.amount, params.currency);
    const balanceText = formatAmount(params.newBalance, params.currency);

    const html = `
      <p>Bonjour <strong>${params.companyName}</strong>,</p>
      <p>Votre compte vient d'être rechargé de <strong>${amountText}</strong>.</p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#DCFCE7;border-radius:8px;">
        <tr><td style="color:#166534;">Devise</td><td style="text-align:right;font-weight:500;color:#166534;">${params.currency}</td></tr>
        <tr><td style="color:#166534;">Nouveau solde</td><td style="text-align:right;font-weight:500;color:#166534;font-size:18px;">${balanceText}</td></tr>
      </table>
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `Rechargement reçu — ${amountText} 🔋`,
      htmlContent: html,
      userId: params.userId,
      brandColor: params.brandColor,
      brandName: params.brandName,
    });
  }

  // ========================================================
  // RAPPORT QUOTIDIEN TRÉSORERIE (5 devises)
  // ========================================================

  async sendDailyTreasuryReport(params: {
    email: string;
    companyName: string;
    date: Date;
    snapshots: Array<{
      currency: string;
      totalSent: number;
      totalReceived: number;
      totalFees: number;
      transactionCount: number;
      closingBalance: number;
    }>;
    userId?: string;
    brandColor?: string;
    brandName?: string;
  }) {
    const dateText = params.date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const rows = params.snapshots
      .map(
        (s) => `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #EAEAE5;font-weight:500;">${s.currency}</td>
          <td style="padding:10px;border-bottom:1px solid #EAEAE5;text-align:right;">${formatAmount(s.totalSent, s.currency)}</td>
          <td style="padding:10px;border-bottom:1px solid #EAEAE5;text-align:right;">${formatAmount(s.totalReceived, s.currency)}</td>
          <td style="padding:10px;border-bottom:1px solid #EAEAE5;text-align:right;color:#15803D;">${formatAmount(s.totalFees, s.currency)}</td>
          <td style="padding:10px;border-bottom:1px solid #EAEAE5;text-align:right;">${s.transactionCount}</td>
          <td style="padding:10px;border-bottom:1px solid #EAEAE5;text-align:right;font-weight:500;">${formatAmount(s.closingBalance, s.currency)}</td>
        </tr>
      `,
      )
      .join('');

    const html = `
      <p>Bonjour <strong>${params.companyName}</strong>,</p>
      <p>Voici votre rapport de trésorerie pour le <strong>${dateText}</strong>.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;border-collapse:collapse;">
        <thead>
          <tr style="background:#F4F3EE;">
            <th style="padding:10px;text-align:left;font-size:12px;color:#666;">Devise</th>
            <th style="padding:10px;text-align:right;font-size:12px;color:#666;">Envoyé</th>
            <th style="padding:10px;text-align:right;font-size:12px;color:#666;">Reçu</th>
            <th style="padding:10px;text-align:right;font-size:12px;color:#666;">Frais</th>
            <th style="padding:10px;text-align:right;font-size:12px;color:#666;">Tx</th>
            <th style="padding:10px;text-align:right;font-size:12px;color:#666;">Solde</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p>Connectez-vous au dashboard pour plus de détails.</p>
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `Trésorerie du ${dateText} 📊`,
      htmlContent: html,
      userId: params.userId,
      brandColor: params.brandColor,
      brandName: params.brandName,
    });
  }

  // ========================================================
  // ABONNEMENT — Expiration imminente
  // ========================================================

  async sendSubscriptionExpiring(params: {
    email: string;
    companyName: string;
    expiresAt: Date;
    daysLeft: number;
    userId?: string;
  }) {
    const expiryText = params.expiresAt.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const html = `
      <p>Bonjour <strong>${params.companyName}</strong>,</p>
      <p>Votre abonnement expire dans <strong style="color:#DC2626;">${params.daysLeft} jour${params.daysLeft > 1 ? 's' : ''}</strong> (${expiryText}).</p>
      <p>Pour éviter toute interruption de service, pensez à renouveler dès maintenant.</p>
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `Abonnement bientôt expiré — ${params.daysLeft}j restants ⏰`,
      htmlContent: html,
      userId: params.userId,
    });
  }
  // ========================================================
// ✅ WELCOME EMAIL — Bienvenue nouveau COMPANY_ADMIN
// Email envoyé automatiquement après la création d'une société
// Design : HTML complet (bypass wrapHtml pour contrôle total)
// ========================================================

async sendWelcomeCompanyAdmin(params: {
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  companyCode: string;
  temporaryPassword: string;
  userId?: string;
}) {
  const initial = (params.companyName?.[0] ?? 'C').toUpperCase();
  const year    = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Bienvenue chez Transf'Air International</title>
</head>
<body style="margin:0;padding:0;background:#EEF2FF;font-family:'Segoe UI',Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF2FF;padding:32px 16px;">
<tr><td align="center">

<table width="600" cellpadding="0" cellspacing="0" border="0"
  style="max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden;
         box-shadow:0 20px 60px rgba(25,86,240,0.14);">

  <!-- ═══ HERO GRADIENT ═══ -->
  <tr>
    <td style="background:linear-gradient(145deg,#0C2D8A 0%,#1240D6 40%,#1956F0 70%,#4B72FF 100%);
               padding:50px 36px 68px;text-align:center;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding-bottom:22px;">
            <span style="display:inline-block;background:rgba(255,255,255,0.15);
                         border:1.5px solid rgba(255,255,255,0.3);border-radius:50px;
                         padding:7px 22px;font-size:11px;font-weight:800;
                         color:rgba(255,255,255,0.9);letter-spacing:2.5px;">
              DIRECT TRANSF'AIR INTERNATIONAL
            </span>
          </td>
        </tr>
        <tr>
          <td align="center" style="font-size:44px;line-height:1;padding-bottom:18px;">
            🎊&nbsp;&nbsp;🎉&nbsp;&nbsp;🥳
          </td>
        </tr>
        <tr>
          <td align="center">
            <h1 style="margin:0 0 10px;color:#ffffff;font-size:36px;font-weight:800;
                        line-height:1.2;letter-spacing:-1px;">Félicitations !</h1>
            <p style="margin:0;color:rgba(255,255,255,0.82);font-size:17px;
                      font-weight:400;line-height:1.5;">
              Votre espace professionnel est officiellement actif 🚀
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ COMPANY CARD (chevauchement héro) ═══ -->
  <tr>
    <td style="background:#ffffff;padding:0 32px;">
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:linear-gradient(135deg,#F0F4FF,#EEF2FF);
               border:1.5px solid #C7D5FF;border-radius:20px;margin-top:-40px;">
        <tr>
          <td style="padding:26px;text-align:center;">
            <table cellpadding="0" cellspacing="0" align="center" style="margin-bottom:14px;">
              <tr>
                <td style="width:68px;height:68px;
                           background:linear-gradient(135deg,#1240D6,#1956F0);
                           border-radius:20px;text-align:center;vertical-align:middle;">
                  <span style="font-size:30px;font-weight:900;color:#ffffff;line-height:68px;">
                    ${initial}
                  </span>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 10px;font-size:22px;font-weight:800;color:#0F172A;">
              ${params.companyName}
            </p>
            <span style="display:inline-block;background:#1956F0;color:#ffffff;
                         font-size:11px;font-weight:900;letter-spacing:2px;
                         padding:5px 16px;border-radius:7px;font-family:monospace;">
              ${params.companyCode}
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ MESSAGE DE BIENVENUE ═══ -->
  <tr>
    <td style="background:#ffffff;padding:34px 36px 0;">
      <p style="margin:0 0 14px;font-size:18px;color:#0F172A;font-weight:400;line-height:1.6;">
        Bonjour <strong>${params.firstName} ${params.lastName}</strong>,
      </p>
      <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.9;">
        Nous sommes ravis de vous accueillir dans la famille
        <strong>Direct Transf'Air International</strong> ! 🌍<br/>
        Votre société <strong style="color:#1956F0;">${params.companyName}</strong>
        est désormais <strong>enregistrée et pleinement opérationnelle</strong>
        sur notre plateforme SaaS de transfert de fonds international.
      </p>
      <p style="margin:0;font-size:15px;color:#374151;line-height:1.9;">
        Votre espace est prêt. Vous pouvez dès maintenant configurer votre réseau d'agences,
        constituer vos équipes et commencer à traiter vos premières opérations.
      </p>
    </td>
  </tr>

  <!-- ═══ FONCTIONNALITÉS ═══ -->
  <tr>
    <td style="background:#ffffff;padding:28px 36px 0;">

      <!-- Label section -->
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#F8FAFF;border-left:4px solid #1956F0;
               border-radius:0 10px 10px 0;margin-bottom:22px;">
        <tr>
          <td style="padding:14px 20px;">
            <span style="font-size:12px;font-weight:900;color:#1956F0;letter-spacing:1.5px;">
              ✦ CE QUE VOUS POUVEZ FAIRE DÈS MAINTENANT
            </span>
          </td>
        </tr>
      </table>

      <!-- Grille 2×3 -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <!-- Ligne 1 -->
        <tr>
          <td width="49%" style="padding:0 4px 8px 0;vertical-align:top;">
            <table width="100%" cellpadding="16" cellspacing="0"
              style="background:#F0FDF4;border:1px solid #A7F3D0;border-radius:14px;">
              <tr><td>
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="font-size:22px;padding-right:10px;">🏢</td>
                  <td style="font-size:13px;font-weight:800;color:#16A34A;">Créer vos agences</td>
                </tr></table>
                <p style="margin:8px 0 0;font-size:12px;color:#4B7A59;line-height:1.65;">
                  Ouvrez des points de vente physiques et agences partenaires en quelques clics,
                  où que vous soyez dans le monde
                </p>
              </td></tr>
            </table>
          </td>
          <td width="49%" style="padding:0 0 8px 4px;vertical-align:top;">
            <table width="100%" cellpadding="16" cellspacing="0"
              style="background:#EEF2FF;border:1px solid #C7D5FF;border-radius:14px;">
              <tr><td>
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="font-size:22px;padding-right:10px;">👥</td>
                  <td style="font-size:13px;font-weight:800;color:#1956F0;">Gérer vos agents</td>
                </tr></table>
                <p style="margin:8px 0 0;font-size:12px;color:#4B5FAA;line-height:1.65;">
                  Ajoutez vos collaborateurs, définissez leurs rôles et gérez leurs accès
                  à chaque agence en toute autonomie
                </p>
              </td></tr>
            </table>
          </td>
        </tr>
        <!-- Ligne 2 -->
        <tr>
          <td width="49%" style="padding:0 4px 8px 0;vertical-align:top;">
            <table width="100%" cellpadding="16" cellspacing="0"
              style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:14px;">
              <tr><td>
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="font-size:22px;padding-right:10px;">💸</td>
                  <td style="font-size:13px;font-weight:800;color:#D97706;">Transferts internationaux</td>
                </tr></table>
                <p style="margin:8px 0 0;font-size:12px;color:#8B6A2A;line-height:1.65;">
                  Envoyez de l'argent partout dans le monde, rapidement, à faibles coûts
                  et en toute sécurité
                </p>
              </td></tr>
            </table>
          </td>
          <td width="49%" style="padding:0 0 8px 4px;vertical-align:top;">
            <table width="100%" cellpadding="16" cellspacing="0"
              style="background:#FDF4FF;border:1px solid #E9D5FF;border-radius:14px;">
              <tr><td>
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="font-size:22px;padding-right:10px;">📊</td>
                  <td style="font-size:13px;font-weight:800;color:#7C3AED;">Tableau de bord</td>
                </tr></table>
                <p style="margin:8px 0 0;font-size:12px;color:#5B2D9E;line-height:1.65;">
                  Suivez vos transactions et performances en temps réel grâce à des
                  graphiques et rapports détaillés
                </p>
              </td></tr>
            </table>
          </td>
        </tr>
        <!-- Ligne 3 -->
        <tr>
          <td width="49%" style="padding:0 4px 0 0;vertical-align:top;">
            <table width="100%" cellpadding="16" cellspacing="0"
              style="background:#F0FDFA;border:1px solid #99F6E4;border-radius:14px;">
              <tr><td>
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="font-size:22px;padding-right:10px;">💳</td>
                  <td style="font-size:13px;font-weight:800;color:#0F766E;">Wallets multi-devises</td>
                </tr></table>
                <p style="margin:8px 0 0;font-size:12px;color:#0F5C55;line-height:1.65;">
                  Gérez vos fonds en XOF, EUR, USD, GNF et GBP depuis une interface
                  unifiée et intuitive
                </p>
              </td></tr>
            </table>
          </td>
          <td width="49%" style="padding:0 0 0 4px;vertical-align:top;">
            <table width="100%" cellpadding="16" cellspacing="0"
              style="background:#FFF1F2;border:1px solid #FECDD3;border-radius:14px;">
              <tr><td>
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="font-size:22px;padding-right:10px;">🛡️</td>
                  <td style="font-size:13px;font-weight:800;color:#E11D48;">Sécurité renforcée</td>
                </tr></table>
                <p style="margin:8px 0 0;font-size:12px;color:#9B1C42;line-height:1.65;">
                  KYC intégré, codes OTP, authentification 2FA — vos données et celles de
                  vos clients toujours protégées
                </p>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ CARTE IDENTIFIANTS (dark) ═══ -->
  <tr>
    <td style="background:#ffffff;padding:28px 36px 0;">
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:linear-gradient(140deg,#0C1020 0%,#111827 60%,#0F172A 100%);
               border-radius:20px;">
        <tr>
          <td style="padding:30px 32px;">

            <p style="margin:0 0 22px;font-size:11px;font-weight:900;
                      color:#4B5563;letter-spacing:2.5px;">
              🔐 VOS IDENTIFIANTS DE CONNEXION
            </p>

            <!-- Email -->
            <table width="100%" cellpadding="14" cellspacing="0"
              style="background:rgba(255,255,255,0.06);border-radius:12px;margin-bottom:12px;">
              <tr><td>
                <p style="margin:0 0 5px;font-size:10px;font-weight:700;
                          color:#6B7280;letter-spacing:1px;text-transform:uppercase;">
                  Email de connexion
                </p>
                <p style="margin:0;font-size:15px;font-weight:700;
                          color:#E2E8F0;font-family:monospace;">${params.email}</p>
              </td></tr>
            </table>

            <!-- Mot de passe (mis en avant) -->
            <table width="100%" cellpadding="18" cellspacing="0"
              style="background:rgba(25,86,240,0.18);
                     border:1.5px solid rgba(25,86,240,0.5);
                     border-radius:14px;margin-bottom:14px;">
              <tr><td>
                <p style="margin:0 0 8px;font-size:10px;font-weight:700;
                          color:#93C5FD;letter-spacing:1px;text-transform:uppercase;">
                  Mot de passe provisoire
                </p>
                <p style="margin:0;font-size:28px;font-weight:900;
                          color:#60A5FA;font-family:monospace;letter-spacing:4px;">
                  ${params.temporaryPassword}
                </p>
              </td></tr>
            </table>

            <!-- Avertissement -->
            <table width="100%" cellpadding="12" cellspacing="0"
              style="background:rgba(245,158,11,0.12);
                     border:1px solid rgba(245,158,11,0.35);
                     border-radius:10px;">
              <tr><td>
                <p style="margin:0;font-size:12px;color:#FCD34D;line-height:1.65;">
                  ⚠️ Pour votre sécurité, veuillez modifier ce mot de passe dès votre
                  première connexion.
                </p>
              </td></tr>
            </table>

          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ TÉLÉCHARGEMENT ═══ -->
  <tr>
    <td style="background:#ffffff;padding:28px 36px 0;text-align:center;">
      <p style="margin:0 0 18px;font-size:14px;font-weight:700;color:#374151;">
        📱 Téléchargez votre application mobile :
      </p>
      <table align="center" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:0 6px 0 0;">
            <a href="https://play.google.com/store"
               style="display:block;text-decoration:none;background:#0F172A;
                      border-radius:14px;padding:14px 22px;text-align:center;
                      min-width:130px;">
              <p style="margin:0 0 2px;font-size:20px;">▶</p>
              <p style="margin:0 0 2px;font-size:10px;color:#9CA3AF;font-weight:600;">
                Télécharger sur
              </p>
              <p style="margin:0;font-size:15px;color:#ffffff;font-weight:800;">
                Google Play
              </p>
            </a>
          </td>
          <td style="padding:0 0 0 6px;">
            <a href="https://apps.apple.com"
               style="display:block;text-decoration:none;background:#0F172A;
                      border-radius:14px;padding:14px 22px;text-align:center;
                      min-width:130px;">
              <p style="margin:0 0 2px;font-size:20px;">🍎</p>
              <p style="margin:0 0 2px;font-size:10px;color:#9CA3AF;font-weight:600;">
                Disponible sur
              </p>
              <p style="margin:0;font-size:15px;color:#ffffff;font-weight:800;">
                App Store
              </p>
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ BOUTON ACCÈS WEB ═══ -->
  <tr>
    <td style="background:#ffffff;padding:24px 36px 0;text-align:center;">
      <p style="margin:0 0 16px;font-size:13px;color:#6B7280;font-weight:500;">
        Ou connectez-vous directement depuis votre navigateur :
      </p>
      <a href="https://app.direct-transfair.com"
         style="display:inline-block;
                background:linear-gradient(135deg,#1240D6,#1956F0);
                color:#ffffff;text-decoration:none;border-radius:14px;
                padding:16px 44px;font-size:15px;font-weight:800;letter-spacing:0.3px;">
        Accéder à mon espace professionnel →
      </a>
      <p style="margin:10px 0 0;font-size:11px;color:#94A3B8;font-family:monospace;">
        https://app.direct-transfair.com
      </p>
    </td>
  </tr>

  <!-- ═══ SÉPARATEUR ═══ -->
  <tr>
    <td style="background:#ffffff;padding:28px 36px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="border-top:1px solid #E5E7EB;height:1px;line-height:1px;">&nbsp;</td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ SUPPORT ═══ -->
  <tr>
    <td style="background:#ffffff;padding:0 36px 28px;">
      <table width="100%" cellpadding="20" cellspacing="0"
        style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;">
        <tr>
          <td style="text-align:center;">
            <p style="margin:0 0 10px;font-size:14px;font-weight:800;color:#0F172A;">
              Une question ? Notre équipe est là pour vous 💬
            </p>
            <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.8;">
              📧 <a href="mailto:support@direct-transfair.com"
                    style="color:#1956F0;text-decoration:none;font-weight:600;">
                support@direct-transfair.com
              </a><br/>
              🌐 <a href="https://www.direct-transfair.com"
                    style="color:#1956F0;text-decoration:none;font-weight:600;">
                www.direct-transfair.com
              </a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ FOOTER ═══ -->
  <tr>
    <td style="background:linear-gradient(135deg,#0C1020,#111827);
               padding:28px 36px;text-align:center;border-radius:0 0 24px 24px;">
      <p style="margin:0 0 10px;color:rgba(255,255,255,0.88);font-size:14px;font-weight:700;">
        Direct Transf'Air International
      </p>
      <p style="margin:0 0 14px;color:#4B5563;font-size:11px;line-height:1.75;">
        Ce message a été envoyé automatiquement suite à la création de votre espace société.<br/>
        Merci de ne pas répondre directement à cet email.
      </p>
      <p style="margin:0;color:#374151;font-size:11px;">
        © ${year} Direct Transf'Air International. Tous droits réservés.
      </p>
    </td>
  </tr>

</table>

</td></tr>
</table>

</body>
</html>`;

  // sendRaw = HTML complet sans le wrapHtml() de base
  await this.mailService.sendRaw(
    params.email,
    `🎉 Bienvenue chez Transf'Air — ${params.companyName} est officiellement active !`,
    html,
  );
}
}