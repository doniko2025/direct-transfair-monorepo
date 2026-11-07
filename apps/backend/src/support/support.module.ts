// apps/backend/src/support/support.module.ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { PushModule } from '../push/push.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { PermissionsGuard } from './permissions.guard';
import { RefundsService } from './refunds.service';
import { SupportDeskController } from './support-desk.controller';
import { SupportDeskService } from './support-desk.service';
import { SupportNotifierService } from './support-notifier.service';
import { SupportStaffController } from './support-staff.controller';
import { SupportStaffService } from './support-staff.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

// PrismaModule est global ; AuthModule fournit le JwtService de JwtAuthGuard.
@Module({
  imports: [AuthModule, MailModule, PushModule, TransactionsModule],
  controllers: [SupportStaffController, SupportDeskController, TicketsController],
  providers: [PermissionsGuard, SupportStaffService, SupportDeskService, SupportNotifierService, TicketsService, RefundsService],
  exports: [SupportNotifierService],
})
export class SupportModule {}
