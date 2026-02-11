//apps/backend/src/mail/channels/agent-mail.service.ts
import { Injectable } from '@nestjs/common';
import { MailService } from '../mail.service';

@Injectable()
export class AgentMailService {
  constructor(private readonly mailService: MailService) {}

  async sendDepositSummary(email: string, amount: string, clientName: string, balance: string) {
    const html = `
      <p>Cher Partenaire,</p>
      <p>Vous avez traité un dépôt de <strong>${amount}</strong> pour le client ${clientName}.</p>
      <p>Votre nouveau solde agence est de : <strong>${balance}</strong>.</p>
    `;
    await this.mailService.sendEmail(email, 'Dépôt effectué 📥', html);
  }

  async sendLowBalanceAlert(email: string, currentBalance: string) {
    const html = `
      <p style="color: red;"><strong>Attention !</strong></p>
      <p>Votre solde agence est bas (${currentBalance}).</p>
      <p>Pensez à contacter votre administrateur pour un rechargement afin de ne pas bloquer vos opérations.</p>
    `;
    await this.mailService.sendEmail(email, 'Alerte Solde Bas ⚠️', html);
  }
}