//apps/backend/src/mail/channels/wallet-mail.service.ts
import { Injectable } from '@nestjs/common';
import { MailService } from '../mail.service';

@Injectable()
export class WalletMailService {
  constructor(private readonly mailService: MailService) {}

  async sendTransferConfirmation(email: string, recipientName: string, amount: string, txRef: string) {
    const html = `
      <p>Bonjour,</p>
      <p>Votre transfert de <strong>${amount}</strong> vers <strong>${recipientName}</strong> a été effectué avec succès.</p>
      <p>Référence : <code>${txRef}</code></p>
      <p>Merci de votre confiance.</p>
    `;
    await this.mailService.sendEmail(email, 'Confirmation de transfert ✅', html);
  }

  async sendMoneyReceived(email: string, senderName: string, amount: string) {
    const html = `
      <p>Bonne nouvelle !</p>
      <p>Vous avez reçu <strong>${amount}</strong> de la part de <strong>${senderName}</strong> sur votre Wallet.</p>
      <p>Connectez-vous pour voir votre nouveau solde.</p>
    `;
    await this.mailService.sendEmail(email, 'Vous avez reçu de l\'argent 💰', html);
  }
  
  async sendWelcome(email: string, firstName: string) {
    const html = `
      <p>Bonjour ${firstName},</p>
      <p>Bienvenue sur Direct Transf'air ! Votre compte est maintenant actif.</p>
    `;
    await this.mailService.sendEmail(email, 'Bienvenue ! 🎉', html);
  }
}