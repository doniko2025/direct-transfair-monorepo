// apps/backend/src/mail/channels/agent-mail.service.ts
// =========================================================
// AGENT MAIL — Notifications agents en agence
// ✅ Multi-devises (1 wallet par devise par agence)
// ✅ Alertes solde bas par devise
// =========================================================

import { Injectable } from '@nestjs/common';
import { MailService, formatAmount } from '../mail.service';

@Injectable()
export class AgentMailService {
  constructor(private readonly mailService: MailService) {}

  // ========================================================
  // DÉPÔT EFFECTUÉ
  // ========================================================

  async sendDepositSummary(params: {
    email: string;
    agentName: string;
    clientName: string;
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
      <p>Bonjour <strong>${params.agentName}</strong>,</p>
      <p>Vous venez de traiter un dépôt pour le client <strong>${params.clientName}</strong>.</p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#DCFCE7;border-radius:8px;">
        <tr><td style="color:#166534;">Montant déposé</td><td style="text-align:right;font-weight:500;color:#166534;">${amountText}</td></tr>
        <tr><td style="color:#166534;">Devise</td><td style="text-align:right;font-weight:500;color:#166534;">${params.currency}</td></tr>
        <tr><td style="color:#166534;">Solde agence (${params.currency})</td><td style="text-align:right;font-weight:500;color:#166534;font-size:18px;">${balanceText}</td></tr>
      </table>
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `Dépôt effectué — ${amountText} 📥`,
      htmlContent: html,
      userId: params.userId,
      brandColor: params.brandColor,
      brandName: params.brandName,
    });
  }

  // ========================================================
  // RETRAIT TRAITÉ
  // ========================================================

  async sendWithdrawalProcessed(params: {
    email: string;
    agentName: string;
    clientName: string;
    amount: number;
    currency: string;
    newBalance: number;
    code: string;
    userId?: string;
  }) {
    const amountText = formatAmount(params.amount, params.currency);
    const balanceText = formatAmount(params.newBalance, params.currency);

    const html = `
      <p>Bonjour <strong>${params.agentName}</strong>,</p>
      <p>Vous venez de payer un retrait à <strong>${params.clientName}</strong>.</p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#FEE2E2;border-radius:8px;">
        <tr><td style="color:#991B1B;">Montant payé</td><td style="text-align:right;font-weight:500;color:#991B1B;">${amountText}</td></tr>
        <tr><td style="color:#991B1B;">Code</td><td style="text-align:right;font-family:monospace;color:#991B1B;">${params.code}</td></tr>
        <tr><td style="color:#991B1B;">Solde agence (${params.currency})</td><td style="text-align:right;font-weight:500;color:#991B1B;font-size:18px;">${balanceText}</td></tr>
      </table>
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `Retrait traité — ${amountText} 📤`,
      htmlContent: html,
      userId: params.userId,
    });
  }

  // ========================================================
  // ALERTE SOLDE BAS (PAR DEVISE)
  // ========================================================

  async sendLowBalanceAlert(params: {
    email: string;
    agentName: string;
    agencyName: string;
    currency: string;
    currentBalance: number;
    threshold: number;
    userId?: string;
  }) {
    const balanceText = formatAmount(params.currentBalance, params.currency);
    const thresholdText = formatAmount(params.threshold, params.currency);

    const html = `
      <p>Bonjour <strong>${params.agentName}</strong>,</p>
      <p style="background:#FEE2E2;padding:16px;border-radius:8px;color:#991B1B;font-weight:500;">
        ⚠️ Le solde de votre agence <strong>${params.agencyName}</strong> en <strong>${params.currency}</strong> est bas.
      </p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#FAFAF7;border-radius:8px;">
        <tr><td style="color:#666;">Devise</td><td style="text-align:right;font-weight:500;">${params.currency}</td></tr>
        <tr><td style="color:#666;">Solde actuel</td><td style="text-align:right;font-weight:500;color:#DC2626;">${balanceText}</td></tr>
        <tr><td style="color:#666;">Seuil d'alerte</td><td style="text-align:right;">${thresholdText}</td></tr>
      </table>
      <p>Contactez votre administrateur pour un rechargement afin d'éviter toute interruption.</p>
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `Alerte solde bas — ${params.currency} ⚠️`,
      htmlContent: html,
      userId: params.userId,
    });
  }

  // ========================================================
  // RECHARGEMENT REÇU PAR L'AGENCE
  // ========================================================

  async sendAgencyRefilled(params: {
    email: string;
    agentName: string;
    agencyName: string;
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
      <p>Bonjour <strong>${params.agentName}</strong>,</p>
      <p>Votre agence <strong>${params.agencyName}</strong> vient d'être rechargée de <strong style="color:#15803D;">${amountText}</strong>.</p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#DCFCE7;border-radius:8px;">
        <tr><td style="color:#166534;">Devise</td><td style="text-align:right;font-weight:500;color:#166534;">${params.currency}</td></tr>
        <tr><td style="color:#166534;">Nouveau solde</td><td style="text-align:right;font-weight:500;color:#166534;font-size:18px;">${balanceText}</td></tr>
      </table>
      <p>Vous pouvez reprendre les opérations sereinement.</p>
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
  // RAPPORT JOURNALIER AGENT
  // ========================================================

  async sendDailyReport(params: {
    email: string;
    agentName: string;
    date: Date;
    deposits: { currency: string; total: number; count: number }[];
    withdrawals: { currency: string; total: number; count: number }[];
    userId?: string;
  }) {
    const dateText = params.date.toLocaleDateString('fr-FR');

    const depositRows = params.deposits
      .map(
        (d) => `
        <tr>
          <td style="padding:8px;">${d.currency}</td>
          <td style="padding:8px;text-align:right;font-weight:500;">${formatAmount(d.total, d.currency)}</td>
          <td style="padding:8px;text-align:right;">${d.count}</td>
        </tr>
      `,
      )
      .join('');

    const withdrawalRows = params.withdrawals
      .map(
        (w) => `
        <tr>
          <td style="padding:8px;">${w.currency}</td>
          <td style="padding:8px;text-align:right;font-weight:500;">${formatAmount(w.total, w.currency)}</td>
          <td style="padding:8px;text-align:right;">${w.count}</td>
        </tr>
      `,
      )
      .join('');

    const html = `
      <p>Bonjour <strong>${params.agentName}</strong>,</p>
      <p>Voici votre rapport d'activité du <strong>${dateText}</strong>.</p>
      <h3 style="color:#15803D;margin-top:24px;">📥 Dépôts</h3>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#FAFAF7;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#DCFCE7;"><th style="padding:8px;text-align:left;color:#166534;font-size:12px;">Devise</th><th style="padding:8px;text-align:right;color:#166534;font-size:12px;">Total</th><th style="padding:8px;text-align:right;color:#166534;font-size:12px;">Nb</th></tr></thead>
        <tbody>${depositRows || '<tr><td colspan="3" style="padding:12px;text-align:center;color:#999;">Aucun dépôt</td></tr>'}</tbody>
      </table>
      <h3 style="color:#991B1B;margin-top:24px;">📤 Retraits</h3>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#FAFAF7;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#FEE2E2;"><th style="padding:8px;text-align:left;color:#991B1B;font-size:12px;">Devise</th><th style="padding:8px;text-align:right;color:#991B1B;font-size:12px;">Total</th><th style="padding:8px;text-align:right;color:#991B1B;font-size:12px;">Nb</th></tr></thead>
        <tbody>${withdrawalRows || '<tr><td colspan="3" style="padding:12px;text-align:center;color:#999;">Aucun retrait</td></tr>'}</tbody>
      </table>
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `Rapport journalier — ${dateText} 📊`,
      htmlContent: html,
      userId: params.userId,
    });
  }
}