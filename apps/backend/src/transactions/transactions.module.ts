// apps/backend/src/transactions/transactions.module.ts
// =========================================================
// TRANSACTIONS MODULE v4.2 — Direct Transf'air
// ✅ v4.2 : PickupExpiryService (cron quotidien d'expiration des codes de retrait, voir pickup-rules.ts)
// ✅ v4.0 : WalletsModule, PushModule, SmsModule, MailModule
// ✅ v4.1 : FIX — NotificationsModule ajouté aux imports
//   TransactionsService injecte WalletNotifierService etc.
//   → NotificationsModule doit être explicitement listé ici.
// =========================================================

import { Module } from '@nestjs/common';
import { TransactionsService }    from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { PickupExpiryService }    from './pickup-expiry.service'; // ✅ v4.2 — expiration des codes (5 mois)
import { PrismaModule }           from '../prisma/prisma.module';
import { AuthModule }             from '../auth/auth.module';
import { RatesModule }            from '../rates/rates.module';
import { FeeScheduleModule }      from '../fee-schedule/fee-schedule.module'; // ✅ v4.2
import { WalletsModule }          from '../wallets/wallets.module';
import { PushModule }             from '../push/push.module';
import { SmsModule }              from '../sms/sms.module';
import { MailModule }             from '../mail/mail.module';
import { NotificationsModule }    from '../notifications/notifications.module'; // ✅ v4.1
import { ValidationThresholdsModule } from '../validation-thresholds/validation-thresholds.module'; // ✅ v4.2 (phase 6)
import { TransferLimitsModule } from '../transfer-limits/transfer-limits.module'; // phase 6 — plafonds d'envoi

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    RatesModule,
    FeeScheduleModule,   // ✅ v4.2 — barème de frais (FeeScheduleService)
    WalletsModule,       // Pour WalletsService (débit/crédit wallets)
    PushModule,          // Pour notifications push
    SmsModule,           // Pour SMS
    MailModule,          // Pour emails
    NotificationsModule, // ✅ v4.1 — WalletNotifier / AgentNotifier / etc.
    ValidationThresholdsModule, // seuil de validation réglé par l'admin société
    TransferLimitsModule, // plafonds d'envoi par niveau KYC
  ],
  controllers: [TransactionsController],
  providers:   [TransactionsService, PickupExpiryService],
  exports:     [TransactionsService],
})
export class TransactionsModule {} 