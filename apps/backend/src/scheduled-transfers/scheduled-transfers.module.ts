// apps/backend/src/scheduled-transfers/scheduled-transfers.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { ScheduledTransfersService } from './scheduled-transfers.service';
import { ScheduledTransfersController } from './scheduled-transfers.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WalletsModule } from '../wallets/wallets.module';
import { RatesModule } from '../rates/rates.module';
import { PushModule } from '../push/push.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    WalletsModule,
    RatesModule,
    PushModule,
    MailModule,
  ],
  controllers: [ScheduledTransfersController],
  providers: [ScheduledTransfersService],
  exports: [ScheduledTransfersService],
})
export class ScheduledTransfersModule {}