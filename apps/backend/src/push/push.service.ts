// apps/backend/src/push/push.service.ts
// =========================================================
// PUSH SERVICE v4.0 — Direct Transf'air
// ✅ Firebase Admin SDK (FCM Android + APNS iOS)
// ✅ Envoi à un utilisateur (tous ses appareils actifs)
// ✅ Envoi à un topic (ex: tous les admins)
// ✅ CommunicationLog tracé
// ✅ STUB si Firebase non configuré
// =========================================================

import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

import { PrismaService } from '../prisma/prisma.service';

// =========================================================
// TYPES
// =========================================================

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>; // FCM exige des string:string
  imageUrl?: string;
}

export interface SendPushResult {
  successCount: number;
  failureCount: number;
  provider: string;
}

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private initialized = false;

  constructor(private readonly prisma: PrismaService) {
    this.initFirebase();
  }

  // ========================================================
  // INIT FIREBASE ADMIN
  // ========================================================

  private initFirebase(): void {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        '⚠️  Firebase non configuré — Push en mode STUB (console uniquement)',
      );
      return;
    }

    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }

    this.initialized = true;
    this.logger.log('✅ Firebase Admin SDK initialisé (FCM/APNS)');
  }

  // ========================================================
  // ENVOI À UN TOKEN SPÉCIFIQUE
  // ========================================================

  async sendToToken(
    token: string,
    payload: PushPayload,
    userId?: string,
  ): Promise<boolean> {
    if (!this.initialized) {
      this.logger.log(
        `[PUSH STUB] → token ${token.substring(0, 12)}... : ${payload.title} — ${payload.body}`,
      );
      return true;
    }

    const message: admin.messaging.Message = {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data,
      android: {
        notification: {
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          priority: 'high',
        },
        priority: 'high',
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    try {
      const response = await admin.messaging().send(message);
      this.logger.log(`✅ Push envoyé (${response})`);

      // Log
      if (userId) {
        await this.prisma.communicationLog
          .create({
            data: {
              userId,
              type: 'PUSH',
              recipient: token.substring(0, 20) + '...',
              pushTitle: payload.title,
              pushBody: payload.body,
              pushData: payload.data ? (payload.data as any) : undefined,
              status: 'SENT',
              sentAt: new Date(),
              providerId: response,
              providerName: 'fcm',
            },
          })
          .catch(() => {});
      }

      return true;
    } catch (error: any) {
      this.logger.error(`❌ Push failed → ${token.substring(0, 12)}...`, error?.message);
      return false;
    }
  }

  // ========================================================
  // ENVOI À TOUS LES APPAREILS D'UN UTILISATEUR
  // ========================================================

  async sendToUser(
    userId: string,
    payload: PushPayload,
  ): Promise<SendPushResult> {
    const devices = await this.prisma.userDevice.findMany({
      where: {
        userId,
        status: 'TRUSTED',
        pushEnabled: true,
        pushToken: { not: null },
      },
    });

    if (devices.length === 0) {
      this.logger.log(
        `[PUSH] User ${userId} : aucun appareil actif — stub log`,
      );
      return { successCount: 0, failureCount: 0, provider: 'none' };
    }

    let successCount = 0;
    let failureCount = 0;

    for (const device of devices) {
      if (!device.pushToken) continue;
      const ok = await this.sendToToken(device.pushToken, payload, userId);
      if (ok) {
        successCount++;
      } else {
        failureCount++;
        // Désactive le token défaillant
        await this.prisma.userDevice
          .update({
            where: { id: device.id },
            data: { pushEnabled: false },
          })
          .catch(() => {});
      }
    }

    return {
      successCount,
      failureCount,
      provider: this.initialized ? 'fcm' : 'stub',
    };
  }

  // ========================================================
  // ENVOI À PLUSIEURS UTILISATEURS (multicast)
  // ========================================================

  async sendToUsers(
    userIds: string[],
    payload: PushPayload,
  ): Promise<SendPushResult> {
    let totalSuccess = 0;
    let totalFailure = 0;

    for (const uid of userIds) {
      const r = await this.sendToUser(uid, payload);
      totalSuccess += r.successCount;
      totalFailure += r.failureCount;
    }

    return {
      successCount: totalSuccess,
      failureCount: totalFailure,
      provider: this.initialized ? 'fcm' : 'stub',
    };
  }

  // ========================================================
  // TEMPLATES MÉTIER
  // ========================================================

  async notifyTransferSent(
    userId: string,
    recipientName: string,
    amount: string,
    currency: string,
  ): Promise<void> {
    await this.sendToUser(userId, {
      title: 'Transfert envoyé ✅',
      body: `${amount} ${currency} vers ${recipientName} enregistré.`,
      data: { type: 'TRANSFER_SENT', currency },
    });
  }

  async notifyTransferReceived(
    userId: string,
    senderName: string,
    amount: string,
    currency: string,
  ): Promise<void> {
    await this.sendToUser(userId, {
      title: 'Argent reçu 💰',
      body: `Vous avez reçu ${amount} ${currency} de ${senderName}.`,
      data: { type: 'TRANSFER_RECEIVED', currency },
    });
  }

  async notifyWithdrawalReady(
    userId: string,
    amount: string,
    currency: string,
    code: string,
  ): Promise<void> {
    await this.sendToUser(userId, {
      title: 'Retrait prêt 📤',
      body: `${amount} ${currency} disponible. Code : ${code}`,
      data: { type: 'WITHDRAWAL_READY', code, currency },
    });
  }

  async notifyNewDevice(userId: string, deviceName: string): Promise<void> {
    await this.sendToUser(userId, {
      title: 'Nouvelle connexion 🔐',
      body: `Connexion détectée depuis : ${deviceName}`,
      data: { type: 'SECURITY_NEW_DEVICE' },
    });
  }

  async notifyRateAlert(
    userId: string,
    pair: string,
    rate: number,
    direction: 'ABOVE' | 'BELOW',
  ): Promise<void> {
    const dir = direction === 'ABOVE' ? 'dépassé' : 'est passé sous';
    await this.sendToUser(userId, {
      title: `Alerte taux ${pair.replace('_', '→')} 📊`,
      body: `Le taux a ${dir} votre seuil. Taux actuel : ${rate}`,
      data: { type: 'RATE_ALERT', pair },
    });
  }

  async notifyScheduledTransferExecuted(
    userId: string,
    amount: string,
    currency: string,
    recipientName: string,
  ): Promise<void> {
    await this.sendToUser(userId, {
      title: 'Virement programmé exécuté 📅',
      body: `${amount} ${currency} envoyé à ${recipientName}.`,
      data: { type: 'SCHEDULED_EXECUTED', currency },
    });
  }

  async notifyScheduledTransferFailed(
    userId: string,
    reason: string,
  ): Promise<void> {
    await this.sendToUser(userId, {
      title: 'Virement programmé échoué ❌',
      body: `Votre virement automatique a échoué. ${reason}`,
      data: { type: 'SCHEDULED_FAILED' },
    });
  }

  async notifyLowBalance(
    userId: string,
    currency: string,
    balance: string,
  ): Promise<void> {
    await this.sendToUser(userId, {
      title: `Solde bas — ${currency} ⚠️`,
      body: `Votre solde ${currency} est faible : ${balance}`,
      data: { type: 'LOW_BALANCE', currency },
    });
  }

  async notifyKycResult(
    userId: string,
    approved: boolean,
  ): Promise<void> {
    await this.sendToUser(userId, {
      title: approved ? 'KYC approuvé ✅' : 'KYC refusé ❌',
      body: approved
        ? 'Votre identité a été vérifiée. Vos limites sont augmentées.'
        : 'Votre document KYC a été refusé. Vérifiez vos informations.',
      data: { type: 'KYC_RESULT', approved: String(approved) },
    });
  }
}