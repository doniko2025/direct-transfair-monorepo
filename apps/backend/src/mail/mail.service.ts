//apps/backend/src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail', // Utilisation simplifiée pour Gmail
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS, // Ton mot de passe d'application
      },
    });
  }

  async sendEmail(to: string, subject: string, htmlContent: string) {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.MAIL_FROM,
        to,
        subject,
        html: this.wrapHtml(subject, htmlContent),
      });
      this.logger.log(`Email envoyé à ${to} : ${info.messageId}`);
      return info;
    } catch (error) {
      this.logger.error(`Erreur d'envoi email à ${to}`, error);
      // On ne throw pas l'erreur pour ne pas bloquer une transaction si l'email échoue
    }
  }

  // Petit template HTML pour faire pro
  private wrapHtml(title: string, content: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px;">
        <div style="background-color: #F7931E; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Direct Transf'air</h1>
        </div>
        <div style="padding: 20px; color: #333; line-height: 1.6;">
          <h2 style="color: #F7931E;">${title}</h2>
          ${content}
          <p style="margin-top: 30px; font-size: 12px; color: #999;">
            Ceci est un message automatique, merci de ne pas répondre.
          </p>
        </div>
      </div>
    `;
  }
}