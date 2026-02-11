//apps/backend/src/mail/channels/admin-mail.service.ts
import { Injectable } from '@nestjs/common';
import { MailService } from '../mail.service';

@Injectable()
export class AdminMailService {
  constructor(private readonly mailService: MailService) {}

  async sendNewTransactionAlert(email: string, type: string, amount: string, sender: string) {
    const html = `
      <p>Une nouvelle transaction importante nécessite votre attention.</p>
      <ul>
        <li>Type : ${type}</li>
        <li>Montant : <strong>${amount}</strong></li>
        <li>Émetteur : ${sender}</li>
      </ul>
      <p><a href="https://ton-admin-panel.com">Accéder au Dashboard</a></p>
    `;
    await this.mailService.sendEmail(email, 'Nouvelle Activité Admin 🚨', html);
  }
}