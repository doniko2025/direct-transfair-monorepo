// apps/backend/src/transactions/transactions.module.ts
// =========================================================
// TRANSACTIONS MODULE v4.0
// ✅ WalletsModule — pour WalletsService (débit/crédit)
// ✅ PushModule — pour notifications push
// ✅ SmsModule — pour notifications SMS
// ✅ MailModule — pour emails (global, mais explicite ici)
// =========================================================

import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RatesModule } from '../rates/rates.module';
import { WalletsModule } from '../wallets/wallets.module';
import { PushModule } from '../push/push.module';
import { SmsModule } from '../sms/sms.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    RatesModule,
    WalletsModule, // ✅ Pour WalletsService (débit/crédit wallets)
    PushModule,    // ✅ Pour notifications push
    SmsModule,     // ✅ Pour SMS
    MailModule,    // ✅ Pour emails (déjà global, mais explicite)
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}