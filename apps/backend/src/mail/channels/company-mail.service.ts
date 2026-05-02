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
}