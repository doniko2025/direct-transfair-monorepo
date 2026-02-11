//apps/backend/src/mail/channels/company-mail.service.ts
import { Injectable } from '@nestjs/common';
import { MailService } from '../mail.service';

@Injectable()
export class CompanyMailService {
  constructor(private readonly mailService: MailService) {}

  async sendB2BRequestSent(email: string, amount: string, ref: string) {
    const html = `
      <p>Votre demande de virement B2B a bien été prise en compte.</p>
      <ul>
        <li>Montant : <strong>${amount}</strong></li>
        <li>Référence : ${ref}</li>
        <li>Statut : <span style="color: orange;">En attente de validation</span></li>
      </ul>
      <p>Vous serez notifié dès la validation par le Super Admin.</p>
    `;
    await this.mailService.sendEmail(email, 'Virement B2B en cours ⏳', html);
  }

  async sendB2BValidated(email: string, amount: string) {
    const html = `
      <p>Félicitations,</p>
      <p>Votre virement de <strong>${amount}</strong> a été validé et reçu par la plateforme.</p>
      <p>Merci pour votre collaboration.</p>
    `;
    await this.mailService.sendEmail(email, 'Virement B2B Validé ✅', html);
  }

  async sendRefillReceived(email: string, amount: string, newBalance: string) {
    const html = `
      <p>Votre compte principal a été rechargé de <strong>${amount}</strong>.</p>
      <p>Nouveau solde disponible : <strong>${newBalance}</strong>.</p>
    `;
    await this.mailService.sendEmail(email, 'Rechargement reçu 🔋', html);
  }
}