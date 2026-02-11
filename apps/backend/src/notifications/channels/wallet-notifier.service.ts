//apps/backend/src/notifications/channels/wallet-notifier.service.ts
import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications.service';
import { Transaction } from '@prisma/client';

@Injectable()
export class WalletNotifierService {
  constructor(private readonly notificationsService: NotificationsService) {}

  async notifyTransferSent(userId: string, recipientName: string, amount: string) {
    await this.notificationsService.create(
      userId,
      'Transfert envoyé 💸',
      `Vous avez envoyé ${amount} à ${recipientName}.`,
      'SUCCESS'
    );
  }

  async notifyTransferReceived(userId: string, senderName: string, amount: string) {
    await this.notificationsService.create(
      userId,
      'Argent reçu 💰',
      `Vous avez reçu ${amount} de la part de ${senderName}.`,
      'SUCCESS'
    );
  }

  async notifyDepositReceived(userId: string, amount: string) {
    await this.notificationsService.create(
      userId,
      'Dépôt effectué ✅',
      `Votre compte a été crédité de ${amount}.`,
      'SUCCESS'
    );
  }

  async notifyWithdrawal(userId: string, amount: string) {
    await this.notificationsService.create(
      userId,
      'Retrait effectué 🏧',
      `Un retrait de ${amount} a été débité de votre compte.`,
      'INFO'
    );
  }
}