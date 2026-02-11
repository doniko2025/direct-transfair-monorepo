//apps/backend/src/notifications/channels/agent-notifier.service.ts
import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications.service';

@Injectable()
export class AgentNotifierService {
  constructor(private readonly notificationsService: NotificationsService) {}

  async notifyDepositProcessed(userId: string, amount: string, clientName: string) {
    await this.notificationsService.create(
      userId,
      'Dépôt client traité 📥',
      `Vous avez effectué un dépôt de ${amount} pour ${clientName}.`,
      'SUCCESS'
    );
  }

  async notifyWithdrawalProcessed(userId: string, amount: string, commission: string) {
    await this.notificationsService.create(
      userId,
      'Retrait client validé 📤',
      `Retrait de ${amount} validé. Commission perçue : ${commission}.`,
      'SUCCESS'
    );
  }

  async notifyLowBalance(userId: string, currentBalance: number) {
    await this.notificationsService.create(
      userId,
      'Solde Agence Bas ⚠️',
      `Attention, votre solde est de ${currentBalance}. Pensez à recharger.`,
      'WARNING'
    );
  }
}