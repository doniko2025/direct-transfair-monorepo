// apps/backend/src/mail/channels/wallet-mail.service.ts
// =========================================================
// WALLET MAIL — Notifications transferts client final
// ✅ Multi-devises avec formatage auto
// ✅ Templates pour tous les flows (envoi, réception, retrait…)
// =========================================================

import { Injectable } from '@nestjs/common';
import { MailService, formatAmount } from '../mail.service';

@Injectable()
export class WalletMailService {
  constructor(private readonly mailService: MailService) {}

  // ========================================================
  // ENVOI D'ARGENT
  // ========================================================

  async sendTransferConfirmation(params: {
    email: string;
    senderFirstName: string;
    recipientName: string;
    amount: number;
    currency: string;
    receivedAmount?: number;
    targetCurrency?: string;
    fees?: number;
    txRef: string;
    pickupCode?: string;
    userId?: string;
    transactionId?: string;
    brandColor?: string;
    brandName?: string;
  }) {
    const sentText = formatAmount(params.amount, params.currency);
    const receivedText =
      params.receivedAmount && params.targetCurrency
        ? formatAmount(params.receivedAmount, params.targetCurrency)
        : null;
    const feesText = params.fees ? formatAmount(params.fees, params.currency) : null;

    const html = `
      <p>Bonjour <strong>${params.senderFirstName}</strong>,</p>
      <p>Votre transfert vers <strong>${params.recipientName}</strong> a été enregistré avec succès.</p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;border-collapse:collapse;background:#FAFAF7;border-radius:8px;">
        <tr><td style="color:#666;">Montant envoyé</td><td style="text-align:right;font-weight:500;">${sentText}</td></tr>
        ${
          receivedText
            ? `<tr><td style="color:#666;">Montant reçu</td><td style="text-align:right;font-weight:500;color:#15803D;">${receivedText}</td></tr>`
            : ''
        }
        ${
          feesText
            ? `<tr><td style="color:#666;">Frais</td><td style="text-align:right;">${feesText}</td></tr>`
            : ''
        }
        <tr><td style="color:#666;">Référence</td><td style="text-align:right;font-family:monospace;">${params.txRef}</td></tr>
        ${
          params.pickupCode
            ? `<tr><td style="color:#666;">Code de retrait</td><td style="text-align:right;font-family:monospace;font-size:18px;font-weight:500;color:#DC2626;">${params.pickupCode}</td></tr>`
            : ''
        }
      </table>
      ${
        params.pickupCode
          ? `<p style="background:#FEF3C7;padding:12px;border-radius:8px;color:#92400E;font-size:13px;">
              ⚠️ Communiquez ce code uniquement au destinataire pour qu'il puisse retirer son argent.
            </p>`
          : ''
      }
      <p>Merci de votre confiance.</p>
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `Confirmation de transfert ✅`,
      htmlContent: html,
      userId: params.userId,
      transactionId: params.transactionId,
      brandColor: params.brandColor,
      brandName: params.brandName,
    });
  }

  // ========================================================
  // RÉCEPTION D'ARGENT
  // ========================================================

  async sendMoneyReceived(params: {
    email: string;
    recipientFirstName: string;
    senderName: string;
    amount: number;
    currency: string;
    txRef: string;
    userId?: string;
    transactionId?: string;
    brandColor?: string;
    brandName?: string;
  }) {
    const amountText = formatAmount(params.amount, params.currency);

    const html = `
      <p>Bonjour <strong>${params.recipientFirstName}</strong>,</p>
      <p style="font-size:18px;">🎉 Bonne nouvelle !</p>
      <p>Vous venez de recevoir <strong style="font-size:22px;color:#15803D;">${amountText}</strong> de la part de <strong>${params.senderName}</strong>.</p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#DCFCE7;border-radius:8px;">
        <tr><td style="color:#166534;">Référence</td><td style="text-align:right;font-family:monospace;color:#166534;">${params.txRef}</td></tr>
      </table>
      <p>Connectez-vous pour consulter votre nouveau solde et utiliser cet argent.</p>
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `Vous avez reçu de l'argent 💰`,
      htmlContent: html,
      userId: params.userId,
      transactionId: params.transactionId,
      brandColor: params.brandColor,
      brandName: params.brandName,
    });
  }

  // ========================================================
  // RETRAIT
  // ========================================================

  async sendWithdrawalRequested(params: {
    email: string;
    firstName: string;
    amount: number;
    currency: string;
    code: string;
    expiresAt?: Date;
    userId?: string;
  }) {
    const amountText = formatAmount(params.amount, params.currency);
    const expiryText = params.expiresAt
      ? params.expiresAt.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;

    const html = `
      <p>Bonjour <strong>${params.firstName}</strong>,</p>
      <p>Votre demande de retrait de <strong>${amountText}</strong> est prête.</p>
      <div style="text-align:center;margin:24px 0;padding:24px;background:#FEE2E2;border-radius:12px;">
        <p style="margin:0 0 8px 0;color:#991B1B;font-size:13px;">Code de retrait</p>
        <p style="margin:0;font-family:monospace;font-size:32px;font-weight:500;color:#991B1B;letter-spacing:4px;">${params.code}</p>
      </div>
      <p>Présentez ce code à un agent agréé pour récupérer votre argent.</p>
      ${expiryText ? `<p style="color:#92400E;">⏰ Ce code expire le <strong>${expiryText}</strong>.</p>` : ''}
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `Code de retrait — ${amountText}`,
      htmlContent: html,
      userId: params.userId,
    });
  }

  // ========================================================
  // BIENVENUE
  // ========================================================

  async sendWelcome(params: {
    email: string;
    firstName: string;
    primaryCurrency: string;
    country?: string;
    userId?: string;
    brandColor?: string;
    brandName?: string;
  }) {
    const html = `
      <p>Bonjour <strong>${params.firstName}</strong>,</p>
      <p>Bienvenue sur la plateforme ! Votre compte a été créé avec succès.</p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#FAFAF7;border-radius:8px;">
        ${params.country ? `<tr><td style="color:#666;">Pays de résidence</td><td style="text-align:right;font-weight:500;">${params.country}</td></tr>` : ''}
        <tr><td style="color:#666;">Devise principale</td><td style="text-align:right;font-weight:500;">${params.primaryCurrency}</td></tr>
      </table>
      <p>Vous pouvez maintenant :</p>
      <ul>
        <li>Envoyer de l'argent vers vos bénéficiaires</li>
        <li>Recevoir des paiements en ${params.primaryCurrency}</li>
        <li>Consulter les taux de change en temps réel</li>
        <li>Programmer des virements récurrents</li>
      </ul>
      <p>À très bientôt !</p>
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `Bienvenue ! 🎉`,
      htmlContent: html,
      userId: params.userId,
      brandColor: params.brandColor,
      brandName: params.brandName,
    });
  }

  // ========================================================
  // POINTS DE FIDÉLITÉ
  // ========================================================

  async sendLoyaltyTierUp(params: {
    email: string;
    firstName: string;
    newTier: string;
    points: number;
    userId?: string;
  }) {
    const html = `
      <p>Bonjour <strong>${params.firstName}</strong>,</p>
      <p>🌟 Félicitations ! Vous venez d'atteindre le statut <strong style="color:#7C3AED;">${params.newTier}</strong>.</p>
      <p>Total de vos points : <strong>${params.points.toLocaleString('fr-FR')}</strong>.</p>
      <p>Profitez dès maintenant de vos avantages exclusifs.</p>
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `Nouveau statut ${params.newTier} 🌟`,
      htmlContent: html,
      userId: params.userId,
    });
  }

  // ========================================================
  // VIREMENT PROGRAMMÉ
  // ========================================================

  async sendScheduledTransferExecuted(params: {
    email: string;
    firstName: string;
    amount: number;
    currency: string;
    recipientName: string;
    nextDate?: Date;
    userId?: string;
  }) {
    const amountText = formatAmount(params.amount, params.currency);
    const nextText = params.nextDate
      ? params.nextDate.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      : null;

    const html = `
      <p>Bonjour <strong>${params.firstName}</strong>,</p>
      <p>Votre virement programmé de <strong>${amountText}</strong> vers <strong>${params.recipientName}</strong> a été exécuté avec succès.</p>
      ${nextText ? `<p>Prochaine exécution prévue le <strong>${nextText}</strong>.</p>` : ''}
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `Virement programmé exécuté 📅`,
      htmlContent: html,
      userId: params.userId,
    });
  }

  // ========================================================
  // ALERTE TAUX DE CHANGE
  // ========================================================

  async sendRateAlertTriggered(params: {
    email: string;
    firstName: string;
    pair: string;
    threshold: number;
    currentRate: number;
    direction: 'ABOVE' | 'BELOW';
    userId?: string;
  }) {
    const directionText = params.direction === 'ABOVE' ? 'a dépassé' : 'est passé sous';

    const html = `
      <p>Bonjour <strong>${params.firstName}</strong>,</p>
      <p>📊 Le taux <strong>${params.pair.replace('_', ' → ')}</strong> ${directionText} votre seuil.</p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#DBEAFE;border-radius:8px;">
        <tr><td style="color:#1E40AF;">Seuil défini</td><td style="text-align:right;font-weight:500;color:#1E40AF;">${params.threshold}</td></tr>
        <tr><td style="color:#1E40AF;">Taux actuel</td><td style="text-align:right;font-weight:500;color:#1E40AF;">${params.currentRate}</td></tr>
      </table>
      <p>C'est peut-être le moment d'effectuer votre transfert.</p>
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `Alerte taux : ${params.pair.replace('_', ' → ')} 📊`,
      htmlContent: html,
      userId: params.userId,
    });
  }
}