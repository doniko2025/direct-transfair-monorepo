//apps/backend/src/notifications/channels/admin-notifier.service.ts
import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications.service';

@Injectable()
export class AdminNotifierService {
  constructor(private readonly notificationsService: NotificationsService) {}

  async notifyNewB2BRequest(superAdminId: string, companyName: string, amount: string, txId: string) {
    await this.notificationsService.create(
      superAdminId,
      'Nouveau virement B2B 🏦',
      `La société ${companyName} a envoyé ${amount}. En attente de validation.`,
      'WARNING', // Warning pour attirer l'attention
      { transactionId: txId, action: 'VALIDATE_B2B' }
    );
  }

  async notifySystemAlert(superAdminId: string, message: string) {
    await this.notificationsService.create(
      superAdminId,
      'Alerte Système 🚨',
      message,
      'ERROR'
    );
  }
}