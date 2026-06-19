// apps/backend/src/notifications/notifications.module.ts
// =========================================================
// NOTIFICATIONS MODULE v2.0 — Direct Transf'air
// @Global() → providers exportés disponibles dans toute l'app
// =========================================================

import { Module, Global, forwardRef } from '@nestjs/common';

import { NotificationsService }    from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PrismaModule }            from '../prisma/prisma.module';
import { AuthModule }              from '../auth/auth.module';

import { WalletNotifierService }   from './channels/wallet-notifier.service';
import { AgentNotifierService }    from './channels/agent-notifier.service';
import { CompanyNotifierService }  from './channels/company-notifier.service';
import { AdminNotifierService }    from './channels/admin-notifier.service';

@Global()
@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    WalletNotifierService,
    AgentNotifierService,
    CompanyNotifierService,
    AdminNotifierService,
  ],
  exports: [
    NotificationsService,
    WalletNotifierService,
    AgentNotifierService,
    CompanyNotifierService,
    AdminNotifierService,
  ],
})
export class NotificationsModule {}