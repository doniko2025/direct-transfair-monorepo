// apps/backend/src/mail/channels/admin-mail.service.ts
// =========================================================
// ADMIN MAIL — Alertes Super Admin et Company Admin
// ✅ Trésorerie 5 devises
// ✅ Alertes AML, KYC, suspicions
// ✅ Nouveaux clients SaaS, abonnements
// =========================================================

import { Injectable } from '@nestjs/common';
import { MailService, formatAmount } from '../mail.service';

@Injectable()
export class AdminMailService {
  constructor(private readonly mailService: MailService) {}

  // ========================================================
  // NOUVELLE TRANSACTION IMPORTANTE
  // ========================================================

  async sendNewTransactionAlert(params: {
    email: string;
    type: string;
    amount: number;
    currency: string;
    sender: string;
    txRef?: string;
    dashboardUrl?: string;
  }) {
    const amountText = formatAmount(params.amount, params.currency);

    const html = `
      <p>Une nouvelle transaction nécessite votre attention.</p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#FEF3C7;border-radius:8px;">
        <tr><td style="color:#92400E;">Type</td><td style="text-align:right;font-weight:500;color:#92400E;">${params.type}</td></tr>
        <tr><td style="color:#92400E;">Montant</td><td style="text-align:right;font-weight:500;color:#92400E;font-size:18px;">${amountText}</td></tr>
        <tr><td style="color:#92400E;">Émetteur</td><td style="text-align:right;color:#92400E;">${params.sender}</td></tr>
        ${params.txRef ? `<tr><td style="color:#92400E;">Référence</td><td style="text-align:right;font-family:monospace;color:#92400E;">${params.txRef}</td></tr>` : ''}
      </table>
      ${params.dashboardUrl ? `<p style="text-align:center;margin:24px 0;"><a href="${params.dashboardUrl}" style="display:inline-block;padding:12px 24px;background:#DC2626;color:#fff;text-decoration:none;border-radius:8px;font-weight:500;">Accéder au Dashboard →</a></p>` : ''}
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `🚨 Nouvelle activité — ${amountText}`,
      htmlContent: html,
    });
  }

  // ========================================================
  // ALERTE AML (Anti-Money Laundering)
  // ========================================================

  async sendAmlAlert(params: {
    email: string;
    userName: string;
    userId: string;
    riskScore: number;
    reason: string;
    transactionRef?: string;
    dashboardUrl?: string;
  }) {
    const severityColor =
      params.riskScore >= 80
        ? '#991B1B'
        : params.riskScore >= 50
          ? '#B45309'
          : '#666';

    const html = `
      <p style="background:#FEE2E2;padding:16px;border-radius:8px;color:#991B1B;font-weight:500;">
        🚨 Alerte conformité AML déclenchée
      </p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#FAFAF7;border-radius:8px;">
        <tr><td style="color:#666;">Utilisateur</td><td style="text-align:right;font-weight:500;">${params.userName}</td></tr>
        <tr><td style="color:#666;">User ID</td><td style="text-align:right;font-family:monospace;font-size:11px;">${params.userId}</td></tr>
        <tr><td style="color:#666;">Score de risque</td><td style="text-align:right;font-weight:500;color:${severityColor};font-size:18px;">${params.riskScore}/100</td></tr>
        <tr><td style="color:#666;">Motif</td><td style="text-align:right;color:#991B1B;">${params.reason}</td></tr>
        ${params.transactionRef ? `<tr><td style="color:#666;">Transaction</td><td style="text-align:right;font-family:monospace;">${params.transactionRef}</td></tr>` : ''}
      </table>
      <p>Une revue manuelle est nécessaire dès que possible.</p>
      ${params.dashboardUrl ? `<p style="text-align:center;margin:24px 0;"><a href="${params.dashboardUrl}" style="display:inline-block;padding:12px 24px;background:#991B1B;color:#fff;text-decoration:none;border-radius:8px;font-weight:500;">Examiner le cas →</a></p>` : ''}
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `🚨 AML Alert — Score ${params.riskScore}/100`,
      htmlContent: html,
    });
  }

  // ========================================================
  // KYC SOUMIS
  // ========================================================

  async sendKycSubmitted(params: {
    email: string;
    userName: string;
    userId: string;
    documentType: string;
    dashboardUrl?: string;
  }) {
    const html = `
      <p>Un nouveau document KYC a été soumis pour validation.</p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#DBEAFE;border-radius:8px;">
        <tr><td style="color:#1E40AF;">Utilisateur</td><td style="text-align:right;font-weight:500;color:#1E40AF;">${params.userName}</td></tr>
        <tr><td style="color:#1E40AF;">Type de document</td><td style="text-align:right;color:#1E40AF;">${params.documentType}</td></tr>
        <tr><td style="color:#1E40AF;">User ID</td><td style="text-align:right;font-family:monospace;font-size:11px;color:#1E40AF;">${params.userId}</td></tr>
      </table>
      ${params.dashboardUrl ? `<p style="text-align:center;margin:24px 0;"><a href="${params.dashboardUrl}" style="display:inline-block;padding:12px 24px;background:#1D4ED8;color:#fff;text-decoration:none;border-radius:8px;font-weight:500;">Examiner le document →</a></p>` : ''}
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `📄 Nouveau KYC à valider — ${params.userName}`,
      htmlContent: html,
    });
  }

  // ========================================================
  // RAPPORT QUOTIDIEN GLOBAL (Super Admin — 5 devises)
  // ========================================================

  async sendDailyGlobalReport(params: {
    email: string;
    date: Date;
    snapshots: Array<{
      currency: string;
      totalSent: number;
      totalReceived: number;
      totalFees: number;
      totalCommission: number;
      transactionCount: number;
      uniqueSenders: number;
    }>;
    newUsers: number;
    newClients: number;
    activeAlerts: number;
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
          <td style="padding:10px;border-bottom:1px solid #EAEAE5;text-align:right;color:#15803D;">${formatAmount(s.totalCommission, s.currency)}</td>
          <td style="padding:10px;border-bottom:1px solid #EAEAE5;text-align:right;">${s.transactionCount}</td>
          <td style="padding:10px;border-bottom:1px solid #EAEAE5;text-align:right;">${s.uniqueSenders}</td>
        </tr>
      `,
      )
      .join('');

    const html = `
      <h2 style="color:#7C3AED;margin-bottom:8px;">Rapport Plateforme — ${dateText}</h2>

      <div style="display:table;width:100%;margin:16px 0;border-spacing:8px;">
        <div style="display:table-row;">
          <div style="display:table-cell;background:#EDE9FE;border-radius:8px;padding:12px;text-align:center;width:33%;">
            <div style="font-size:24px;font-weight:500;color:#5B21B6;">${params.newUsers}</div>
            <div style="font-size:11px;color:#5B21B6;text-transform:uppercase;letter-spacing:.5px;">Nouveaux users</div>
          </div>
          <div style="display:table-cell;background:#DBEAFE;border-radius:8px;padding:12px;text-align:center;width:33%;">
            <div style="font-size:24px;font-weight:500;color:#1E40AF;">${params.newClients}</div>
            <div style="font-size:11px;color:#1E40AF;text-transform:uppercase;letter-spacing:.5px;">Sociétés</div>
          </div>
          <div style="display:table-cell;background:#FEE2E2;border-radius:8px;padding:12px;text-align:center;width:33%;">
            <div style="font-size:24px;font-weight:500;color:#991B1B;">${params.activeAlerts}</div>
            <div style="font-size:11px;color:#991B1B;text-transform:uppercase;letter-spacing:.5px;">Alertes</div>
          </div>
        </div>
      </div>

      <h3 style="color:#7C3AED;margin-top:24px;">Trésorerie par devise</h3>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#F4F3EE;">
            <th style="padding:10px;text-align:left;font-size:12px;color:#666;">Devise</th>
            <th style="padding:10px;text-align:right;font-size:12px;color:#666;">Volume</th>
            <th style="padding:10px;text-align:right;font-size:12px;color:#666;">Commission</th>
            <th style="padding:10px;text-align:right;font-size:12px;color:#666;">Tx</th>
            <th style="padding:10px;text-align:right;font-size:12px;color:#666;">Émetteurs</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `📊 Rapport plateforme — ${dateText}`,
      htmlContent: html,
    });
  }

  // ========================================================
  // NOUVEAU CLIENT SAAS
  // ========================================================

  async sendNewClientSignup(params: {
    email: string;
    clientName: string;
    clientCode: string;
    ownerName: string;
    country?: string;
    subscriptionType: string;
  }) {
    const html = `
      <p>🎉 Une nouvelle société vient de s'inscrire sur la plateforme.</p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#DCFCE7;border-radius:8px;">
        <tr><td style="color:#166534;">Société</td><td style="text-align:right;font-weight:500;color:#166534;">${params.clientName}</td></tr>
        <tr><td style="color:#166534;">Code tenant</td><td style="text-align:right;font-family:monospace;color:#166534;">${params.clientCode}</td></tr>
        <tr><td style="color:#166534;">Représentant</td><td style="text-align:right;color:#166534;">${params.ownerName}</td></tr>
        ${params.country ? `<tr><td style="color:#166534;">Pays</td><td style="text-align:right;color:#166534;">${params.country}</td></tr>` : ''}
        <tr><td style="color:#166534;">Abonnement</td><td style="text-align:right;color:#166534;">${params.subscriptionType}</td></tr>
      </table>
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `🎉 Nouveau client SaaS — ${params.clientName}`,
      htmlContent: html,
    });
  }

  // ========================================================
  // CONNEXION DEPUIS UN NOUVEL APPAREIL
  // ========================================================

  async sendNewDeviceLogin(params: {
    email: string;
    firstName: string;
    deviceName: string;
    platform: string;
    country?: string;
    ipAddress?: string;
    userId?: string;
  }) {
    const html = `
      <p>Bonjour <strong>${params.firstName}</strong>,</p>
      <p>Une connexion vient d'être établie sur votre compte depuis un nouvel appareil.</p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#FEF3C7;border-radius:8px;">
        <tr><td style="color:#92400E;">Appareil</td><td style="text-align:right;font-weight:500;color:#92400E;">${params.deviceName}</td></tr>
        <tr><td style="color:#92400E;">Plateforme</td><td style="text-align:right;color:#92400E;">${params.platform}</td></tr>
        ${params.country ? `<tr><td style="color:#92400E;">Pays</td><td style="text-align:right;color:#92400E;">${params.country}</td></tr>` : ''}
        ${params.ipAddress ? `<tr><td style="color:#92400E;">Adresse IP</td><td style="text-align:right;font-family:monospace;font-size:12px;color:#92400E;">${params.ipAddress}</td></tr>` : ''}
        <tr><td style="color:#92400E;">Date</td><td style="text-align:right;color:#92400E;">${new Date().toLocaleString('fr-FR')}</td></tr>
      </table>
      <p style="background:#FEE2E2;padding:12px;border-radius:8px;color:#991B1B;font-size:13px;">
        ⚠️ Si ce n'était pas vous, changez immédiatement votre mot de passe et révoquez l'appareil.
      </p>
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `🔐 Nouvelle connexion détectée`,
      htmlContent: html,
      userId: params.userId,
    });
  }
}