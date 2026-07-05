// apps/backend/src/transactions/transactions.module.ts
// =========================================================
// TRANSACTIONS MODULE v4.1 — Direct Transf'air
// ✅ v4.0 : WalletsModule, PushModule, SmsModule, MailModule
// ✅ v4.1 : FIX — NotificationsModule ajouté aux imports
//   TransactionsService injecte WalletNotifierService etc.
//   → NotificationsModule doit être explicitement listé ici.
// =========================================================

import { Module } from '@nestjs/common';
import { TransactionsService }    from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { PrismaModule }           from '../prisma/prisma.module';
import { AuthModule }             from '../auth/auth.module';
import { RatesModule }            from '../rates/rates.module';
import { WalletsModule }          from '../wallets/wallets.module';
import { PushModule }             from '../push/push.module';
import { SmsModule }              from '../sms/sms.module';
import { MailModule }             from '../mail/mail.module';
import { NotificationsModule }    from '../notifications/notifications.module'; // ✅ v4.1

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    RatesModule,
    WalletsModule,       // Pour WalletsService (débit/crédit wallets)
    PushModule,          // Pour notifications push
    SmsModule,           // Pour SMS
    MailModule,          // Pour emails
    NotificationsModule, // ✅ v4.1 — WalletNotifier / AgentNotifier / etc.
  ],
  controllers: [TransactionsController],
  providers:   [TransactionsService],
  exports:     [TransactionsService],
})
export class TransactionsModule {} 