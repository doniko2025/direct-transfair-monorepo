// apps/backend/src/mail/channels/contract-mail.service.ts
// =========================================================
// CONTRAT MAIL — demande de signature, contrat signé (avec le PDF en pièce jointe), copie au Prestataire (Grand Chef).
//   Le courriel de bienvenue d'une nouvelle société (identifiants + lien de signature) est dans company-mail.service.ts.
// =========================================================

import { Injectable } from '@nestjs/common';
import { MailService } from '../mail.service';
import { escapeHtml, platform } from '../../common/platform.config';

const dateFr = (d: Date) =>
  d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric' });

const button = (href: string, label: string) =>
  `<p style="text-align:center;margin:26px 0;">
     <a href="${escapeHtml(href)}" style="display:inline-block;background:${platform.brandColor};color:#ffffff;text-decoration:none;border-radius:12px;padding:14px 34px;font-size:15px;font-weight:700;">${escapeHtml(label)}</a>
   </p>`;

@Injectable()
export class ContractMailService {
  constructor(private readonly mailService: MailService) {}

  /** Lien de signature (nouvel envoi, relance, contrat émis pour une société existante). */
  async sendSignatureRequest(params: {
    email: string;
    recipientName?: string | null;
    companyName: string;
    contractLabel: string;
    reference: string;
    url: string;
    expiresAt: Date;
    reminder?: boolean;
  }) {
    const html = `
      <p>Bonjour ${params.recipientName ? `<strong>${escapeHtml(params.recipientName)}</strong>` : ''},</p>
      <p>${params.reminder ? 'Votre contrat est toujours en attente de signature.' : 'Votre contrat est prêt à être signé.'}
         Il s'agit du <strong>${escapeHtml(params.contractLabel)}</strong> de la société
         <strong>${escapeHtml(params.companyName)}</strong> (réf. ${escapeHtml(params.reference)}).</p>
      <p>Lisez-le puis signez-le en ligne, depuis votre téléphone ou votre ordinateur&nbsp;: cela prend moins de deux minutes.
         Vous recevrez ensuite un exemplaire signé par e-mail.</p>
      ${button(params.url, 'Lire et signer mon contrat')}
      <p style="font-size:12px;color:#6B7280;">Ce lien est personnel et valable jusqu'au ${dateFr(params.expiresAt)}. Ne le transmettez à personne.<br/>
         Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur&nbsp;:<br/>
         <span style="font-family:monospace;word-break:break-all;">${escapeHtml(params.url)}</span></p>
    `;
    await this.mailService.sendEmail({
      to: params.email,
      subject: `${params.reminder ? 'Rappel — ' : ''}Votre contrat à signer — ${params.companyName} ✍️`,
      htmlContent: html,
    });
  }

  /** Contrat signé, adressé au signataire avec le PDF en pièce jointe. */
  async sendSignedContract(params: {
    email: string;
    recipientName?: string | null;
    companyName: string;
    contractLabel: string;
    reference: string;
    signedAt: Date;
    pdf: Buffer;
  }) {
    const html = `
      <p>Bonjour ${params.recipientName ? `<strong>${escapeHtml(params.recipientName)}</strong>` : ''},</p>
      <p>✅ Merci : votre <strong>${escapeHtml(params.contractLabel)}</strong> a bien été signé le
         <strong>${dateFr(params.signedAt)}</strong>.</p>
      <p>Vous trouverez en pièce jointe votre exemplaire signé, au format PDF, avec son certificat de signature électronique.
         Conservez-le précieusement.</p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#DCFCE7;border-radius:8px;">
        <tr><td style="color:#166534;">Société</td><td style="text-align:right;font-weight:500;color:#166534;">${escapeHtml(params.companyName)}</td></tr>
        <tr><td style="color:#166534;">Référence</td><td style="text-align:right;font-family:monospace;color:#166534;">${escapeHtml(params.reference)}</td></tr>
      </table>
      <p>Pour toute question sur votre contrat, répondez à votre interlocuteur ou contactez notre support.</p>
    `;
    await this.mailService.sendEmail({
      to: params.email,
      subject: `Votre contrat signé — ${params.companyName} ✅`,
      htmlContent: html,
      attachments: [{ filename: `contrat-${params.reference}.pdf`, content: params.pdf, contentType: 'application/pdf' }],
    });
  }

  /** Copie du contrat signé pour le Prestataire (Grand Chef). */
  async sendSignedCopyToProvider(params: {
    to: string;
    companyName: string;
    contractLabel: string;
    reference: string;
    signerName: string;
    signedAt: Date;
    pdf: Buffer;
  }) {
    const html = `
      <p>✅ <strong>${escapeHtml(params.companyName)}</strong> vient de signer son <strong>${escapeHtml(params.contractLabel)}</strong>.</p>
      <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#DCFCE7;border-radius:8px;">
        <tr><td style="color:#166534;">Signataire</td><td style="text-align:right;font-weight:500;color:#166534;">${escapeHtml(params.signerName)}</td></tr>
        <tr><td style="color:#166534;">Date</td><td style="text-align:right;color:#166534;">${dateFr(params.signedAt)}</td></tr>
        <tr><td style="color:#166534;">Référence</td><td style="text-align:right;font-family:monospace;color:#166534;">${escapeHtml(params.reference)}</td></tr>
      </table>
      <p>Le contrat signé est en pièce jointe ; il reste consultable à tout moment dans votre espace, rubrique « Contrats ».</p>
    `;
    await this.mailService.sendEmail({
      to: params.to,
      subject: `Contrat signé — ${params.companyName} ✅`,
      htmlContent: html,
      attachments: [{ filename: `contrat-${params.reference}.pdf`, content: params.pdf, contentType: 'application/pdf' }],
    });
  }
}
