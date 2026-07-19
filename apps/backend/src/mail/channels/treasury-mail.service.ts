// apps/backend/src/mail/channels/treasury-mail.service.ts
// =========================================================
// TREASURY MAIL v1.0 — Direct Transf'air
// Fichier indépendant — n'ajoute rien à agent-mail.service.ts ni
// company-mail.service.ts, pour ne rien risquer sur les flux
// existants (dépôt, retrait client, B2B, rechargement agence).
//
// Couvre les 2 nouveaux flux de trésorerie agence ⇄ société :
//  - Remontée de fonds initiée par l'agent   (agence → société)
//  - Retrait forcé initié par l'admin        (agence → société)
// Même style HTML que les autres canaux mail (tables, formatAmount).
// =========================================================

import { Injectable } from '@nestjs/common';
import { MailService, formatAmount } from '../mail.service';

@Injectable()
export class TreasuryMailService {
  constructor(private readonly mailService: MailService) {}

  // ========================================================
  // REMONTÉE DE FONDS — Confirmation à l'agent
  // ========================================================

  async sendRemittanceSent(params: {
    email: string;
    agentName: string;
    agencyName: string;
    amount: number;
    currency: string;
    note?: string;
    reference: string;
    userId?: string;
  }) {
    const amountText = formatAmount(params.amount, params.currency);

    const html = `
      <p>Bonjour <strong>${params.agentName}</strong>,</p>
      <p>Vous avez envoyé <strong style="color:#1D4ED8;">${amountText}</strong> depuis l'agence <strong>${params.agencyName}</strong> vers le compte de la société.</p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#EFF6FF;border-radius:8px;">
        <tr><td style="color:#1E40AF;">Montant</td><td style="text-align:right;font-weight:500;color:#1E40AF;">${amountText}</td></tr>
        ${params.note ? `<tr><td style="color:#1E40AF;">Libellé</td><td style="text-align:right;color:#1E40AF;">${params.note}</td></tr>` : ''}
        <tr><td style="color:#1E40AF;">Référence</td><td style="text-align:right;font-family:monospace;color:#1E40AF;">${params.reference}</td></tr>
      </table>
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `Remontée de fonds envoyée — ${amountText} 📤`,
      htmlContent: html,
      userId: params.userId,
    });
  }

  // ========================================================
  // REMONTÉE DE FONDS — Notification à l'admin société
  // ========================================================

  async sendRemittanceReceived(params: {
    email: string;
    adminName: string;
    agentName: string;
    agencyName: string;
    amount: number;
    currency: string;
    note?: string;
    reference: string;
    userId?: string;
  }) {
    const amountText = formatAmount(params.amount, params.currency);

    const html = `
      <p>Bonjour <strong>${params.adminName}</strong>,</p>
      <p><strong>${params.agentName}</strong> a envoyé <strong style="color:#15803D;">${amountText}</strong> depuis l'agence <strong>${params.agencyName}</strong> vers votre compte société.</p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#DCFCE7;border-radius:8px;">
        <tr><td style="color:#166534;">Montant</td><td style="text-align:right;font-weight:500;color:#166534;">${amountText}</td></tr>
        ${params.note ? `<tr><td style="color:#166534;">Libellé</td><td style="text-align:right;color:#166534;">${params.note}</td></tr>` : ''}
        <tr><td style="color:#166534;">Référence</td><td style="text-align:right;font-family:monospace;color:#166534;">${params.reference}</td></tr>
      </table>
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `Remontée de fonds reçue — ${amountText} 💰`,
      htmlContent: html,
      userId: params.userId,
    });
  }

  // ========================================================
  // RETRAIT FORCÉ — Notification à l'agent
  // ========================================================

  async sendCollectionToAgent(params: {
    email: string;
    agentName: string;
    adminName: string;
    agencyName: string;
    amount: number;
    currency: string;
    note?: string;
    reference: string;
    userId?: string;
  }) {
    const amountText = formatAmount(params.amount, params.currency);

    const html = `
      <p>Bonjour <strong>${params.agentName}</strong>,</p>
      <p><strong>${params.adminName}</strong> a retiré <strong style="color:#991B1B;">${amountText}</strong> du solde de votre agence <strong>${params.agencyName}</strong>.</p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#FEE2E2;border-radius:8px;">
        <tr><td style="color:#991B1B;">Montant</td><td style="text-align:right;font-weight:500;color:#991B1B;">${amountText}</td></tr>
        ${params.note ? `<tr><td style="color:#991B1B;">Libellé</td><td style="text-align:right;color:#991B1B;">${params.note}</td></tr>` : ''}
        <tr><td style="color:#991B1B;">Référence</td><td style="text-align:right;font-family:monospace;color:#991B1B;">${params.reference}</td></tr>
      </table>
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `Retrait effectué par la société — ${amountText} 🏦`,
      htmlContent: html,
      userId: params.userId,
    });
  }

  // ========================================================
  // RETRAIT FORCÉ — Confirmation à l'admin
  // ========================================================

  async sendCollectionConfirmation(params: {
    email: string;
    adminName: string;
    agencyName: string;
    amount: number;
    currency: string;
    note?: string;
    reference: string;
    userId?: string;
  }) {
    const amountText = formatAmount(params.amount, params.currency);

    const html = `
      <p>Bonjour <strong>${params.adminName}</strong>,</p>
      <p>Vous avez retiré <strong style="color:#15803D;">${amountText}</strong> depuis l'agence <strong>${params.agencyName}</strong> vers votre compte société.</p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#DCFCE7;border-radius:8px;">
        <tr><td style="color:#166534;">Montant</td><td style="text-align:right;font-weight:500;color:#166534;">${amountText}</td></tr>
        ${params.note ? `<tr><td style="color:#166534;">Libellé</td><td style="text-align:right;color:#166534;">${params.note}</td></tr>` : ''}
        <tr><td style="color:#166534;">Référence</td><td style="text-align:right;font-family:monospace;color:#166534;">${params.reference}</td></tr>
      </table>
    `;

    await this.mailService.sendEmail({
      to: params.email,
      subject: `Retrait agence confirmé — ${amountText} ✅`,
      htmlContent: html,
      userId: params.userId,
    });
  }
}