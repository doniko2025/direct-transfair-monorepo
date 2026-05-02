// apps/backend/src/app.module.ts
// =========================================================
// APP MODULE v4.0 FINAL — Direct Transf'air
// ✅ Tous les modules v4 enregistrés
// ✅ ScheduleModule.forRoot() pour les crons
// ✅ Middleware TenantMiddleware conservé tel quel
// =========================================================

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from './prisma/prisma.module';
import { PlatformModule } from './platform/platform.module';

// ✅ Communications (globaux via @Global)
import { MailModule } from './mail/mail.module';
import { SmsModule } from './sms/sms.module';
import { PushModule } from './push/push.module';

// ✅ Core métier
import { NotificationsModule } from './notifications/notifications.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { TenantsModule } from './tenants/tenants.module';
import { AuthModule } from './auth/auth.module';
import { BeneficiariesModule } from './beneficiaries/beneficiaries.module';
import { TransactionsModule } from './transactions/transactions.module';
import { PaymentsModule } from './payments/payments.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';
import { RatesModule } from './rates/rates.module';
import { AgenciesModule } from './agencies/agencies.module';
import { CommissionsModule } from './commissions/commissions.module';

// ✅ NOUVEAUX MODULES v4
import { WalletsModule } from './wallets/wallets.module';
import { TreasuryModule } from './treasury/treasury.module';
import { ScheduledTransfersModule } from './scheduled-transfers/scheduled-transfers.module';
import { RateAlertsModule } from './rate-alerts/rate-alerts.module';

import { TenantMiddleware } from './tenants/tenant.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(), // ✅ Requis pour les @Cron() dans Treasury, ScheduledTransfers, RateAlerts

    // Infrastructure
    PrismaModule,
    PlatformModule,

    // Communications (@Global — disponibles partout)
    MailModule,
    SmsModule,
    PushModule,

    // Core
    NotificationsModule,
    UsersModule,
    ClientsModule,
    TenantsModule,
    AuthModule,
    BeneficiariesModule,
    TransactionsModule,
    PaymentsModule,
    WithdrawalsModule,
    RatesModule,
    AgenciesModule,
    CommissionsModule,

    // ✅ NOUVEAUX MODULES v4
    WalletsModule,
    TreasuryModule,
    ScheduledTransfersModule,
    RateAlertsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        'swagger',
        'swagger/(.*)',
        'auth/login',
        'auth/register',
        'auth/refresh',
        'health',
        'admin/tenants',
        'admin/tenants/(.*)',
      )
      .forRoutes('*');
  }
}