//apps/backend/src/notifications/notifications.module.ts
import { Module, Global, forwardRef } from '@nestjs/common';

import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

// ✅ mieux : importer PrismaModule plutôt que re-déclarer PrismaService
import { PrismaModule } from '../prisma/prisma.module';

// ✅ IMPORTANT : pour fournir JwtService / JwtAuthGuard au module Notifications
import { AuthModule } from '../auth/auth.module';

// Channels
import { WalletNotifierService } from './channels/wallet-notifier.service';
import { AgentNotifierService } from './channels/agent-notifier.service';
import { CompanyNotifierService } from './channels/company-notifier.service';
import { AdminNotifierService } from './channels/admin-notifier.service';

@Global()
@Module({
  imports: [
    PrismaModule,
    // forwardRef uniquement si tu as une dépendance circulaire (sinon tu peux mettre AuthModule direct)
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
