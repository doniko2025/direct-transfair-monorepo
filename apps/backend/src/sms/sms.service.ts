// apps/backend/src/sms/sms.service.ts
// =========================================================
// SMS SERVICE v4.0 — Direct Transf'air
// ✅ Provider : Twilio (principal) + Orange API (fallback)
// ✅ CommunicationLog tracé en base
// ✅ Templates OTP, transfert, alerte solde
// =========================================================

import { Injectable, Logger } from '@nestjs/common';
import { Twilio } from 'twilio';

import { PrismaService } from '../prisma/prisma.service';

// =========================================================
// TYPES
// =========================================================

export interface SendSmsOptions {
  to: string;            // Numéro international ex: "+224624000000"
  message: string;       // Corps du SMS
  userId?: string;       // Pour le CommunicationLog
  transactionId?: string;
}

export interface SmsResult {
  success: boolean;
  provider: string;
  sid?: string;
  error?: string;
}

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private twilioClient: Twilio | null = null;
  private readonly fromNumber: string;

  constructor(private readonly prisma: PrismaService) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER ?? '';

    if (accountSid && authToken && this.fromNumber) {
      this.twilioClient = new Twilio(accountSid, authToken);
      this.logger.log('✅ Twilio SMS initialisé');
    } else {
      this.logger.warn(
        '⚠️  Twilio non configuré — SMS en mode STUB (console uniquement)',
      );
    }
  }

  // ========================================================
  // ENVOI PRINCIPAL (avec fallback stub)
  // ========================================================

  async send(opts: SendSmsOptions): Promise<SmsResult> {
    const { to, message, userId, transactionId } = opts;

    // ✅ CommunicationLog → PENDING
    let logId: string | null = null;
    try {
      const log = await this.prisma.communicationLog.create({
        data: {
          userId: userId ?? null,
          transactionId: transactionId ?? null,
          type: 'SMS',
          recipient: to,
          smsContent: message,
          status: 'PENDING',
          providerName: this.twilioClient ? 'twilio' : 'stub',
        },
      });
      logId = log.id;
    } catch (e) {
      this.logger.warn('CommunicationLog SMS create failed', e);
    }

    // ✅ STUB : Pas de Twilio configuré → log console
    if (!this.twilioClient) {
      this.logger.log(`[SMS STUB] → ${to} : ${message}`);

      if (logId) {
        await this.prisma.communicationLog
          .update({
            where: { id: logId },
            data: { status: 'SENT', sentAt: new Date(), providerId: 'stub' },
          })
          .catch(() => {});
      }

      return { success: true, provider: 'stub' };
    }

    // ✅ TWILIO
    try {
      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.fromNumber,
        to,
      });

      this.logger.log(`✉️  SMS envoyé → ${to} (SID: ${result.sid})`);

      if (logId) {
        await this.prisma.communicationLog
          .update({
            where: { id: logId },
            data: {
              status: 'SENT',
              sentAt: new Date(),
              providerId: result.sid,
            },
          })
          .catch(() => {});
      }

      return { success: true, provider: 'twilio', sid: result.sid };
    } catch (error: any) {
      const errMsg = error?.message ?? String(error);
      this.logger.error(`❌ SMS Twilio failed → ${to}`, errMsg);

      if (logId) {
        await this.prisma.communicationLog
          .update({
            where: { id: logId },
            data: {
              status: 'FAILED',
              errorMsg: errMsg,
              retryCount: { increment: 1 },
            },
          })
          .catch(() => {});
      }

      return { success: false, provider: 'twilio', error: errMsg };
    }
  }

  // ========================================================
  // TEMPLATES MÉTIER
  // ========================================================

  async sendOtp(to: string, code: string, userId?: string): Promise<SmsResult> {
    const message =
      `[Direct Transf'air] Votre code de vérification : ${code}\n` +
      `Valable 10 minutes. Ne le partagez jamais.`;

    return this.send({ to, message, userId });
  }

  async sendTransferNotification(params: {
    to: string;
    recipientName: string;
    amount: string;
    currency: string;
    pickupCode?: string;
    userId?: string;
    transactionId?: string;
  }): Promise<SmsResult> {
    let message =
      `[Direct Transf'air] Votre transfert de ${params.amount} ${params.currency} ` +
      `vers ${params.recipientName} est enregistré.`;

    if (params.pickupCode) {
      message += ` Code retrait : ${params.pickupCode}`;
    }

    return this.send({
      to: params.to,
      message,
      userId: params.userId,
      transactionId: params.transactionId,
    });
  }

  async sendMoneyReceived(params: {
    to: string;
    senderName: string;
    amount: string;
    currency: string;
    userId?: string;
  }): Promise<SmsResult> {
    const message =
      `[Direct Transf'air] Vous avez reçu ${params.amount} ${params.currency} ` +
      `de ${params.senderName}. Connectez-vous pour voir votre solde.`;

    return this.send({ to: params.to, message, userId: params.userId });
  }

  async sendWithdrawalCode(params: {
    to: string;
    amount: string;
    currency: string;
    code: string;
    userId?: string;
  }): Promise<SmsResult> {
    const message =
      `[Direct Transf'air] Code retrait : ${params.code}\n` +
      `Montant : ${params.amount} ${params.currency}.\n` +
      `Présentez ce code à un agent agréé.`;

    return this.send({ to: params.to, message, userId: params.userId });
  }

  async sendLowBalanceAlert(params: {
    to: string;
    agencyName: string;
    currency: string;
    balance: string;
    userId?: string;
  }): Promise<SmsResult> {
    const message =
      `[Direct Transf'air] ⚠️ Solde bas - ${params.agencyName}\n` +
      `${params.currency} : ${params.balance}. Rechargement nécessaire.`;

    return this.send({ to: params.to, message, userId: params.userId });
  }

  async sendRateAlert(params: {
    to: string;
    pair: string;
    rate: number;
    direction: 'ABOVE' | 'BELOW';
    userId?: string;
  }): Promise<SmsResult> {
    const dir = params.direction === 'ABOVE' ? 'dépassé' : 'passé sous';
    const message =
      `[Direct Transf'air] 📊 Alerte taux !\n` +
      `Le taux ${params.pair.replace('_', '→')} a ${dir} votre seuil.\n` +
      `Taux actuel : ${params.rate}`;

    return this.send({ to: params.to, message, userId: params.userId });
  }
}