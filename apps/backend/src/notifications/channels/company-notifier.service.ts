import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications.service';

@Injectable()
export class CompanyNotifierService {
  constructor(private readonly notificationsService: NotificationsService) {}

  async notifyB2BTransferSent(userId: string, amount: string) {
    await this.notificationsService.create(
      userId,
      'Virement B2B en attente ⏳',
      `Votre demande de virement de ${amount} a été envoyée au Super Admin pour validation.`,
      'INFO'
    );
  }

  async notifyB2BTransferValidated(userId: string, amount: string) {
    await this.notificationsService.create(
      userId,
      'Virement B2B Validé ✅',
      `Votre virement de ${amount} a été validé par la plateforme.`,
      'SUCCESS'
    );
  }

  async notifyRefillReceived(userId: string, amount: string) {
    await this.notificationsService.create(
      userId,
      'Rechargement reçu 🔋',
      `Votre compte principal a été rechargé de ${amount}.`,
      'SUCCESS'
    );
  }

  async notifyB2BRejected(userId: string, amount: string) {
    await this.notificationsService.create(
      userId,
      'Virement B2B Rejeté ❌',
      `Votre virement de ${amount} a été refusé. Les fonds ont été remboursés.`,
      'ERROR'
    );
  }
}