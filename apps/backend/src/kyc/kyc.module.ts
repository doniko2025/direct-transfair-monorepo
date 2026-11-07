// apps/backend/src/kyc/kyc.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PushModule } from '../push/push.module';
import { CounterAdminService } from './counter-admin.service';
import { CounterCustomersService } from './counter-customers.service';
import { KycController } from './kyc.controller';
import { KycGuardService } from './kyc-guard.service';
import { KycNotifierService } from './kyc-notifier.service';
import { KycRemindersService } from './kyc-reminders.service';
import { KycService } from './kyc.service';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, AuthModule, PushModule, MailModule],
  controllers: [KycController],
  providers: [KycService, KycGuardService, KycNotifierService, KycRemindersService, CounterCustomersService, CounterAdminService],
  exports: [KycGuardService, KycService, KycNotifierService, CounterCustomersService],
})
export class KycModule {}
